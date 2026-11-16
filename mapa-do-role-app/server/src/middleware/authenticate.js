import { verifyAccessToken } from "../security/tokens.js";

export function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const match = /^Bearer ([A-Za-z0-9._-]+)$/.exec(header);
  if (!match) {
    return res.status(401).json({ error: "unauthorized", message: "Entre novamente para continuar." });
  }

  try {
    const claims = verifyAccessToken(match[1]);
    if (typeof claims.sub !== "string" || typeof claims.sid !== "string") {
      return res.status(401).json({ error: "unauthorized", message: "Entre novamente para continuar." });
    }
    req.auth = { userId: claims.sub, sessionId: claims.sid };
    return next();
  } catch {
    return res.status(401).json({ error: "unauthorized", message: "Entre novamente para continuar." });
  }
}
