import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function AuthPanel({ mode, setMode, onAuthenticated, user, onLogout }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    setMessage(null);
    setAttempted(false);
  }, [mode]);

  const errors = useMemo(() => {
    const next = {};
    if (email && !validateEmail(email)) next.email = "Digite um e-mail válido.";
    if (password && password.length < 12) next.password = "Use pelo menos 12 caracteres.";
    if (password.length > 128) next.password = "Use até 128 caracteres.";
    if (mode === "register" && confirmation && password !== confirmation) {
      next.confirmation = "As senhas não coincidem.";
    }
    if (attempted && !email) next.email = "Informe seu e-mail.";
    if (attempted && !password) next.password = "Informe sua senha.";
    if (attempted && mode === "register" && !confirmation) next.confirmation = "Confirme sua senha.";
    return next;
  }, [email, password, confirmation, mode, attempted]);

  async function handleSubmit(event) {
    event.preventDefault();
    setAttempted(true);
    setMessage(null);

    const invalid = !validateEmail(email) || password.length < 12 || password.length > 128 ||
      (mode === "register" && (confirmation !== password || confirmation.length === 0));
    if (invalid) return;

    setBusy(true);
    try {
      const response = await fetch(API_BASE + "/api/auth/" + mode, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Não foi possível entrar. Tente de novo.");
      setPassword("");
      setConfirmation("");
      setMessage({ kind: "success", text: mode === "register" ? "Conta criada. Bem-vinda ao mapa!" : "Que bom te ver de novo." });
      onAuthenticated(data.accessToken, data.user);
    } catch (error) {
      setMessage({ kind: "error", text: error.message || "A API não respondeu. Tente novamente." });
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <motion.aside className="auth-card signed-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="auth-card-kicker"><span className="secure-dot" /> SUA CONTA</div>
        <h2>Que bom te ver por aqui.</h2>
        <p className="auth-subtitle">Você entrou como <strong>{user.email}</strong>.</p>
        <div className="account-badge">
          <span className="account-avatar">{(user.email || "R").slice(0, 1).toUpperCase()}</span>
          <span><b>Porto Alegre</b><small>Seu mapa está pronto para explorar</small></span>
          <span className="account-check" aria-label="Sessão ativa">✓</span>
        </div>
        <button className="auth-submit secondary-submit" type="button" onClick={onLogout}>Sair da conta</button>
      </motion.aside>
    );
  }

  return (
    <motion.aside className="auth-card" id="conta" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
      <div className="auth-card-kicker"><span className="secure-dot" /> TEU PRÓXIMO PLANO COMEÇA AQUI</div>
      <h2>{mode === "register" ? "Entra no mapa." : "Bom te ver de novo."}</h2>
      <p className="auth-subtitle">{mode === "register" ? "Cria tua conta e salva os rolês que combinam contigo." : "Acessa tua conta e teus rolês salvos."}</p>

      <div className="auth-switch" role="tablist" aria-label="Acesso à conta">
        <button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>Criar conta</button>
        <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>Entrar</button>
      </div>

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="field-group">
          <label htmlFor="email">E-mail</label>
          <div className={"input-wrap" + (errors.email ? " has-error" : "")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              placeholder="voce@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              required
            />
          </div>
          {errors.email && <small className="field-error" id="email-error">{errors.email}</small>}
        </div>

        <div className="field-group">
          <div className="label-row"><label htmlFor="password">Senha</label>{mode === "login" && <span className="password-note">mínimo 12 caracteres</span>}</div>
          <div className={"input-wrap" + (errors.password ? " has-error" : "")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              minLength={12}
              maxLength={128}
              placeholder="Pelo menos 12 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={errors.password ? "password-error" : undefined}
              required
            />
            <button className="reveal-button" type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {errors.password && <small className="field-error" id="password-error">{errors.password}</small>}
        </div>

        <AnimatePresence initial={false}>
          {mode === "register" && (
            <motion.div className="field-group confirm-field" key="confirm" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
              <label htmlFor="confirmation">Confirma tua senha</label>
              <div className={"input-wrap" + (errors.confirmation ? " has-error" : "")}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
                <input
                  id="confirmation"
                  name="confirmation"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  placeholder="Repete a senha"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  aria-invalid={Boolean(errors.confirmation)}
                  aria-describedby={errors.confirmation ? "confirmation-error" : undefined}
                  required
                />
              </div>
              {errors.confirmation && <small className="field-error" id="confirmation-error">{errors.confirmation}</small>}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {message && (
            <motion.div className={"form-message " + message.kind} role="status" aria-live="polite" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <span aria-hidden="true">{message.kind === "success" ? "✓" : "!"}</span>{message.text}
            </motion.div>
          )}
        </AnimatePresence>

        <button className="auth-submit" type="submit" disabled={busy}>
          {busy ? <><span className="spinner" /> Só um instante…</> : <>{mode === "register" ? "Criar minha conta" : "Entrar no mapa"}<span aria-hidden="true">↗</span></>}
        </button>
        <p className="privacy-note"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg> A gente cuida dos teus dados com segurança.</p>
      </form>
    </motion.aside>
  );
}
