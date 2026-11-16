import { config } from "../config.js";

export function requireHttps(req, res, next) {
  if (config.isProduction && !req.secure) {
    return res.status(426).json({ error: "https_required", message: "Acesse a API por HTTPS." });
  }
  return next();
}

export function requireSameOrigin(req, res, next) {
  // Browser auth mutations require the configured Origin as an extra CSRF defense.
  if (req.get("origin") !== config.webOrigin) {
    return res.status(403).json({ error: "origin_not_allowed", message: "Origem não permitida." });
  }
  return next();
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "strict",
    path: "/api/auth",
    maxAge: config.refreshTokenTtlDays * 24 * 60 * 60 * 1000
  };
}

export function clearRefreshCookie(res) {
  const { maxAge, ...options } = refreshCookieOptions();
  res.clearCookie(config.refreshCookieName, options);
}
