/* ---------- Shakespeare Pizza — Global Scripts ---------- */

// Tiny DOM helpers
const $  = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

// 1) Footer year
(() => {
  const y = $("#year");
  if (y) y.textContent = new Date().getFullYear();
})();

// 2) Mobile nav toggle (accessibility-friendly)
(() => {
  const nav = $(".site-nav");
  const btn = $(".nav-toggle");
  const menu = $("#nav-menu");
  if (!nav || !btn || !menu) return;

  btn.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
  // Close menu when a link is clicked
  $$("#nav-menu a").forEach(a =>
    a.addEventListener("click", () => {
      nav.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    })
  );
})();

// 3) Hours “Open now” helper (we’ll attach to UI when we build the Hours section)
async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load ${path}`);
  return res.json();
}

/**
 * Compute open/closed based on hours.json and a timezone.
 * hours format: { mon:["11:00-20:00"], tue:[...], ... }
 */
function isOpenNow(hours, tz = "America/Toronto") {
  const days = ["sun","mon","tue","wed","thu","fri","sat"];
  // Current time in target timezone
  const now = new Date(new Date().toLocaleString("en-CA", { timeZone: tz }));
  const dayKey = days[now.getDay()];
  const minsNow = now.getHours() * 60 + now.getMinutes();

  const ranges = (hours[dayKey] || []).map(r => r.split("-"));
  let open = false;
  for (const [start, end] of ranges) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    if (minsNow >= s && minsNow < e) { open = true; break; }
  }
  return open;
}

// Example attach function we’ll call once the Hours section exists
async function updateOpenBadge() {
  const badge = $("#open-badge"); // <span id="open-badge"></span> later
  if (!badge) return;
  try {
    const hours = await loadJSON("/data/hours.json");
    const open = isOpenNow(hours, hours.timezone || "America/Toronto");
    badge.textContent = open ? "Open now" : "Closed";
    badge.classList.toggle("hide", false);
    badge.setAttribute("aria-live", "polite");
  } catch (e) {
    console.error(e);
  }
}
// Call later when Hours UI is added
// updateOpenBadge();

// 4) (Optional) Pull config for analytics or contact autowire later
async function applyConfig() {
  try {
    const cfg = await loadJSON("/data/config.json");
    // Example: update tel/email in footer if we want dynamic wiring
    const tel = cfg.phone?.replace(/\D/g, "");
    if (tel) $$('a[href^="tel:"]').forEach(a => (a.href = `tel:${tel}`, a.textContent = cfg.phone));
    if (cfg.email) {
      const mailLink = $('a[href^="mailto:"]');
      if (mailLink) { mailLink.href = `mailto:${cfg.email}`; mailLink.textContent = cfg.email; }
    }
    // If you want to dynamically inject analytics later, use cfg.analytics.* here.
  } catch (e) {
    // Safe to ignore if config not present yet
  }
}
applyConfig();
