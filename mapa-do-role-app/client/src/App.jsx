import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import AuthPanel from "./components/AuthPanel.jsx";
import Logo from "./components/Logo.jsx";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

function MapPreview() {
  return (
    <div className="preview-card">
      <div className="preview-heading">
        <div><span className="preview-kicker">PRÉVIA DO PRODUTO</span><b>Porto Alegre, no teu ritmo.</b></div>
        <span className="preview-live"><i /> mapa ilustrativo</span>
      </div>
      <div className="preview-map">
        <svg className="preview-map-art" viewBox="0 0 760 420" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Ilustração do Guaíba e bairros centrais de Porto Alegre">
          <rect width="760" height="420" fill="#c8e0df"/>
          <path d="M305-30c-14 53 21 78 1 126-20 47 18 76-4 125-19 43 9 83-14 122-13 22-16 44-23 77h535V-30Z" fill="#e8eddf"/>
          <path d="M305-30c-14 53 21 78 1 126-20 47 18 76-4 125-19 43 9 83-14 122-13 22-16 44-23 77h535V-30Z" fill="url(#miniBlocks)" opacity=".8"/>
          <defs>
            <pattern id="miniBlocks" width="58" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(-13)">
              <rect x="6" y="5" width="20" height="13" rx="3" fill="#d7e4d5"/>
              <rect x="32" y="6" width="20" height="13" rx="3" fill="#dce7d8"/>
              <rect x="7" y="25" width="19" height="13" rx="3" fill="#e0e8d8"/>
              <rect x="32" y="25" width="20" height="13" rx="3" fill="#d5e2d2"/>
            </pattern>
          </defs>
          <path d="M338 13 706 79M322 102 731 159M303 194 746 237M279 285 765 320M267 362 735 405" stroke="#fffdf5" strokeWidth="5" opacity=".92"/>
          <path d="M390-10 360 430M492-10 466 430M594-10 559 430M687-10 652 430" stroke="#fffdf6" strokeWidth="3" opacity=".8"/>
          <path d="M305 180c-17-29-46-28-57-8-10 18 3 36 22 39 15 2 22-14 35-6 11 7 5 28 17 33 12 5 27-6 26-19-1-17-30-22-43-39Z" fill="#c6dabe"/>
          <text x="72" y="215" fill="#6899a2" fontSize="16" fontWeight="700" letterSpacing="3" transform="rotate(-58 72 215)">GUAÍBA</text>
          <text x="510" y="76" fill="#7d8980" fontSize="10" fontWeight="800" letterSpacing="1.4">4º DISTRITO</text>
          <text x="455" y="183" fill="#7d8980" fontSize="10" fontWeight="800" letterSpacing="1.4">BOM FIM</text>
          <text x="343" y="283" fill="#7d8980" fontSize="10" fontWeight="800" letterSpacing="1.2">CENTRO</text>
          <text x="519" y="314" fill="#7d8980" fontSize="10" fontWeight="800" letterSpacing="1.2">CIDADE BAIXA</text>
          <g transform="translate(478 112)">
            <circle r="18" fill="#f27b59" fillOpacity=".15"/><circle r="10" fill="#f27b59" stroke="#fffefa" strokeWidth="4"/>
            <path d="M0-4v8M-4 0h8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
          </g>
          <g transform="translate(547 252)">
            <circle r="18" fill="#775ec2" fillOpacity=".15"/><circle r="10" fill="#775ec2" stroke="#fffefa" strokeWidth="4"/>
            <path d="m1-5-4 6h4l-1 5 5-7H1l1-4Z" fill="white"/>
          </g>
          <g transform="translate(381 300)">
            <circle r="18" fill="#568c72" fillOpacity=".15"/><circle r="10" fill="#568c72" stroke="#fffefa" strokeWidth="4"/>
            <path d="m0-5 1.4 3.4 3.6.3-2.8 2.2 1 3.5L0 1.5l-3.2 1.9 1-3.5L-5-1.3l3.6-.3L0-5Z" fill="white"/>
          </g>
        </svg>
        <div className="map-chip chip-top"><span className="map-pin-mini">✦</span> Noite Neon <b>R$ 35</b><small>exemplo</small></div>
        <div className="map-chip chip-bottom"><span className="map-pin-mini orange">♪</span> Samba no Pátio <b>R$ 20</b><small>exemplo</small></div>
        <div className="map-scale"><span>○</span> CENTRO HISTÓRICO · CIDADE BAIXA</div>
      </div>
      <div className="preview-footer">
        <span><i className="legend-samba" /> Música ao vivo</span>
        <span><i className="legend-festa" /> Festas</span>
        <span><i className="legend-free" /> De graça</span>
        <span className="demo-caption">Dados fictícios</span>
      </div>
    </div>
  );
}

function SunIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></svg>;
}

function MoonIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.6 8.6 0 1 0 20.5 14.2Z"/></svg>;
}

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const authRef = useRef(null);
  const refreshPromiseRef = useRef(null);
  const [mode, setMode] = useState("register");
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("mdr-theme") || "light"; } catch { return "light"; }
  });
  const [accessToken, setAccessToken] = useState(null);
  const [user, setUser] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("mdr-theme", theme); } catch { /* Theme preference is optional. */ }
  }, [theme]);

  useEffect(() => {
    let active = true;
    async function requestRefresh() {
      const options = {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      };
      let response = await fetch(API_BASE + "/api/auth/refresh", options);
      if (response.status === 409) {
        await new Promise((resolve) => setTimeout(resolve, 180));
        response = await fetch(API_BASE + "/api/auth/refresh", options);
      }
      if (!response.ok) return null;
      return response.json();
    }
    async function refreshAcrossTabs() {
      if (navigator.locks && navigator.locks.request) {
        return navigator.locks.request("mdr-refresh-session", requestRefresh);
      }
      return requestRefresh();
    }

    // Reuse one promise during React Strict Mode's development effect replay.
    if (!refreshPromiseRef.current) refreshPromiseRef.current = refreshAcrossTabs();
    refreshPromiseRef.current
      .then((data) => {
        if (active && data?.accessToken) {
          setAccessToken(data.accessToken);
          setUser(data.user);
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, []);

  function scrollToAuth(nextMode) {
    setMode(nextMode);
    authRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
  }

  function authenticated(token, profile) {
    // Keep short-lived access tokens in React memory only; never localStorage.
    setAccessToken(token);
    setUser(profile);
  }

  async function logout() {
    try {
      await fetch(API_BASE + "/api/auth/logout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
    } finally {
      setAccessToken(null);
      setUser(null);
      setMode("login");
    }
  }

  const introMotion = prefersReducedMotion
    ? { initial: false, animate: { opacity: 1 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.55, ease: "easeOut" } };

  return (
    <div className="app-shell min-h-screen">
      <header className="site-header mx-auto flex items-center justify-between">
        <Logo />
        <nav className="desktop-nav" aria-label="Navegação principal">
          <a href="#como-funciona">Como funciona</a>
          <a href="#porto-alegre">Porto Alegre</a>
        </nav>
        <div className="header-actions flex items-center gap-3">
          <button className="theme-toggle" type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}>
            {theme === "light" ? <MoonIcon /> : <SunIcon />}
          </button>
          <button className="header-login" type="button" onClick={() => scrollToAuth("login")}>Entrar <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <main className="mx-auto page-main">
        <section className="hero-grid" id="porto-alegre">
          <motion.div className="hero-content" {...introMotion}>
            <div className="location-pill"><span className="location-spark">✳</span> PORTO ALEGRE, RS <span className="pill-divider" /> CIDADE PILOTO</div>
            <h1>Teu próximo rolê<br />tá <span className="headline-gradient">mais perto.</span></h1>
            <p className="hero-lede">Descobre festas, shows e eventos pela cidade. Filtra pelo teu estilo e pelo teu bolso — e deixa POA surpreender.</p>
            <div className="hero-ctas">
              <button className="primary-cta" type="button" onClick={() => scrollToAuth("register")}>Criar minha conta <span aria-hidden="true">↗</span></button>
              <a className="text-cta" href="#como-funciona">Conhecer o mapa <span aria-hidden="true">↓</span></a>
            </div>
            <div className="trust-row">
              <span className="trust-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></span>
              <span>Teus dados protegidos.<br /><b>Teus rolês, do teu jeito.</b></span>
            </div>
            <MapPreview />
          </motion.div>

          <div className="auth-column" ref={authRef}>
            <div className="auth-glow" aria-hidden="true" />
            {checkingSession && <span className="session-check" aria-live="polite">Conferindo tua sessão…</span>}
            <AuthPanel mode={mode} setMode={setMode} onAuthenticated={authenticated} user={user} onLogout={logout} />
            <div className="security-caption"><span>●</span> Senhas protegidas com hash Argon2id</div>
            {accessToken && <span className="sr-only" aria-live="polite">Sessão ativa.</span>}
          </div>
        </section>

        <section className="features-section" id="como-funciona" aria-label="Como funciona">
          <div className="feature-intro">
            <span className="section-kicker">MENOS SCROLL. MAIS RUA.</span>
            <h2>A cidade no teu mapa.</h2>
          </div>
          <div className="feature-item">
            <span className="feature-icon map-feature"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15m6-12v15"/></svg></span>
            <div><b>Encontra por perto</b><p>Vê o que está rolando nos bairros de POA.</p></div>
          </div>
          <div className="feature-item">
            <span className="feature-icon price-feature"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 13 12 21l-9-9V3h9l8 8a1.4 1.4 0 0 1 0 2Z"/><circle cx="7.5" cy="7.5" r="1"/></svg></span>
            <div><b>Filtra pelo teu bolso</b><p>Do gratuito ao ingresso que vale a noite.</p></div>
          </div>
          <div className="feature-item">
            <span className="feature-icon vibe-feature"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18m-7-4 14-10M5 7l14 10"/></svg></span>
            <div><b>Escolhe a tua vibe</b><p>Samba, rock, pista ou só um bom encontro.</p></div>
          </div>
        </section>
      </main>
      <footer className="site-footer mx-auto">
        <Logo compact />
        <span>Porto Alegre é só o começo.</span>
        <span className="footer-demo">Prévia visual · Eventos de demonstração</span>
      </footer>
    </div>
  );
}
