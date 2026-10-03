// Seul point d'enregistrement du service worker hors ligne (jamais en aperçu/dev).
export function registerClarioSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const h = location.hostname;
  const refused = !import.meta.env.PROD || window.self !== window.top
    || h.startsWith("id-preview--") || h.startsWith("preview--")
    || h === "lovableproject.com" || h.endsWith(".lovableproject.com")
    || h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com")
    || h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev")
    || new URLSearchParams(location.search).get("sw") === "off";
  if (refused) {
    void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => { if (r.active?.scriptURL.endsWith("/sw.js")) void r.unregister(); }));
    return;
  }
  void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
}
