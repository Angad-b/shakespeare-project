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
  // If we're in a subdirectory (like /order/), adjust path for data files
  if (!path.startsWith("/") && window.location.pathname.split("/").length > 2 && path.startsWith("data/")) {
    path = "../" + path;
  }
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
  const ids = ["open-badge", "open-badge-footer"];
  try {
    const H = await loadHours();
    const s = computeOpenStatus(H);
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle('closed', !s.open);
      el.textContent = s.open
        ? `Open now • Today ${s.todayLabel}`
        : `Closed • Opens ${s.nextLabel}`;
      el.classList.remove("hide");
      el.setAttribute("aria-live", "polite");
    });
  } catch (e) { console.warn('updateOpenBadge()', e); }
}

// Call later when Hours UI is added
// updateOpenBadge();

// 4) (Optional) Pull config for analytics or contact autowire later
async function applyConfig() {
  try {
    const cfg = await loadJSON("data/config.json"); // use relative path
    const tel = cfg.phone?.replace(/\D/g, "");
    if (tel) $$('a[href^="tel:"]').forEach(a => (a.href = `tel:${tel}`, a.textContent = cfg.phone));
    if (cfg.email) {
      const mailLink = $('a[href^="mailto:"]');
      if (mailLink) { mailLink.href = `mailto:${cfg.email}`; mailLink.textContent = cfg.email; }
    }
    // wire "Open on Google"
    if (cfg.map?.googleMapsUrl) {
      $$('[data-google-link]').forEach(a => a.href = cfg.map.googleMapsUrl);
    }

    // NEW: set iframe data-src to an embed-friendly URL
    const toEmbed = (u) => {
      if (!u) return "https://www.google.com/maps?q=2264+Line+34,+Unit+2,+Shakespeare,+ON&output=embed";
      // add output=embed if missing
      return u.includes("output=embed")
        ? u
        : u + (u.includes("?") ? "&" : "?") + "output=embed";
    };
    const iframe = document.getElementById("gmap");
    if (iframe) iframe.dataset.src = toEmbed(cfg.map?.googleMapsUrl);
  } catch (e) {}
}
applyConfig();


// Render weekly hours into #hours-table from data/hours.json
async function renderHours() {
  const tbody = $("#hours-table");
  if (!tbody) return;
  try {
    const hours = await loadJSON("data/hours.json"); // relative path
    const order = ["mon","tue","wed","thu","fri","sat","sun"];
    const labels = { mon:"Monday", tue:"Tuesday", wed:"Wednesday", thu:"Thursday", fri:"Friday", sat:"Saturday", sun:"Sunday" };

    // Current day index in supplied timezone
    const now = new Date(new Date().toLocaleString("en-CA", { timeZone: hours.timezone || "America/Toronto" }));
    const todayKey = ["sun","mon","tue","wed","thu","fri","sat"][now.getDay()];
    // ... inside renderHours(), after todayKey is set
    const todayRanges = (hours[todayKey] || []).join(", ") || "Closed";
    const todayEl = document.getElementById("today-hours");
    if (todayEl) todayEl.textContent = todayRanges;

    tbody.innerHTML = order.map(key => {
      const ranges = (hours[key] || []).join(", ");
      const label  = labels[key];
      const rowCls = key === todayKey ? "today" : "";
      return `<tr class="${rowCls}">
        <th scope="row">${label}</th>
        <td>${ranges || "<span class='muted'>Closed</span>"}</td>
      </tr>`;
    }).join("");

    // Update badge and schedule a minute-based refresh
    updateOpenBadge();
    if (!window.__hoursTick) {
      window.__hoursTick = setInterval(updateOpenBadge, 60_000);
    }
  } catch (e) {
    console.error(e);
  }
}

// Kick it off on load
renderHours();

async function loadHours() {
  return loadJSON("/data/hours.json"); // root-absolute so it works on all pages
}
function normalizeHours(hours) {
  const src = hours || {};
  const out = { ...src };
  const map = {
    monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu',
    friday: 'fri', saturday: 'sat', sunday: 'sun'
  };
  for (const k of Object.keys(src)) {
    const clean = k.toLowerCase().trim();
    const short = map[clean] || clean;
    if (!out[short]) out[short] = src[k];
  }
  return out;
}

function _parseHHMM(s) {
  let [h, m] = String(s).split(":").map(Number);
  if (Number.isNaN(h)) h = 0;
  if (Number.isNaN(m)) m = 0;
  // Treat 24:00 as 23:59 so comparisons/formatting are sane
  if (h === 24 && m === 0) { h = 23; m = 59; }
  return h * 60 + m;
}

function _fmtTime(mins, tz) {
  // Format minutes as a local store time (hours.json is already in store TZ).
  // No timezone conversion; just pretty 12-hour clock.
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = (h % 12) || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// Get "today" and current minutes in the target timezone safely (no string parsing)
function nowInTZ(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(new Date());
  const get = t => parts.find(p => p.type === t)?.value || '';
  const dayKey = get('weekday').toLowerCase().slice(0,3); // mon,tue,wed...
  const minsNow = (parseInt(get('hour'),10) || 0) * 60 + (parseInt(get('minute'),10) || 0);
  return { dayKey, minsNow };
}

function computeOpenStatus(hours) {
  hours = normalizeHours(hours); // supports "fri" or "friday"
  const tz = hours.timezone || 'America/Toronto';
  const days = ['sun','mon','tue','wed','thu','fri','sat'];

  const { dayKey, minsNow } = nowInTZ(tz);
  const idxToday = days.indexOf(dayKey);

  const split = (rng) => rng.split(/[-–]/).map(_parseHHMM);    // supports "-" or "–"
  const rangesFor = (key) => (hours[key] || []).map(split).filter(([s,e]) => e > s);

  const todayRanges = rangesFor(dayKey);
  const openNow = todayRanges.some(([s,e]) => minsNow >= s && minsNow < e);

  // Find next opening
  let nextOpen = null;
  // later today
  for (const [s] of todayRanges) { if (minsNow < s) { nextOpen = { dayKey, mins: s }; break; } }
  // next days
  if (!nextOpen) {
    for (let add=1; add<=7; add++) {
      const di = (idxToday + add) % 7;
      const k = days[di];
      const r = rangesFor(k);
      if (r.length) { nextOpen = { dayKey: k, mins: r[0][0] }; break; }
    }
  }

  // Labels
  const fmtRange = ([s,e]) => `${_fmtTime(s,tz)}–${_fmtTime(e,tz)}`;
  const todayLabel = todayRanges.map(fmtRange).join(', ');
  let nextLabel = 'Check hours';
  if (nextOpen) {
    const t = _fmtTime(nextOpen.mins, tz);
    nextLabel = (nextOpen.dayKey === dayKey)
      ? t
      : `${nextOpen.dayKey[0].toUpperCase()}${nextOpen.dayKey.slice(1)} ${t}`;
  }

  return { open: openNow, nextLabel, todayLabel, tz };
}

// Google Reviews toggle
(() => {
  const btn  = document.getElementById("toggle-google");
  const list = document.getElementById("google-list");
  if (!btn || !list) return;
  btn.addEventListener("click", () => {
    const open = !list.classList.toggle("hide"); // true when list is visible
    btn.setAttribute("aria-expanded", String(open));
    btn.textContent = open ? "Hide Google Reviews" : "Show Google Reviews";
  });
})();

// Reveal-on-scroll for elements with .reveal
(() => {
  const els = $$(".reveal");
  if (!("IntersectionObserver" in window) || !els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add("reveal-in");
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });
  els.forEach(el => io.observe(el));
})();

// AJAX submit for #contact-form (Netlify-ready)
(() => {
  const form   = document.getElementById("contact-form");
  const status = document.getElementById("cf-status");
  if (!form || !status) return;

  const encode = (data) =>
    Object.keys(data)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(data[k]))
      .join("&");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.classList.remove("ok","err","hide");
    status.textContent = "Sending…";

    const dataObj = Object.fromEntries(new FormData(form));
    const body = encode({ "form-name": form.getAttribute("name") || "contact", ...dataObj });

    try {
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
      });
      status.textContent = "Thanks! We’ll reply by email soon.";
      status.classList.add("ok");
      form.reset();
    } catch {
      status.textContent = "Sorry, something went wrong. Please call 226-648-8888.";
      status.classList.add("err");
    }
  });
})();

// Lazy load map when visible or when user clicks "Load interactive map"
(() => {
  const wrap = document.querySelector(".map-wrap");
  const iframe = document.getElementById("gmap");
  const btn = document.getElementById("load-map");
  if (!wrap || !iframe) return;

  const load = () => {
    if (iframe.src) return;
    const src = iframe.dataset.src || "https://www.google.com/maps?q=2264+Line+34,+Unit+2,+Shakespeare,+ON&output=embed";
    iframe.src = src;
    wrap.classList.add("map-loaded");
  };

  btn?.addEventListener("click", load);

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { load(); io.disconnect(); } });
    }, { rootMargin: "150px" });
    io.observe(wrap);
  }
})();

updateOpenBadge();