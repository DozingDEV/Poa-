import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: z.enum(["true", "false"]).default("false"),
  REDIS_URL: z.string().optional().default(""),
  JWT_ACCESS_SECRET_BASE64: z.string().min(1),
  DATA_ENCRYPTION_KEYS_JSON: z.string().min(1),
  ACTIVE_DATA_ENCRYPTION_KEY_VERSION: z.coerce.number().int().positive(),
  EMAIL_LOOKUP_KEYS_JSON: z.string().min(1),
  ACTIVE_EMAIL_LOOKUP_KEY_VERSION: z.coerce.number().int().positive(),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  TLS_KEY_PATH: z.string().optional().default(""),
  TLS_CERT_PATH: z.string().optional().default("")
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  throw new Error("Configuração inválida. Confira as variáveis em server/.env.");
}

const env = parsed.data;
const webUrl = new URL(env.WEB_ORIGIN);
if (!["http:", "https:"].includes(webUrl.protocol) || webUrl.pathname !== "/" || webUrl.search || webUrl.hash) {
  throw new Error("WEB_ORIGIN deve ser uma origem, por exemplo https://app.example.com.");
}

const jwtSecret = Buffer.from(env.JWT_ACCESS_SECRET_BASE64, "base64");
if (jwtSecret.length < 32) {
  throw new Error("JWT_ACCESS_SECRET_BASE64 precisa decodificar para pelo menos 32 bytes.");
}

let rawKeyring;
try {
  rawKeyring = JSON.parse(env.DATA_ENCRYPTION_KEYS_JSON);
} catch {
  throw new Error("DATA_ENCRYPTION_KEYS_JSON precisa conter um objeto JSON de versões e chaves Base64.");
}

const dataEncryptionKeyring = new Map();
for (const [versionText, base64Key] of Object.entries(rawKeyring)) {
  const version = Number(versionText);
  const key = Buffer.from(String(base64Key), "base64");
  if (!Number.isInteger(version) || version < 1 || key.length !== 32) {
    throw new Error("Cada chave AES precisa ter versão positiva e exatamente 32 bytes.");
  }
  dataEncryptionKeyring.set(version, key);
}

if (!dataEncryptionKeyring.has(env.ACTIVE_DATA_ENCRYPTION_KEY_VERSION)) {
  throw new Error("A versão ativa de criptografia não existe no keyring.");
}

let rawEmailLookupKeyring;
try {
  rawEmailLookupKeyring = JSON.parse(env.EMAIL_LOOKUP_KEYS_JSON);
} catch {
  throw new Error("EMAIL_LOOKUP_KEYS_JSON precisa conter um objeto JSON de versões e chaves Base64.");
}

const emailLookupKeyring = new Map();
for (const [versionText, base64Key] of Object.entries(rawEmailLookupKeyring)) {
  const version = Number(versionText);
  const key = Buffer.from(String(base64Key), "base64");
  if (!Number.isInteger(version) || version < 1 || key.length !== 32) {
    throw new Error("Cada chave HMAC de e-mail precisa ter versão positiva e exatamente 32 bytes.");
  }
  emailLookupKeyring.set(version, key);
}

if (!emailLookupKeyring.has(env.ACTIVE_EMAIL_LOOKUP_KEY_VERSION)) {
  throw new Error("A versão ativa da chave HMAC de e-mail não existe no keyring.");
}

const isProduction = env.NODE_ENV === "production";
const hasDirectTls = Boolean(env.TLS_KEY_PATH && env.TLS_CERT_PATH);
if (Boolean(env.TLS_KEY_PATH) !== Boolean(env.TLS_CERT_PATH)) {
  throw new Error("Configure TLS_KEY_PATH e TLS_CERT_PATH juntos, ou use um proxy confiável.");
}
if (isProduction && !hasDirectTls && env.TRUST_PROXY_HOPS === 0) {
  throw new Error("Produção exige TLS direto ou um proxy confiável configurado.");
}
if (isProduction && env.DATABASE_SSL !== "true") {
  throw new Error("DATABASE_SSL=true é obrigatório em produção.");
}
if (isProduction && !env.REDIS_URL.startsWith("rediss://")) {
  throw new Error("Produção exige REDIS_URL com TLS (rediss://) para rate limiting compartilhado.");
}

export const config = {
  ...env,
  isProduction,
  webOrigin: webUrl.origin,
  jwtSecret,
  jwtIssuer: "mapa-do-role-api",
  jwtAudience: "mapa-do-role-web",
  accessTokenTtlSeconds: 10 * 60,
  refreshTokenTtlDays: 30,
  activeDataEncryptionKeyVersion: env.ACTIVE_DATA_ENCRYPTION_KEY_VERSION,
  dataEncryptionKeyring,
  activeEmailLookupKeyVersion: env.ACTIVE_EMAIL_LOOKUP_KEY_VERSION,
  emailLookupKeyring,
  refreshCookieName: isProduction ? "__Secure-mdr_refresh" : "mdr_refresh"
};
