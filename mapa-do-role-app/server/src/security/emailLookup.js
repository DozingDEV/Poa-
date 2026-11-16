import { createHmac } from "node:crypto";
import { config } from "../config.js";

function digestWithKey(email, version, key) {
  return {
    version,
    digest: createHmac("sha256", key).update(email, "utf8").digest("hex")
  };
}

export function emailLookupCandidates(normalizedEmail) {
  // Old key versions stay available during a gradual HMAC-key rotation.
  return Array.from(config.emailLookupKeyring, ([version, key]) =>
    digestWithKey(normalizedEmail, version, key)
  );
}

export function activeEmailLookup(normalizedEmail) {
  const version = config.activeEmailLookupKeyVersion;
  return digestWithKey(normalizedEmail, version, config.emailLookupKeyring.get(version));
}
