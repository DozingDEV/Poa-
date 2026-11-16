import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { pool, withTransaction } from "../db.js";
import { clearRefreshCookie, refreshCookieOptions, requireSameOrigin } from "../middleware/security.js";
import { createAccessToken, createSession, revokeRefreshToken, rotateRefreshToken } from "../security/tokens.js";
import { dummyPasswordHash, hashPassword, verifyPassword } from "../security/passwords.js";
import { createRateLimitStore } from "../rateLimitStore.js";
import { decryptSensitiveField, encryptSensitiveField } from "../security/encryption.js";
import { activeEmailLookup, emailLookupCandidates } from "../security/emailLookup.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRateLimitStore("mdr:limit:auth:"),
  message: { error: "too_many_attempts", message: "Muitas tentativas. Tente novamente em alguns minutos." }
});

router.use(authLimiter);
router.use(requireSameOrigin);

const credentialsSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128)
}).strict();

function parseCredentials(req, res) {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid_input",
      message: "Confira o e-mail e a senha (mínimo de 12 caracteres).",
      fields: parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }))
    });
    return null;
  }
  return { email: parsed.data.email.toLowerCase(), password: parsed.data.password };
}

function sendSession(res, session, user, status = 200) {
  res.cookie(config.refreshCookieName, session.refreshToken, refreshCookieOptions());
  return res.status(status).json({
    accessToken: session.accessToken,
    expiresIn: config.accessTokenTtlSeconds,
    user
  });
}

router.post("/register", async (req, res) => {
  const credentials = parseCredentials(req, res);
  if (!credentials) return;

  const passwordHash = await hashPassword(credentials.password);
  const userId = randomUUID();
  const lookup = activeEmailLookup(credentials.email);
  const candidates = emailLookupCandidates(credentials.email);
  const encryptedEmail = encryptSensitiveField(credentials.email, { userId, fieldName: "email" });
  const inserted = await withTransaction(async (client) => {
    const existing = await client.query(
      "SELECT 1 FROM users u WHERE EXISTS (" +
      "SELECT 1 FROM unnest($1::integer[], $2::text[]) AS candidate(key_version, lookup_digest) " +
      "WHERE candidate.key_version = u.email_lookup_key_version AND candidate.lookup_digest = u.email_lookup_hash) LIMIT 1",
      [candidates.map((candidate) => candidate.version), candidates.map((candidate) => candidate.digest)]
    );
    if (existing.rows[0]) return null;

    const userResult = await client.query(
      "INSERT INTO users (id, email_lookup_hash, email_lookup_key_version, password_hash) " +
      "VALUES ($1, $2, $3, $4) ON CONFLICT (email_lookup_key_version, email_lookup_hash) DO NOTHING RETURNING id",
      [userId, lookup.digest, lookup.version, passwordHash]
    );
    if (!userResult.rows[0]) return null;

    await client.query(
      "INSERT INTO encrypted_profile_fields (user_id, field_name, ciphertext, nonce, auth_tag, key_version) " +
      "VALUES ($1, 'email', $2, $3, $4, $5)",
      [userId, encryptedEmail.ciphertext, encryptedEmail.nonce, encryptedEmail.authTag, encryptedEmail.keyVersion]
    );
    return userResult.rows[0];
  });

  // The copy is neutral; public signup should add verification and uniform
  // responses to reduce account enumeration.
  if (!inserted) {
    return res.status(409).json({ error: "account_unavailable", message: "Não foi possível criar a conta com esses dados." });
  }

  const user = { id: inserted.id, email: credentials.email };
  const session = await createSession(user.id);
  return sendSession(res, session, user, 201);
});

router.post("/login", async (req, res) => {
  const credentials = parseCredentials(req, res);
  if (!credentials) return;

  const candidates = emailLookupCandidates(credentials.email);
  const result = await pool.query(
    "SELECT u.id, u.password_hash, u.email_lookup_key_version, " +
    "e.ciphertext AS email_ciphertext, e.nonce AS email_nonce, e.auth_tag AS email_auth_tag, e.key_version AS email_key_version " +
    "FROM users u LEFT JOIN encrypted_profile_fields e ON e.user_id = u.id AND e.field_name = 'email' " +
    "WHERE EXISTS (SELECT 1 FROM unnest($1::integer[], $2::text[]) AS candidate(key_version, lookup_digest) " +
    "WHERE candidate.key_version = u.email_lookup_key_version AND candidate.lookup_digest = u.email_lookup_hash) " +
    "ORDER BY (u.email_lookup_key_version = $3) DESC LIMIT 1",
    [candidates.map((candidate) => candidate.version), candidates.map((candidate) => candidate.digest), config.activeEmailLookupKeyVersion]
  );
  const user = result.rows[0];
  const passwordOk = await verifyPassword(user?.password_hash ?? dummyPasswordHash, credentials.password);
  if (!user || !passwordOk || !user.email_ciphertext) {
    return res.status(401).json({ error: "invalid_credentials", message: "E-mail ou senha inválidos." });
  }

  const email = decryptSensitiveField({
    ciphertext: user.email_ciphertext,
    nonce: user.email_nonce,
    auth_tag: user.email_auth_tag,
    key_version: user.email_key_version
  }, { userId: user.id, fieldName: "email" });
  if (user.email_lookup_key_version !== config.activeEmailLookupKeyVersion) {
    const activeLookup = activeEmailLookup(credentials.email);
    await pool.query(
      "UPDATE users SET email_lookup_hash = $2, email_lookup_key_version = $3 WHERE id = $1",
      [user.id, activeLookup.digest, activeLookup.version]
    );
  }

  const session = await createSession(user.id);
  return sendSession(res, session, { id: user.id, email });
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.[config.refreshCookieName];
  if (!token) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "refresh_required", message: "Entre novamente para continuar." });
  }

  const rotated = await rotateRefreshToken(token);
  if (rotated.state === "raced") {
    // The browser may retry once after another tab has stored the new cookie.
    // Do not clear that newly rotated cookie from this concurrent response.
    return res.status(409).json({ error: "refresh_race", message: "A sessão está sendo atualizada." });
  }
  if (rotated.state !== "ok") {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "refresh_invalid", message: "Sua sessão expirou. Entre novamente." });
  }

  const userResult = await pool.query(
    "SELECT u.id, e.ciphertext AS email_ciphertext, e.nonce AS email_nonce, e.auth_tag AS email_auth_tag, e.key_version AS email_key_version " +
    "FROM users u JOIN encrypted_profile_fields e ON e.user_id = u.id AND e.field_name = 'email' WHERE u.id = $1",
    [rotated.userId]
  );
  const userRow = userResult.rows[0];
  if (!userRow) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: "refresh_invalid", message: "Sua sessão expirou. Entre novamente." });
  }

  const email = decryptSensitiveField({
    ciphertext: userRow.email_ciphertext,
    nonce: userRow.email_nonce,
    auth_tag: userRow.email_auth_tag,
    key_version: userRow.email_key_version
  }, { userId: userRow.id, fieldName: "email" });
  const session = {
    accessToken: createAccessToken(rotated.userId, rotated.sessionId),
    refreshToken: rotated.refreshToken
  };
  return sendSession(res, session, { id: userRow.id, email });
});

router.post("/logout", async (req, res) => {
  await revokeRefreshToken(req.cookies?.[config.refreshCookieName]);
  clearRefreshCookie(res);
  return res.status(204).end();
});

export default router;
