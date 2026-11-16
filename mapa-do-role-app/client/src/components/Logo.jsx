export default function Logo({ compact = false }) {
  return (
    <a className={"brand" + (compact ? " brand-compact" : "")} href="/" aria-label="Mapa do Rolê">
      <img src="/logo.svg" width="38" height="38" alt="" />
      <span className="brand-wordmark">mapa<span>.</span>do rolê</span>
    </a>
  );
}
