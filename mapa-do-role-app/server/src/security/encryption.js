import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../config.js";

const ALGORITHM = "aes-256-gcm";
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function keyForVersion(version) {
  const key = config.dataEncryptionKeyring.get(Number(version));
  if (!key) throw new Error("Chave de criptografia ausente para esta versão.");
  return key;
}

function associatedData({ userId, fieldName, keyVersion }) {
  // AAD is authenticated but not encrypted. Binding owner + field prevents
  // moving a valid ciphertext to another user or database column.
  return Buffer.from("mdr:v1:" + keyVersion + ":" + userId + ":" + fieldName, "utf8");
}

export function encryptSensitiveField(plaintext, { userId, fieldName }) {
  const keyVersion = config.activeDataEncryptionKeyVersion;
  const nonce = randomBytes(NONCE_BYTES); // Never reuse a GCM nonce with the same key.
  const cipher = createCipheriv(ALGORITHM, keyForVersion(keyVersion), nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(associatedData({ userId, fieldName, keyVersion }));

  const ciphertext = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final()
  ]);

  return {
    ciphertext,
    nonce,
    authTag: cipher.getAuthTag(),
    keyVersion
  };
}

export function decryptSensitiveField(record, { userId, fieldName }) {
  const keyVersion = Number(record.key_version ?? record.keyVersion);
  const nonce = record.nonce;
  const ciphertext = record.ciphertext;
  const authTag = record.auth_tag ?? record.authTag;

  if (!Buffer.isBuffer(nonce) || nonce.length !== NONCE_BYTES ||
      !Buffer.isBuffer(authTag) || authTag.length !== TAG_BYTES ||
      !Buffer.isBuffer(ciphertext)) {
    throw new Error("Registro criptografado inválido.");
  }

  const decipher = createDecipheriv(ALGORITHM, keyForVersion(keyVersion), nonce, { authTagLength: TAG_BYTES });
  decipher.setAAD(associatedData({ userId, fieldName, keyVersion }));
  decipher.setAuthTag(authTag);

  // final() verifies the GCM tag and throws if data, nonce, tag, owner, field,
  // or key has changed.
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
