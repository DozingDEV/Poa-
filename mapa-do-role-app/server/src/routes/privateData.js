import { Router } from "express";
import { z } from "zod";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/authenticate.js";
import { requireSameOrigin } from "../middleware/security.js";
import { decryptSensitiveField, encryptSensitiveField } from "../security/encryption.js";

const router = Router();
const noteSchema = z.object({ note: z.string().max(2_000) }).strict();
const FIELD_NAME = "private_note";

router.use(requireAuth);

router.get("/private-note", async (req, res) => {
  const result = await pool.query(
    "SELECT ciphertext, nonce, auth_tag, key_version FROM encrypted_profile_fields WHERE user_id = $1 AND field_name = $2",
    [req.auth.userId, FIELD_NAME]
  );
  if (!result.rows[0]) return res.json({ note: "" });

  const note = decryptSensitiveField(result.rows[0], {
    userId: req.auth.userId,
    fieldName: FIELD_NAME
  });
  return res.json({ note });
});

router.put("/private-note", requireSameOrigin, async (req, res) => {
  const parsed = noteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_input", message: "A anotação pode ter até 2.000 caracteres." });
  }

  const encrypted = encryptSensitiveField(parsed.data.note, {
    userId: req.auth.userId,
    fieldName: FIELD_NAME
  });
  await pool.query(
    "INSERT INTO encrypted_profile_fields (user_id, field_name, ciphertext, nonce, auth_tag, key_version, updated_at) " +
    "VALUES ($1, $2, $3, $4, $5, $6, NOW()) " +
    "ON CONFLICT (user_id, field_name) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, nonce = EXCLUDED.nonce, " +
    "auth_tag = EXCLUDED.auth_tag, key_version = EXCLUDED.key_version, updated_at = NOW()",
    [req.auth.userId, FIELD_NAME, encrypted.ciphertext, encrypted.nonce, encrypted.authTag, encrypted.keyVersion]
  );
  return res.status(204).end();
});

export default router;
