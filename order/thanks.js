// order/thanks.js
(async () => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // Load config for tax name/rate + clover links
  let CFG = {};
  try { CFG = await loadJSON("../data/config.json"); } catch {}

  const raw = sessionStorage.getItem("sp_last_order");
  if (!raw) {
    $("#t-missing")?.classList.remove("hide");
    return;
  }

  const data = JSON.parse(raw);
  const nf = new Intl.NumberFormat("en-CA", { style:"currency", currency: data.currency || "CAD" });
  const m  = (n) => nf.format(Number(n || 0));
  const taxName = CFG.taxName || "HST";
  const taxPct  = Math.round((CFG.taxRate ?? 0.13) * 100);

  // Meta line: Order #, pickup info, placed time
  const placed = new Date(data.createdAt);
  const time   = placed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const pickup = data.pickup === "ASAP" ? "ASAP" : `~${data.pickup} min`;
  $("#t-meta").textContent =
    `Order ${data.id}. Pickup: ${pickup}. Placed at ${time}. If anything changes, call ${data.phone}.`;

  // Items list (simple)
  const itemsHTML = (data.items || []).map(it => {
    const details = it.type === "pizza_single"
      ? (() => {
          const tops = (it.toppings || []).join(", ") || "Cheese";
          const free = it.free?.length ? ` • Free: ${it.free.join(", ")}` : "";
          return ` — ${it.size.toUpperCase()}, ${it.crust}${free ? free : ""} • ${tops}`;
        })()
      : (it.type === "pizza_double"
          ? ` — Double (${it.size.toUpperCase()})`
          : (it.details ? ` — ${it.details}` : ""));

    return `<li><span class="qty">${it.qty}×</span> <span class="name">${it.name}</span><span class="details">${details}</span><span class="price">${m(it.lineTotal)}</span></li>`;
  }).join("");
  $("#t-items").innerHTML = itemsHTML;

  // Totals
  $("#tt-sub").textContent = m(data.totals.sub);
  $("#tt-tax").textContent = m(data.totals.tax);
  $("#tt-tip").textContent = m(data.totals.tip);
  $("#tt-total").textContent = m(data.totals.tot);
  $("#tt-tax-label").textContent = `${taxName} (${taxPct}%)`;

  // If pay=1 in URL and we have Clover links, render buttons
  const params = new URLSearchParams(location.search);
  const wantsPay = params.get("pay") === "1";
  const links = (CFG?.clover?.paymentLinks || []).filter(l => l && l.url);

  if (wantsPay && links.length) {
    $("#t-pay-note").classList.remove("hide");
    const wrap = $("#t-pay");
    wrap.innerHTML = links.map((l, i) =>
      `<a class="btn ${i===0?'btn-primary':'btn-quiet'}" href="${l.url}" target="_blank" rel="noopener">${l.label || "Pay online"}</a>`
    ).join("");
    wrap.classList.remove("hide");
  }
})();