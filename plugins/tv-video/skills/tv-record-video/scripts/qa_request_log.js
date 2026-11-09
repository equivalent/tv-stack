// QA video request log. Shows the last 5 same-origin app requests in a
// see-through box in the bottom-right corner: method, path, a short summary of
// what was sent, status and time. Field NAMES only, never values, so no
// customer data lands in the video. It never takes clicks, fades rows after 4 s
// and hides itself after 9 s with no new request.
// The tv-record-video helpers load it as an agent-browser init script and
// inject it again with `eval` after every segment start and full page load
// (sync_badge), because a recording context drops init scripts.
(() => {
  if (window.__qaReqLog || location.protocol === "file:") return;
  window.__qaReqLog = true;
  const MAX = 5, FADE_MS = 4000, HIDE_MS = 9000, STALE_MS = 15000, KEY = "qa-req-log";
  const SKIP = [/^\/assets\//, /^\/ahoy\//, /^\/cable/, /^\/pgbus\/streams\//, /^\/rails\/active_storage\//, /^\/up$/,
    /\.(js|css|map|png|jpe?g|gif|webp|svg|woff2?|ico|json\.map)(\?|$)/];
  const HIDE_FIELDS = new Set(["authenticity_token", "_method", "token", "commit", "utf8", "button"]);
  const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY)) || []; } catch { return []; } };
  const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(rows.slice(-MAX))); } catch {} };
  // Rows from before an explicit jump (a title card, another section) are stale.
  let rows = load().filter(r => Date.now() - r.t < STALE_MS), box, hideTimer, fadeTimer;

  // Path plus query parameter NAMES (values may be search terms or ids).
  const appPath = url => {
    try {
      const u = new URL(url, location.href);
      if (u.origin !== location.origin || SKIP.some(r => r.test(u.pathname))) return null;
      const keys = [...new Set(u.searchParams.keys())].filter(k => !HIDE_FIELDS.has(k));
      // A long token or id in the path keeps its first 8 characters.
      const p = u.pathname.split("/").map(part => (part.length > 24 ? part.slice(0, 8) + "…" : part)).join("/");
      return p + (keys.length ? "?" + keys.join("&") : "");
    } catch { return null; }
  };
  // Rails nesting collapses: invoice[amount], invoice[due_on] -> invoice[amount, due_on]
  const names = keys => {
    const groups = new Map();
    for (const k of keys) {
      if (HIDE_FIELDS.has(k)) continue;
      const m = k.match(/^([^\[]+)\[([^\]]*)\]/);
      const g = m ? m[1] : "", f = m ? m[2] : k;
      if (!groups.has(g)) groups.set(g, new Set());
      if (f) groups.get(g).add(f);
    }
    const short = s => { const a = [...s]; return a.slice(0, 3).join(", ") + (a.length > 3 ? `, +${a.length - 3}` : ""); };
    return [...groups].map(([g, s]) => (g ? `${g}[${short(s)}]` : short(s))).filter(Boolean).join(" ");
  };
  // { verb, note }: verb overrides the HTTP method when Rails' _method says so;
  // a phlex-reactive call shows its action name instead of the signed token.
  const describe = body => {
    if (!body) return {};
    if (body instanceof FormData || body instanceof URLSearchParams) {
      const keys = [...body.keys()], m = body.get("_method"), act = body.get("act");
      if (act) return { note: `${act}  ${names(keys.filter(k => k !== "act"))}`.trim() };
      return { verb: m && String(m).toUpperCase(), note: names(keys) };
    }
    if (typeof body === "string") {
      try {
        const j = JSON.parse(body);
        if (j && j.act) return { note: `${j.act}  ${names(Object.keys(j.params || {}))}`.trim() };
        if (j && typeof j === "object" && !Array.isArray(j)) {
          return { note: names(Object.entries(j).flatMap(([k, v]) =>
            v && typeof v === "object" && !Array.isArray(v) ? Object.keys(v).map(f => `${k}[${f}]`) : [k])) };
        }
        return {};
      } catch {}
      try { return describe(new URLSearchParams(body)); } catch {}
    }
    return {};
  };

  const ensureBox = () => {
    if (box && box.isConnected) return box;
    box = document.createElement("div");
    box.id = "qa-req-log";
    Object.assign(box.style, {
      position: "fixed", right: "16px", bottom: "16px", zIndex: 2147483646, pointerEvents: "none",
      maxWidth: "46vw", font: "500 15px/1.35 'JetBrains Mono','DejaVu Sans Mono',monospace", color: "#e5e7eb",
      background: "rgba(11,16,32,.82)", backdropFilter: "blur(6px)", border: "1px solid rgba(255,255,255,.12)", borderRadius: "8px", padding: "8px 12px", transition: "opacity .6s", opacity: "0",
    });
    document.documentElement.appendChild(box);
    return box;
  };
  const statusColor = s => (typeof s !== "number" ? "#94a3b8" : s < 300 ? "#4ade80" : s < 400 ? "#fbbf24" : "#f87171");
  const render = () => {
    if (!document.documentElement) return;
    const b = ensureBox(), now = Date.now();
    b.textContent = "";
    for (const r of rows) {
      const line = document.createElement("div");
      Object.assign(line.style, { whiteSpace: "pre", overflow: "hidden", textOverflow: "ellipsis",
        opacity: now - r.t > FADE_MS ? ".6" : "1", transition: "opacity .6s" });
      const span = (txt, css) => { const s = document.createElement("span"); s.textContent = txt; Object.assign(s.style, css || {}); line.appendChild(s); };
      span(r.verb.padEnd(7), { color: "#93c5fd", fontWeight: "700" });
      span(r.path);
      if (r.note) span("  " + r.note, { color: "#cbd5e1", opacity: ".8" });
      span("  " + (r.status ?? "…"), { color: statusColor(r.status), fontWeight: "700" });
      if (r.ms != null) span(` ${r.ms}ms`, { color: "#94a3b8" });
      b.appendChild(line);
    }
    b.style.opacity = rows.length ? "1" : "0";
    clearTimeout(hideTimer); hideTimer = setTimeout(() => { b.style.opacity = "0"; }, HIDE_MS);
    clearTimeout(fadeTimer); fadeTimer = setTimeout(render, FADE_MS + 50);
  };
  const add = r => { r.t = Date.now(); rows.push(r); rows = rows.slice(-MAX); save(); if (document.body) render(); return r; };
  const done = (r, status) => { r.status = status; r.ms = Date.now() - r.t; save(); render(); };

  // fetch covers Turbo Drive visits, Turbo form submits, frames, phlex-reactive
  // actions and Stimulus controllers.
  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    init = init || {};
    const url = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const path = appPath(url);
    if (!path) return origFetch.apply(this, arguments);
    const d = describe(init.body);
    const r = add({ verb: d.verb || (init.method || (input && input.method) || "GET").toUpperCase(), path, note: d.note });
    return origFetch.apply(this, arguments).then(res => { done(r, res.status); return res; }, e => { done(r, "ERR"); throw e; });
  };
  const xOpen = XMLHttpRequest.prototype.open, xSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__qa = { m, path: appPath(u) }; return xOpen.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__qa && this.__qa.path) {
      const d = describe(body);
      const r = add({ verb: d.verb || String(this.__qa.m).toUpperCase(), path: this.__qa.path, note: d.note });
      this.addEventListener("loadend", () => done(r, this.status || "ERR"));
    }
    return xSend.apply(this, arguments);
  };
  // A plain (non-Turbo) form submit unloads the page: note it before leaving.
  // The page it lands on adds its own GET row.
  addEventListener("submit", e => {
    const f = e.target;
    if (e.defaultPrevented || (window.Turbo && f.dataset.turbo !== "false")) return;
    const path = appPath(f.action);
    if (!path) return;
    const d = describe(new FormData(f));
    add({ verb: d.verb || (f.method || "GET").toUpperCase(), path, note: d.note, status: "→" });
  }, true);
  // Full page loads (an open, a reload, a plain submit's redirect) show as a GET row.
  const onLoad = () => {
    const nav = performance.getEntriesByType("navigation")[0];
    const path = appPath(location.href);
    if (path) add({ verb: "GET", path, note: nav && nav.type === "reload" ? "reload" : "",
      status: (nav && nav.responseStatus) || 200, ms: nav ? Math.round(nav.responseEnd - nav.requestStart) : null });
    else render();
  };
  // Init script: wait for the DOM. Injected later with `eval` (the recording
  // context drops init scripts): the page is already there, run now.
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", onLoad); else onLoad();
})();
