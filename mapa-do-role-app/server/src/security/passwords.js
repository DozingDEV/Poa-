import argon2 from "argon2";
import { randomBytes } from "node:crypto";

// OWASP's current Argon2id baseline: 19 MiB, 2 iterations, one lane.
// Benchmark production hardware and raise the cost when login latency allows.
export const passwordHashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1
};

export const hashPassword = (password) => argon2.hash(password, passwordHashOptions);
export const verifyPassword = (encodedHash, password) => argon2.verify(encodedHash, password);

// Running the same expensive verification for an unknown email reduces
// account-enumeration timing differences during login.
export const dummyPasswordHash = await hashPassword(randomBytes(32).toString("base64url"));
