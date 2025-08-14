/* Shakespeare Pizza — Order Builder (O5)
   Single Pizza builder + cart/totals + tips + qty controls
   + Review -> Netlify submit (kitchen ticket + JSON) + confirmation
*/
(() => {
  const CART_KEY = "sp_cart_v1";
  let MENU = null, CFG = {};

  // ----- helpers -----
  const $  = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));
  const money = (n) => new Intl.NumberFormat("en-CA", {
    style: "currency", currency: (MENU && MENU.currency) || "CAD"
  }).format(isFinite(n) ? n : 0);

  const encode = (data) =>
    Object.keys(data).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(data[k])).join("&");

  // cart state
  const state = { items: [], tip: 0, tipPct: null, taxRate: 0.13 };

  const saveState = () => sessionStorage.setItem(CART_KEY, JSON.stringify(state));
  const loadState = () => {
    try {
      const raw = sessionStorage.getItem(CART_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch {}
  };

  // keep tabs visually "active"
  function setActiveTabFromHash() {
    const hash = location.hash || "#single";
    $$(".tabs .tab").forEach(a => a.setAttribute("aria-current", a.getAttribute("href") === hash ? "true":"false"));
    $$(".tab-panel").forEach(p => p.classList.toggle("is-default", ("#" + p.id) === hash));
  }
  window.addEventListener("hashchange", setActiveTabFromHash);

  // ----- pricing -----
  function calcSinglePrice(sizeId, crustId, toppingIds) {
    const size   = MENU.pizza.sizes.find(s => s.id === sizeId) || MENU.pizza.sizes[2]; // default Large
    const base   = size.base;
    const extra  = MENU.pizza.extraToppingBySize[sizeId];
    const weight = (toppingIds || []).reduce((sum, id) => {
      const t = MENU.pizza.toppings.find(x => x.id === id);
      return sum + (t ? (t.weight || 1) : 1);
    }, 0);
    const crust  = MENU.pizza.crusts.find(c => c.id === crustId);
    const up     = crust ? (crust.upcharge || 0) : 0;
    return +(base + weight * extra + up).toFixed(2);
  }

  // ----- render Single builder -----
  function renderSingleBuilder() {
    const panel = $("#single");
    if (!panel) return;

    const sizeOpts = MENU.pizza.sizes.map(s =>
      `<label class="chip-radio">
         <input type="radio" name="single-size" value="${s.id}" ${s.id === "l" ? "checked" : ""}>
         <span>${s.label} <b>${money(s.base)}</b></span>
       </label>`
    ).join("");

    const crustOpts = MENU.pizza.crusts.map(c => {
      const up = c.upcharge ? ` (+${money(c.upcharge)})` : "";
      return `<label class="chip-radio">
        <input type="radio" name="single-crust" value="${c.id}" ${c.id === "white" ? "checked" : ""}>
        <span>${c.label}${up}</span>
      </label>`;
    }).join("");

    const toppings = MENU.pizza.toppings.map(t =>
      `<label class="chk">
         <input type="checkbox" name="single-topping" value="${t.id}">
         <span>${t.label}${t.weight === 2 ? ' <em class="x2">×2</em>' : ""}</span>
       </label>`
    ).join("");

    const free = (MENU.pizza.freeExtras || []).map(f =>
      `<label class="chk"><input type="checkbox" name="single-free" value="${f}"><span>${f}</span></label>`
    ).join("");

    const builderHTML = `
      <form id="single-form" class="builder">
        <fieldset class="group">
          <legend>Choose a size</legend>
          <div class="chips">${sizeOpts}</div>
        </fieldset>

        <fieldset class="group">
          <legend>Choose a crust</legend>
          <div class="chips">${crustOpts}</div>
        </fieldset>

        <fieldset class="group">
          <legend>Toppings <span class="muted">(items marked ×2 count as two)</span></legend>
          <div class="grid toppings-grid">${toppings}</div>
        </fieldset>

        <fieldset class="group">
          <legend>Free extras</legend>
          <div class="chips chips-wrap">${free}</div>
        </fieldset>

        <div class="builder-actions">
          <label class="qty"><span>Qty</span>
            <input type="number" id="single-qty" min="1" value="1" inputmode="numeric">
          </label>
          <div class="grow"></div>
          <div class="price-preview">Item total: <strong id="single-price"></strong></div>
          <button type="button" id="single-add" class="btn btn-primary">Add to cart</button>
        </div>
      </form>
    `;

    const placeholder = panel.querySelector(".placeholder");
    if (placeholder) placeholder.outerHTML = builderHTML; else panel.insertAdjacentHTML("beforeend", builderHTML);

    const form    = $("#single-form");
    const priceEl = $("#single-price");
    const qtyEl   = $("#single-qty");

    const selection = () => {
      const size     = form.querySelector('input[name="single-size"]:checked')?.value || "l";
      const crust    = form.querySelector('input[name="single-crust"]:checked')?.value || "white";
      const toppings = $$('#single-form input[name="single-topping"]:checked').map(i => i.value);
      const free     = $$('#single-form input[name="single-free"]:checked').map(i => i.value);
      const qty      = Math.max(1, parseInt(qtyEl.value || "1", 10));
      return { size, crust, toppings, free, qty };
    };

    const updatePrice = () => {
      const sel = selection();
      const each = calcSinglePrice(sel.size, sel.crust, sel.toppings);
      priceEl.textContent = money(each * sel.qty);
    };

    form.addEventListener("change", updatePrice);
    qtyEl.addEventListener("input", updatePrice);
    updatePrice();

    $("#single-add").addEventListener("click", () => {
      const sel  = selection();
      const each = calcSinglePrice(sel.size, sel.crust, sel.toppings);

      const line = {
        type: "pizza_single",
        name: `Single Pizza — ${MENU.pizza.sizes.find(s => s.id === sel.size).label}`,
        size: sel.size,
        crust: sel.crust,
        toppings: sel.toppings,
        free: sel.free,
        qty: sel.qty,
        unitPrice: each,
        lineTotal: +(each * sel.qty).toFixed(2)
      };

      state.items.push(line);
      saveState();
      renderCart();

      const status = $("#cart-status");
      if (status) {
        status.textContent = "Added to cart.";
        status.classList.remove("hide");
        setTimeout(() => status.classList.add("hide"), 1200);
      }
    });
  }

  // ----- tips UI -----
  function renderTips() {
    const wrap = $("#tip-buttons");
    if (!wrap) return;
    const opts = (CFG.tipOptions && CFG.tipOptions.length) ? CFG.tipOptions : [0, 0.1, 0.15, 0.18, 0.2];

    wrap.innerHTML = opts.map(pct => {
      const label = pct === 0 ? "No tip" : `${Math.round(pct * 100)}%`;
      return `<button class="chip" data-tip="${pct}">${label}</button>`;
    }).join("");

    const setActive = () => {
      $$("#tip-buttons .chip").forEach(b => b.classList.toggle("active",
        state.tipPct !== null ? (+b.dataset.tip === state.tipPct) : (+b.dataset.tip === 0)
      ));
    };
    setActive();

    $$("#tip-buttons .chip").forEach(btn => {
      btn.addEventListener("click", () => {
        const pct = +btn.dataset.tip;
        state.tipPct = pct;
        state.tip = 0; // ignore fixed tip when percent active
        saveState();
        setActive();
        recalcTotals();
      });
    });

    $("#tip-clear")?.addEventListener("click", () => {
      state.tipPct = 0;
      state.tip = 0;
      saveState();
      setActive();
      recalcTotals();
    });
  }

  // ----- cart UI & totals -----
  function renderCart() {
    const ul = $("#cart-list");
    if (!ul) return;

    if (!state.items.length) {
      ul.innerHTML = `<li class="muted empty">Your cart is empty. <a href="#single">Start with a Single Pizza</a>.</li>`;
    } else {
      ul.innerHTML = state.items.map((it, i) => {
        let details = "";
        if (it.type === "pizza_single") {
          const crust = MENU.pizza.crusts.find(c => c.id === it.crust)?.label || it.crust;
          const tops  = (it.toppings || []).map(id => {
            const t = MENU.pizza.toppings.find(x => x.id === id);
            return t ? `${t.label}${t.weight === 2 ? "(×2)" : ""}` : id;
          }).join(", ") || "Cheese";
          const free  = it.free?.length ? ` • Free: ${it.free.join(", ")}` : "";
          details = `${crust}. Toppings: ${tops}${free}`;
        }
        return `
          <li class="cart-item">
            <div class="row">
              <div class="info">
                <strong>${it.name}</strong>
                <div class="muted micro">${details}</div>
              </div>
              <div class="price">${money(it.lineTotal)}</div>
            </div>
            <div class="row actions">
              <div class="qty-ctrl" aria-label="Change quantity">
                <button class="qty-dec" data-idx="${i}" aria-label="Decrease quantity">−</button>
                <output class="qty-val" id="q-${i}" aria-live="polite">${it.qty}</output>
                <button class="qty-inc" data-idx="${i}" aria-label="Increase quantity">+</button>
              </div>
              <button class="link danger" data-remove="${i}" aria-label="Remove item">Remove</button>
            </div>
          </li>
        `;
      }).join("");
    }

    // qty handlers
    $$("#cart-list .qty-inc").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = +e.currentTarget.dataset.idx;
        const it = state.items[idx];
        it.qty += 1;
        it.lineTotal = +(it.unitPrice * it.qty).toFixed(2);
        saveState();
        renderCart();
      });
    });
    $$("#cart-list .qty-dec").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = +e.currentTarget.dataset.idx;
        const it = state.items[idx];
        it.qty -= 1;
        if (it.qty <= 0) state.items.splice(idx,1);
        else it.lineTotal = +(it.unitPrice * it.qty).toFixed(2);
        saveState();
        renderCart();
      });
    });

    // remove handlers
    $$("#cart-list [data-remove]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const idx = +e.currentTarget.getAttribute("data-remove");
        state.items.splice(idx, 1);
        saveState();
        renderCart();
      });
    });

    recalcTotals();
  }

  function currentTotals() {
    const sub = state.items.reduce((s, it) => s + (it.lineTotal || 0), 0);
    const tip = (state.tipPct !== null) ? +(sub * state.tipPct).toFixed(2) : +(state.tip || 0);
    const tax = +(sub * state.taxRate).toFixed(2);
    const tot = +(sub + tax + tip).toFixed(2);
    return { sub, tax, tip, tot };
  }

  function recalcTotals() {
    const { sub, tax, tip, tot } = currentTotals();
    $("#t-sub").textContent   = money(sub);
    $("#t-tax").textContent   = money(tax);
    $("#t-tip").textContent   = money(tip);
    $("#t-total").textContent = money(tot);
  }

  // ----- Review -> submit -----
  function generateOrderId() {
    const now = new Date();
    const pad = (n) => n.toString().padStart(2,"0");
    const YY = now.getFullYear().toString().slice(-2);
    const MM = pad(now.getMonth()+1);
    const DD = pad(now.getDate());
    const hh = pad(now.getHours());
    const mm = pad(now.getMinutes());
    const rand = Math.floor(Math.random()*9000 + 1000);
    return `SP-${YY}${MM}${DD}-${hh}${mm}-${rand}`;
  }

  function kitchenTicket(order) {
    const sizeLabel = (id) => MENU.pizza.sizes.find(s => s.id === id)?.label || id;
    const crustLabel = (id) => MENU.pizza.crusts.find(c => c.id === id)?.label || id;
    const topLabel = (id) => MENU.pizza.toppings.find(t => t.id === id)?.label || id;

    const lines = [];
    lines.push(`Shakespeare Pizza — NEW PICKUP ORDER ${order.id}  (${order.payment === "online" ? "Paid Online" : "Pay at Pickup"})`);
    lines.push(`Name: ${order.customer.name}   Phone: ${order.customer.phone}   Pickup: ${order.customer.pickup}`);
    if (order.customer.notes) lines.push(`Notes: ${order.customer.notes}`);
    lines.push("");

    order.items.forEach(it => {
      if (it.type === "pizza_single") {
        const tops = (it.toppings||[]).map(t => {
          const tdef = MENU.pizza.toppings.find(x => x.id===t);
          return tdef ? `${tdef.label}${tdef.weight===2?"(×2)":""}` : t;
        }).join(", ") || "Cheese";
        const free = it.free?.length ? `\n   Free: ${it.free.join(", ")}` : "";
        lines.push(`${it.qty}× ${sizeLabel(it.size)} Single Pizza — ${crustLabel(it.crust)}\n   Toppings: ${tops}${free}`);
      } else {
        // future: other item types
        lines.push(`${it.qty}× ${it.name}`);
      }
    });

    lines.push("");
    lines.push(`Subtotal: ${money(order.subTotal)}   ${order.taxName} ${Math.round(order.taxRate*100)}%: ${money(order.tax)}   Tip: ${money(order.tip)}`);
    lines.push(`TOTAL: ${money(order.total)}`);
    return lines.join("\n");
  }

  async function handlePlaceOrder() {
    const status = $("#submit-status");
    const form   = $("#review-form");

    // basic validation
    if (!state.items.length) {
      status.textContent = "Your cart is empty.";
      status.classList.add("err"); status.classList.remove("hide"); return;
    }
    const name  = $("#r-name")?.value.trim() || "";
    const phone = $("#r-phone")?.value.trim() || "";
    const pickup= $("#r-pickup")?.value || "ASAP";
    const notes = $("#r-notes")?.value.trim() || "";

    if (name.length < 2) { status.textContent = "Please enter your name."; status.classList.add("err"); status.classList.remove("hide"); return; }
    const digits = phone.replace(/\D/g,"");
    if (digits.length < 7) { status.textContent = "Please enter a valid phone number."; status.classList.add("err"); status.classList.remove("hide"); return; }

    // payment
    let payment = (document.querySelector('input[name="payment"]:checked')?.value) || "pay_at_pickup";
    const hasCloverLinks = Array.isArray(CFG?.clover?.paymentLinks) && CFG.clover.paymentLinks.some(l => l && l.url);
    if (payment === "online" && !hasCloverLinks) {
      payment = "pay_at_pickup";
      status.textContent = "Online payment isn’t available right now — set to Pay at Pickup.";
      status.classList.remove("err","hide");
      setTimeout(() => status.classList.add("hide"), 1500);
    }

    // build order object
    const id  = generateOrderId();
    const { sub, tax, tip, tot } = currentTotals();
    const payload = {
      id,
      ts: new Date().toISOString(),
      payment,
      customer: { name, phone, pickup, notes },
      items: state.items,
      subTotal: +sub.toFixed(2),
      tax: +tax.toFixed(2),
      tip: +tip.toFixed(2),
      total: +tot.toFixed(2),
      taxRate: state.taxRate,
      taxName: CFG.taxName || "HST",
      currency: (MENU && MENU.currency) || "CAD"
    };

    const ticket = kitchenTicket({
      ...payload,
      taxName: payload.taxName,
      taxRate: payload.taxRate
    });

    // fill hidden Netlify form
    const nf = $("#netlify-order");
    if (!nf) {
      status.textContent = "Form missing. Please call to place order.";
      status.classList.add("err"); status.classList.remove("hide"); return;
    }
    $("#f-order-id").value = id;
    $("#f-payment").value  = payment;
    $("#f-name").value     = name;
    $("#f-phone").value    = phone;
    $("#f-pickup").value   = pickup;
    $("#f-kitchen").value  = ticket;
    $("#f-json").value     = JSON.stringify(payload, null, 2);

    // send
    status.textContent = "Sending…";
    status.classList.remove("err"); status.classList.remove("hide");

    try {
      // Build x-www-form-urlencoded body from FormData for Netlify
      const fd = new FormData(nf);
      const body = {};
      fd.forEach((v, k) => { body[k] = v; });
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode(body)
      });

      // success -> clear cart, show confirmation
      state.items = [];
      saveState();
      renderCart();

      // Confirmation text
      const details = $("#confirm-details");
      if (details) {
        const when = pickup === "ASAP" ? "ASAP" : `in ~${pickup} min`;
        details.textContent = `Order ${id}. Pickup: ${when}. If anything changes, call ${CFG.phone || "226-648-8888"}.`;
      }
      location.hash = "#confirm";
      status.textContent = "Order sent!";
      status.classList.remove("err");
      setTimeout(() => status.classList.add("hide"), 1200);
    } catch (e) {
      console.error(e);
      status.textContent = `Sorry, we couldn’t send the order. Please call ${CFG.phone || "226-648-8888"}.`;
      status.classList.add("err");
    }
  }

  // ----- init -----
  async function init() {
    setActiveTabFromHash();

    // load config + menu (relative from /order/)
    try { CFG = await loadJSON("../data/config.json"); } catch {}
    try { MENU = await loadJSON("../data/menu.json"); }
    catch { MENU = await loadJSON("data/menu.json"); }

    state.taxRate = (typeof CFG.taxRate === "number") ? CFG.taxRate : 0.13;

    // dynamic tax label (Ontario default HST)
    const taxPct = Math.round(state.taxRate * 100);
    const taxName = CFG.taxName || "HST";
    const tl = $("#tax-label");
    if (tl) tl.textContent = `${taxName} (${taxPct}%)`;

    loadState();
    renderSingleBuilder();
    renderTips();
    renderCart();

    // Review -> Place Order
    $("#place-order")?.addEventListener("click", handlePlaceOrder);
  }

  document.addEventListener("DOMContentLoaded", init);
})();