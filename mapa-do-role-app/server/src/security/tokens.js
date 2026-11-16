import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { pool, withTransaction } from "../db.js";

const tokenDigest = (token) => createHash("sha256").update(token, "utf8").digest("hex");

export function createAccessToken(userId, sessionId) {
  return jwt.sign(
    { sid: sessionId },
    config.jwtSecret,
    {
      algorithm: "HS256",
      subject: userId,
      issuer: config.jwtIssuer,
      audience: config.jwtAudience,
      expiresIn: config.accessTokenTtlSeconds,
      jwtid: randomUUID()
    }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwtSecret, {
    algorithms: ["HS256"],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    clockTolerance: 5
  });
}

function newOpaqueRefreshToken() {
  return randomBytes(32).toString("base64url");
}

export async function createSession(userId) {
  const familyId = randomUUID();
  const refreshToken = newOpaqueRefreshToken();
  const expiresAt = new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

  await pool.query(
    "INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at) VALUES ($1, $2, $3, $4, $5)",
    [randomUUID(), userId, familyId, tokenDigest(refreshToken), expiresAt]
  );

  return { accessToken: createAccessToken(userId, familyId), refreshToken };
}

export async function rotateRefreshToken(presentedToken) {
  const presentedHash = tokenDigest(presentedToken);

  // Row locking makes rotation single-use even when refresh requests race.
  return withTransaction(async (client) => {
    const result = await client.query(
      "SELECT id, user_id, family_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE",
      [presentedHash]
    );
    const current = result.rows[0];
    if (!current) return { state: "invalid" };

    if (current.revoked_at) {
      // A very short grace period prevents two tabs refreshing the same
      // cookie at once from looking like token theft. Reuse after this window
      // still revokes the whole family.
      const revokedAgeMs = Date.now() - new Date(current.revoked_at).getTime();
      if (revokedAgeMs <= 3_000) return { state: "raced" };

      // Reuse of a rotated token suggests a copied token; revoke its full family.
      await client.query(
        "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE family_id = $1",
        [current.family_id]
      );
      return { state: "reused" };
    }

    if (new Date(current.expires_at).getTime() <= Date.now()) {
      await client.query("UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1", [current.id]);
      return { state: "invalid" };
    }

    const nextToken = newOpaqueRefreshToken();
    const nextHash = tokenDigest(nextToken);
    const nextExpiry = new Date(Date.now() + config.refreshTokenTtlDays * 24 * 60 * 60 * 1000);
    await client.query(
      "INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at) VALUES ($1, $2, $3, $4, $5)",
      [randomUUID(), current.user_id, current.family_id, nextHash, nextExpiry]
    );
    await client.query(
      "UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_hash = $2 WHERE id = $1",
      [current.id, nextHash]
    );

    return {
      state: "ok",
      userId: current.user_id,
      sessionId: current.family_id,
      refreshToken: nextToken
    };
  });
}

export async function revokeRefreshToken(token) {
  if (!token) return;
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = COALESCE(revoked_at, NOW()) WHERE token_hash = $1",
    [tokenDigest(token)]
  );
}
