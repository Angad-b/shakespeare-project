/* Shakespeare Pizza — Order Builder (O6)
   O3–O5 features + Double Deal, Specials, Subs, Wings, Nuggets, Salads, Sides, Drinks
   Pricing driven by /data/menu.json
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
  const loadState = () => { try { const raw = sessionStorage.getItem(CART_KEY); if (raw) Object.assign(state, JSON.parse(raw)); } catch {} };

  // keep tabs visually "active"
  function setActiveTabFromHash() {
    const hash = location.hash || "#single";
    $$(".tabs .tab").forEach(a => a.setAttribute("aria-current", a.getAttribute("href") === hash ? "true":"false"));
    $$(".tab-panel").forEach(p => p.classList.toggle("is-default", ("#" + p.id) === hash));
  }
  window.addEventListener("hashchange", setActiveTabFromHash);

  // ----- pricing helpers -----
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

  function calcDoublePrice(sizeId, toppingIds) {
    const base  = MENU.pizza.doubleDeal.twoCheeseBySize[sizeId];
    const extra = MENU.pizza.doubleDeal.extraToppingBothBySize[sizeId];
    const weight = (toppingIds || []).reduce((sum, id) => {
      const t = MENU.pizza.toppings.find(x => x.id === id);
      return sum + (t ? (t.weight || 1) : 1);
    }, 0);
    return +(base + weight * extra).toFixed(2); // toppings apply to BOTH pizzas
  }

  // ----- render SINGLE -----
  function renderSingleBuilder() {
    const panel = $("#single"); if (!panel) return;

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

    const html = `
      <form id="single-form" class="builder">
        <fieldset class="group"><legend>Choose a size</legend><div class="chips">${sizeOpts}</div></fieldset>
        <fieldset class="group"><legend>Choose a crust</legend><div class="chips">${crustOpts}</div></fieldset>
        <fieldset class="group"><legend>Toppings <span class="muted">(×2 count as two)</span></legend><div class="grid toppings-grid">${toppings}</div></fieldset>
        <fieldset class="group"><legend>Free extras</legend><div class="chips chips-wrap">${free}</div></fieldset>
        <div class="builder-actions">
          <label class="qty"><span>Qty</span><input type="number" id="single-qty" min="1" value="1" inputmode="numeric"></label>
          <div class="grow"></div>
          <div class="price-preview">Item total: <strong id="single-price"></strong></div>
          <button type="button" id="single-add" class="btn btn-primary">Add to cart</button>
        </div>
      </form>`;

    (panel.querySelector(".placeholder") || {}).outerHTML = html;

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
      state.items.push({
        type: "pizza_single",
        name: `Single Pizza — ${MENU.pizza.sizes.find(s => s.id === sel.size).label}`,
        size: sel.size, crust: sel.crust,
        toppings: sel.toppings, free: sel.free,
        qty: sel.qty, unitPrice: each, lineTotal: +(each * sel.qty).toFixed(2)
      });
      saveState(); renderCart(); flashAdded();
    });
  }

  // ----- render DOUBLE DEAL (toppings apply to both pizzas) -----
  function renderDoubleBuilder() {
    const panel = $("#double"); if (!panel) return;
    const sizes = Object.keys(MENU.pizza.doubleDeal.twoCheeseBySize);
    const sizeLabels = MENU.pizza.sizes.reduce((acc,s)=> (acc[s.id]=s.label, acc), {});
    const sizeOpts = sizes.map(id => {
      const base = MENU.pizza.doubleDeal.twoCheeseBySize[id];
      return `<label class="chip-radio">
        <input type="radio" name="double-size" value="${id}" ${id==="l"?"checked":""}>
        <span>${sizeLabels[id] || id} <b>${money(base)}</b></span>
      </label>`;
    }).join("");

    const toppings = MENU.pizza.toppings.map(t =>
      `<label class="chk"><input type="checkbox" name="double-topping" value="${t.id}">
        <span>${t.label}${t.weight===2?' <em class="x2">×2</em>':""}</span></label>`
    ).join("");

    const html = `
      <form id="double-form" class="builder">
        <fieldset class="group"><legend>Choose a size (two pizzas)</legend><div class="chips">${sizeOpts}</div></fieldset>
        <fieldset class="group"><legend>Toppings for both</legend><div class="grid toppings-grid">${toppings}</div></fieldset>
        <div class="builder-actions">
          <label class="qty"><span>Qty</span><input type="number" id="double-qty" min="1" value="1" inputmode="numeric"></label>
          <div class="grow"></div>
          <div class="price-preview">Item total: <strong id="double-price"></strong></div>
          <button type="button" id="double-add" class="btn btn-primary">Add to cart</button>
        </div>
      </form>`;
    (panel.querySelector(".placeholder") || {}).outerHTML = html;

    const priceEl = $("#double-price");
    const qtyEl   = $("#double-qty");
    const selection = () => {
      const size     = $('input[name="double-size"]:checked')?.value || "l";
      const toppings = $$('input[name="double-topping"]:checked').map(i=>i.value);
      const qty      = Math.max(1, parseInt(qtyEl.value || "1", 10));
      return { size, toppings, qty };
    };
    const updatePrice = () => {
      const sel = selection();
      const each = calcDoublePrice(sel.size, sel.toppings);
      priceEl.textContent = money(each * sel.qty);
    };
    $("#double-form").addEventListener("change", updatePrice);
    qtyEl.addEventListener("input", updatePrice);
    updatePrice();

    $("#double-add").addEventListener("click", () => {
      const sel = selection();
      const each = calcDoublePrice(sel.size, sel.toppings);
      const sizeLabel = MENU.pizza.sizes.find(s=>s.id===sel.size)?.label || sel.size;
      state.items.push({
        type: "pizza_double",
        name: `Double Deal — ${sizeLabel}`,
        size: sel.size, toppings: sel.toppings,
        qty: sel.qty, unitPrice: each, lineTotal: +(each * sel.qty).toFixed(2)
      });
      saveState(); renderCart(); flashAdded();
    });
  }

  // ----- render SPECIALS (Large default, upgrade to XL +$2) -----
  function renderSpecials() {
    const panel = $("#specials"); if (!panel) return;
    const cards = MENU.pizza.specialsLarge.map(sp => `
      <article class="card special">
        <h3>${sp.label}</h3>
        <p class="muted micro">${(sp.items||[]).map(id => MENU.pizza.toppings.find(t=>t.id===id)?.label || id).join(", ")}</p>
        <div class="add-row">
          <label class="chk"><input type="checkbox" data-upgrade="${sp.id}"><span>Upgrade to XL (+${money(MENU.pizza.specialsUpgradeXL)})</span></label>
          <label class="qty"><span>Qty</span><input type="number" min="1" value="1" data-qty="${sp.id}" inputmode="numeric"></label>
          <button class="btn btn-primary" data-add-special="${sp.id}" type="button">Add</button>
          <div class="price micro muted">Large: ${money(sp.price)}</div>
        </div>
      </article>
    `).join("");

    (panel.querySelector(".placeholder") || {}).outerHTML = `<div class="item-grid">${cards}</div>`;

    $$('[data-add-special]').forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.addSpecial;
        const sp = MENU.pizza.specialsLarge.find(x=>x.id===id);
        const qty = Math.max(1, parseInt($(`[data-qty="${id}"]`).value || "1", 10));
        const up  = $(`[data-upgrade="${id}"]`).checked;
        const unit = +(sp.price + (up ? MENU.pizza.specialsUpgradeXL : 0)).toFixed(2);
        state.items.push({
          type: "special",
          name: `${sp.label} — ${up ? "XL" : "Large"}`,
          specialId: id, size: up ? "xl" : "l",
          qty, unitPrice: unit, lineTotal: +(unit * qty).toFixed(2)
        });
        saveState(); renderCart(); flashAdded();
      });
    });
  }

  // ----- render SUBS -----
  function renderSubs() {
    const panel = $("#subs"); if (!panel) return;
    const baseSubs = MENU.subs.filter(s => !s.addon);
    const opts = baseSubs.map(s =>
      `<label class="chip-radio">
        <input type="radio" name="sub-type" value="${s.id}" ${s.id===baseSubs[0].id?"checked":""}>
        <span>${s.label} <b>${money(s.price)}</b></span>
      </label>`).join("");

    const html = `
      <form id="subs-form" class="builder">
        <fieldset class="group"><legend>Choose a sub</legend><div class="chips">${opts}</div></fieldset>
        <fieldset class="group"><legend>Add-ons</legend>
          <div class="chips chips-wrap">
            <label class="chk"><input type="checkbox" id="sub-extra-meat"><span>Extra Meat (+${money(1)})</span></label>
            <label class="chk"><input type="checkbox" id="sub-extra-cheese"><span>Extra Cheese (+${money(1)})</span></label>
            <label class="chk"><input type="checkbox" id="sub-toasted"><span>Toasted</span></label>
          </div>
        </fieldset>
        <div class="builder-actions">
          <label class="qty"><span>Qty</span><input type="number" id="subs-qty" min="1" value="1" inputmode="numeric"></label>
          <div class="grow"></div>
          <button type="button" id="subs-add" class="btn btn-primary">Add to cart</button>
        </div>
      </form>`;
    (panel.querySelector(".placeholder") || {}).outerHTML = html;

    $("#subs-add").addEventListener("click", () => {
      const id  = $('input[name="sub-type"]:checked').value;
      const def = MENU.subs.find(s=>s.id===id);
      const qty = Math.max(1, parseInt($("#subs-qty").value || "1", 10));
      const addMeat = $("#sub-extra-meat").checked;
      const addChe  = $("#sub-extra-cheese").checked;
      const toasted = $("#sub-toasted").checked;
      const unit = +(def.price + (addMeat?1:0) + (addChe?1:0)).toFixed(2);
      const notes = `${toasted?"Toasted":"Not toasted"}${addMeat?" • +Extra Meat":""}${addChe?" • +Extra Cheese":""}`;
      state.items.push({
        type: "sub", name: def.label, qty,
        toasted, addMeat, addChe,
        unitPrice: unit, lineTotal: +(unit * qty).toFixed(2),
        details: notes
      });
      saveState(); renderCart(); flashAdded();
    });
  }

  // ----- render WINGS -----
  function renderWings() {
    const panel = $("#wings"); if (!panel) return;
    const sizeOpts = MENU.wings.sizes.map(s =>
      `<label class="chip-radio">
        <input type="radio" name="wings-size" value="${s.id}" ${s.id===MENU.wings.sizes[0].id?"checked":""}>
        <span>${s.label} <b>${money(s.price)}</b></span>
      </label>`).join("");

    const flavourOpts = MENU.wings.flavours.map(f => `<option value="${f}">${f}</option>`).join("");

    const html = `
      <form id="wings-form" class="builder">
        <fieldset class="group"><legend>Choose a size</legend><div class="chips">${sizeOpts}</div></fieldset>
        <fieldset class="group"><legend>Flavour</legend><select id="wings-flavour">${flavourOpts}</select></fieldset>
        <fieldset class="group"><legend>Dips <span class="muted">(${money(MENU.wings.dippingSauce)} each)</span></legend>
          <label class="qty"><span>Qty</span><input type="number" id="wings-dips" min="0" value="0" inputmode="numeric"></label>
        </fieldset>
        <div class="builder-actions">
          <label class="qty"><span>Qty</span><input type="number" id="wings-qty" min="1" value="1" inputmode="numeric"></label>
          <div class="grow"></div>
          <button type="button" id="wings-add" class="btn btn-primary">Add to cart</button>
        </div>
      </form>`;
    (panel.querySelector(".placeholder") || {}).outerHTML = html;

    $("#wings-add").addEventListener("click", () => {
      const sizeId = $('input[name="wings-size"]:checked').value;
      const size   = MENU.wings.sizes.find(s=>s.id===sizeId);
      const flavour= $("#wings-flavour").value;
      const dips   = Math.max(0, parseInt($("#wings-dips").value || "0", 10));
      const qty    = Math.max(1, parseInt($("#wings-qty").value || "1", 10));
      const unit   = +(size.price + dips * MENU.wings.dippingSauce).toFixed(2);
      state.items.push({
        type:"wings", name:`Wings — ${size.label} • ${flavour}`,
        flavour, size:sizeId, dips, qty,
        unitPrice: unit, lineTotal: +(unit * qty).toFixed(2)
      });
      saveState(); renderCart(); flashAdded();
    });
  }

  // ----- render NUGGETS -----
  function renderNuggets() {
    const panel = $("#nuggets"); if (!panel) return;
    const sizeOpts = MENU.nuggets.sizes.map(s =>
      `<label class="chip-radio">
        <input type="radio" name="nuggets-size" value="${s.id}" ${s.id===MENU.nuggets.sizes[0].id?"checked":""}>
        <span>${s.label} <b>${money(s.price)}</b></span>
      </label>`).join("");

    const html = `
      <form id="nuggets-form" class="builder">
        <fieldset class="group"><legend>Choose a size</legend><div class="chips">${sizeOpts}</div></fieldset>
        <div class="builder-actions">
          <label class="qty"><span>Qty</span><input type="number" id="nuggets-qty" min="1" value="1" inputmode="numeric"></label>
          <div class="grow"></div>
          <button type="button" id="nuggets-add" class="btn btn-primary">Add to cart</button>
        </div>
      </form>`;
    (panel.querySelector(".placeholder") || {}).outerHTML = html;

    $("#nuggets-add").addEventListener("click", () => {
      const sizeId = $('input[name="nuggets-size"]:checked').value;
      const size   = MENU.nuggets.sizes.find(s=>s.id===sizeId);
      const qty    = Math.max(1, parseInt($("#nuggets-qty").value || "1", 10));
      const unit   = size.price;
      state.items.push({
        type:"nuggets", name:`Nuggets — ${size.label}`,
        size:sizeId, qty, unitPrice: unit, lineTotal: +(unit * qty).toFixed(2)
      });
      saveState(); renderCart(); flashAdded();
    });
  }

  // ----- render SALADS -----
  function renderSalads() {
    const panel = $("#salads"); if (!panel) return;
    const base = MENU.salads.filter(s=>!s.addon);
    const opts = base.map(s =>
      `<label class="chip-radio">
        <input type="radio" name="salad-type" value="${s.id}" ${s.id===base[0].id?"checked":""}>
        <span>${s.label} <b>${money(s.price)}</b></span>
      </label>`).join("");

    const addChicken = MENU.salads.find(s=>s.addon && s.id==="add_chicken");

    const html = `
      <form id="salads-form" class="builder">
        <fieldset class="group"><legend>Choose a salad</legend><div class="chips">${opts}</div></fieldset>
        <fieldset class="group"><legend>Add-ons</legend>
          <label class="chk"><input type="checkbox" id="salad-addch"><span>Add Grilled Chicken (+${money(addChicken.price)})</span></label>
        </fieldset>
        <div class="builder-actions">
          <label class="qty"><span>Qty</span><input type="number" id="salads-qty" min="1" value="1" inputmode="numeric"></label>
          <div class="grow"></div>
          <button type="button" id="salads-add" class="btn btn-primary">Add to cart</button>
        </div>
      </form>`;
    (panel.querySelector(".placeholder") || {}).outerHTML = html;

    $("#salads-add").addEventListener("click", () => {
      const id  = $('input[name="salad-type"]:checked').value;
      const def = MENU.salads.find(s=>s.id===id);
      const qty = Math.max(1, parseInt($("#salads-qty").value || "1", 10));
      const add = $("#salad-addch").checked;
      const up  = add ? (MENU.salads.find(s=>s.id==="add_chicken")?.price || 0) : 0;
      const unit = +(def.price + up).toFixed(2);
      state.items.push({
        type:"salad", name: def.label + (add?" (+Chicken)":""),
        qty, unitPrice: unit, lineTotal: +(unit * qty).toFixed(2)
      });
      saveState(); renderCart(); flashAdded();
    });
  }

  // ----- render SIDES -----
  function renderSides() {
    const panel = $("#sides"); if (!panel) return;
    const base = MENU.sides;
    const opts = base.map(s =>
      `<label class="chip-radio">
        <input type="radio" name="side-type" value="${s.id}" ${s.id===base[0].id?"checked":""}>
        <span>${s.label} <b>${money(s.price)}</b></span>
      </label>`).join("");

    const html = `
      <form id="sides-form" class="builder">
        <fieldset class="group"><legend>Choose a side</legend><div class="chips">${opts}</div></fieldset>
        <div class="builder-actions">
          <label class="qty"><span>Qty</span><input type="number" id="sides-qty" min="1" value="1" inputmode="numeric"></label>
          <div class="grow"></div>
          <button type="button" id="sides-add" class="btn btn-primary">Add to cart</button>
        </div>
      </form>`;
    (panel.querySelector(".placeholder") || {}).outerHTML = html;

    $("#sides-add").addEventListener("click", () => {
      const id  = $('input[name="side-type"]:checked').value;
      const def = MENU.sides.find(s=>s.id===id);
      const qty = Math.max(1, parseInt($("#sides-qty").value || "1", 10));
      const unit = def.price;
      state.items.push({ type:"side", name:def.label, qty, unitPrice: unit, lineTotal: +(unit * qty).toFixed(2) });
      saveState(); renderCart(); flashAdded();
    });
  }

  // ----- render DRINKS -----
  function renderDrinks() {
    const panel = $("#drinks"); if (!panel) return;
    const def = MENU.drinks[0];
    const html = `
      <div class="card">
        <div class="add-row">
          <div><strong>Soft Drink</strong> <span class="muted">(${money(def.price)} each)</span></div>
          <label class="qty"><span>Qty</span><input type="number" id="drinks-qty" min="1" value="1" inputmode="numeric"></label>
          <button type="button" id="drinks-add" class="btn btn-primary">Add</button>
        </div>
      </div>`;
    (panel.querySelector(".placeholder") || {}).outerHTML = html;

    $("#drinks-add").addEventListener("click", () => {
      const qty = Math.max(1, parseInt($("#drinks-qty").value || "1", 10));
      const unit = def.price;
      state.items.push({ type:"drink", name:def.label, qty, unitPrice: unit, lineTotal: +(unit * qty).toFixed(2) });
      saveState(); renderCart(); flashAdded();
    });
  }

  // ----- cart UI & totals (unchanged except for flash) -----
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
        } else if (it.type === "pizza_double") {
          const tops = (it.toppings||[]).map(id => MENU.pizza.toppings.find(x=>x.id===id)?.label || id)
                        .map(txt => txt.replace(/\(×2\)/g,"")).join(", ") || "Cheese";
          details = `Toppings for both: ${tops}`;
        } else if (it.type === "sub") {
          details = it.details || "";
        } else if (it.type === "wings") {
          details = `Flavour: ${it.flavour}${it.dips?` • Dips: ${it.dips}`:""}`;
        }
        return `
          <li class="cart-item">
            <div class="row">
              <div class="info">
                <strong>${it.qty}× ${it.name}</strong>
                ${details ? `<div class="muted micro">${details}</div>` : ""}
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
          </li>`;
      }).join("");
    }

    // qty handlers
    $$("#cart-list .qty-inc").forEach(btn => btn.addEventListener("click", (e) => {
      const idx = +e.currentTarget.dataset.idx;
      const it = state.items[idx]; it.qty += 1; it.lineTotal = +(it.unitPrice * it.qty).toFixed(2);
      saveState(); renderCart();
    }));
    $$("#cart-list .qty-dec").forEach(btn => btn.addEventListener("click", (e) => {
      const idx = +e.currentTarget.dataset.idx;
      const it = state.items[idx]; it.qty -= 1;
      if (it.qty <= 0) state.items.splice(idx,1); else it.lineTotal = +(it.unitPrice * it.qty).toFixed(2);
      saveState(); renderCart();
    }));

    // remove handlers
    $$("#cart-list [data-remove]").forEach(btn => btn.addEventListener("click", (e) => {
      const idx = +e.currentTarget.getAttribute("data-remove");
      state.items.splice(idx, 1); saveState(); renderCart();
    }));

    recalcTotals();
  }

  function flashAdded() {
    const status = $("#cart-status");
    if (status) { status.textContent = "Added to cart."; status.classList.remove("hide"); setTimeout(()=>status.classList.add("hide"), 1200); }
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

  // ----- Review -> submit (same as O5) -----
  function generateOrderId() {
    const now = new Date(); const pad = (n)=>n.toString().padStart(2,"0");
    const YY = now.getFullYear().toString().slice(-2), MM=pad(now.getMonth()+1), DD=pad(now.getDate());
    const hh=pad(now.getHours()), mm=pad(now.getMinutes()); const rand=Math.floor(Math.random()*9000+1000);
    return `SP-${YY}${MM}${DD}-${hh}${mm}-${rand}`;
  }

  function kitchenTicket(order) {
    const sizeLabel  = (id) => MENU.pizza.sizes.find(s => s.id === id)?.label || id;
    const crustLabel = (id) => MENU.pizza.crusts.find(c => c.id === id)?.label || id;
    const topLabel   = (id) => MENU.pizza.toppings.find(t => t.id === id)?.label || id;

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
      } else if (it.type === "pizza_double") {
        const tops = (it.toppings||[]).map(topLabel).join(", ") || "Cheese";
        lines.push(`${it.qty}× Double Deal — ${sizeLabel(it.size)}\n   Toppings for both: ${tops}`);
      } else if (it.type === "special") {
        lines.push(`${it.qty}× Special — ${it.name}`);
      } else if (it.type === "sub") {
        lines.push(`${it.qty}× ${it.name}${it.details?`\n   ${it.details}`:""}`);
      } else if (it.type === "wings") {
        lines.push(`${it.qty}× Wings — ${MENU.wings.sizes.find(s=>s.id===it.size)?.label} • ${it.flavour}${it.dips?`\n   Dips: ${it.dips}`:""}`);
      } else if (it.type === "nuggets") {
        lines.push(`${it.qty}× Nuggets — ${MENU.nuggets.sizes.find(s=>s.id===it.size)?.label}`);
      } else if (it.type === "salad") {
        lines.push(`${it.qty}× ${it.name}`);
      } else if (it.type === "side" || it.type === "drink") {
        lines.push(`${it.qty}× ${it.name}`);
      } else {
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
    if (!state.items.length) { status.textContent = "Your cart is empty."; status.classList.add("err"); status.classList.remove("hide"); return; }

    const name  = $("#r-name")?.value.trim() || "";
    const phone = $("#r-phone")?.value.trim() || "";
    const pickup= $("#r-pickup")?.value || "ASAP";
    const notes = $("#r-notes")?.value.trim() || "";

    if (name.length < 2) { status.textContent = "Please enter your name."; status.classList.add("err"); status.classList.remove("hide"); return; }
    const digits = phone.replace(/\D/g,""); if (digits.length < 7) { status.textContent = "Please enter a valid phone number."; status.classList.add("err"); status.classList.remove("hide"); return; }

    let payment = (document.querySelector('input[name="payment"]:checked')?.value) || "pay_at_pickup";
    const hasCloverLinks = Array.isArray(CFG?.clover?.paymentLinks) && CFG.clover.paymentLinks.some(l => l && l.url);
    if (payment === "online" && !hasCloverLinks) {
      payment = "pay_at_pickup";
      status.textContent = "Online payment isn’t available right now — set to Pay at Pickup.";
      status.classList.remove("err","hide"); setTimeout(() => status.classList.add("hide"), 1500);
    }

    const id  = generateOrderId();
    const { sub, tax, tip, tot } = currentTotals();
    const payload = {
      id, ts: new Date().toISOString(), payment,
      customer: { name, phone, pickup, notes },
      items: state.items,
      subTotal: +sub.toFixed(2), tax: +tax.toFixed(2), tip: +tip.toFixed(2), total: +tot.toFixed(2),
      taxRate: state.taxRate, taxName: CFG.taxName || "HST", currency: (MENU && MENU.currency) || "CAD"
    };

    const ticket = kitchenTicket(payload);

    // fill hidden form
    const nf = $("#netlify-order"); if (!nf) { status.textContent = "Form missing. Please call to place order."; status.classList.add("err"); status.classList.remove("hide"); return; }
    $("#f-order-id").value = id; $("#f-payment").value = payment; $("#f-name").value = name; $("#f-phone").value = phone; $("#f-pickup").value = pickup; $("#f-kitchen").value = ticket; $("#f-json").value = JSON.stringify(payload, null, 2);

    // send
    status.textContent = "Sending…"; status.classList.remove("err","hide");
    try {
      const fd = new FormData(nf); const body = {}; fd.forEach((v,k)=> body[k]=v);
      await fetch("/", { method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" }, body: encode(body) });

      state.items = []; saveState(); renderCart();
      const details = $("#confirm-details");
      if (details) {
        const when = pickup === "ASAP" ? "ASAP" : `in ~${pickup} min`;
        details.textContent = `Order ${id}. Pickup: ${when}. If anything changes, call ${CFG.phone || "226-648-8888"}.`;
      }
      location.hash = "#confirm";
      status.textContent = "Order sent!"; setTimeout(()=>status.classList.add("hide"), 1200);
    } catch (e) {
      console.error(e);
      status.textContent = `Sorry, we couldn’t send the order. Please call ${CFG.phone || "226-648-8888"}.`;
      status.classList.add("err");
    }
  }

  // ----- tips + totals -----
  function renderTips() {
    const wrap = $("#tip-buttons"); if (!wrap) return;
    const opts = (CFG.tipOptions && CFG.tipOptions.length) ? CFG.tipOptions : [0, 0.1, 0.15, 0.18, 0.2];
    wrap.innerHTML = opts.map(pct => `<button class="chip" data-tip="${pct}">${pct===0?"No tip":`${Math.round(pct*100)}%`}</button>`).join("");

    const setActive = () => { $$("#tip-buttons .chip").forEach(b => b.classList.toggle("active", state.tipPct !== null ? (+b.dataset.tip === state.tipPct) : (+b.dataset.tip === 0))); };
    setActive();
    $$("#tip-buttons .chip").forEach(btn => btn.addEventListener("click", () => { state.tipPct = +btn.dataset.tip; state.tip = 0; saveState(); setActive(); recalcTotals(); }));
    $("#tip-clear")?.addEventListener("click", () => { state.tipPct = 0; state.tip = 0; saveState(); setActive(); recalcTotals(); });
  }

  // ----- init -----
  async function init() {
    setActiveTabFromHash();

    // load config + menu
    try { CFG = await loadJSON("../data/config.json"); } catch {}
    try { MENU = await loadJSON("../data/menu.json"); } catch { MENU = await loadJSON("data/menu.json"); }

    state.taxRate = (typeof CFG.taxRate === "number") ? CFG.taxRate : 0.13;

    // dynamic tax label
    const taxPct = Math.round(state.taxRate * 100);
    const taxName = CFG.taxName || "HST";
    const tl = $("#tax-label"); if (tl) tl.textContent = `${taxName} (${taxPct}%)`;

    loadState();

    // render all panels
    renderSingleBuilder();
    renderDoubleBuilder();
    renderSpecials();
    renderSubs();
    renderWings();
    renderNuggets();
    renderSalads();
    renderSides();
    renderDrinks();

    renderTips();
    renderCart();

    // Review -> Place Order
    $("#place-order")?.addEventListener("click", handlePlaceOrder);
  }

  document.addEventListener("DOMContentLoaded", init);
})();