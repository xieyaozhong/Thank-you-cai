(() => {
  "use strict";

  const STORAGE_KEY = "thank-you-cai-github-pages-v1";
  const GACHA_COST = 50;
  const OFFICIAL_SITE = "https://thank-you-cai.yao1230.chatgpt.site";

  const products = [
    { id: "cabbage-a", name: "高麗菜", cardName: "翠玉高麗菜", category: "vegetable", grade: "A", price: 80, unit: "顆", origin: "雲林", stock: 18, max: 3, note: "葉球扎實，外葉有少量自然擦痕。", emoji: "🥬" },
    { id: "bokchoy-s", name: "青江菜", cardName: "晨露青江菜", category: "vegetable", grade: "S", price: 45, unit: "把", origin: "彰化", stock: 12, max: 5, note: "清晨採收，葉片挺脆飽水。", emoji: "🥬" },
    { id: "cucumber-a", name: "小黃瓜", cardName: "咔滋小黃瓜", category: "vegetable", grade: "A", price: 65, unit: "袋（600g）", origin: "南投", stock: 14, max: 4, note: "爽脆清甜，部分瓜身微彎。", emoji: "🥒" },
    { id: "carrot-b", name: "紅蘿蔔", cardName: "彎彎紅蘿蔔", category: "vegetable", grade: "B", price: 42, unit: "袋（3 根）", origin: "台中", stock: 20, max: 4, note: "大小不一、形狀彎曲，甜味與口感正常。", emoji: "🥕" },
    { id: "guava-s", name: "珍珠芭樂", cardName: "星光珍珠芭樂", category: "fruit", grade: "S", price: 105, unit: "斤", origin: "高雄", stock: 10, max: 3, note: "果型均勻、硬脆，甜度佳。", emoji: "🍐" },
    { id: "banana-c", name: "香蕉", cardName: "甜甜惜食香蕉", category: "fruit", grade: "C", price: 45, unit: "把", origin: "屏東", stock: 8, max: 2, note: "已熟透且有糖斑，建議今天吃或打果汁。", emoji: "🍌" },
    { id: "pineapple-b", name: "金鑽鳳梨", cardName: "迷你金鑽鳳梨", category: "fruit", grade: "B", price: 110, unit: "顆", origin: "嘉義", stock: 9, max: 2, note: "果型略小，香氣與果肉狀況正常。", emoji: "🍍" },
    { id: "tomato-a", name: "玉女小番茄", cardName: "紅寶石小番茄", category: "fruit", grade: "A", price: 95, unit: "盒", origin: "嘉義", stock: 16, max: 4, note: "果色自然，少量大小差異，酸甜清脆。", emoji: "🍅" },
  ];

  const gradeNames = { S: "閃亮特選", A: "新鮮優選", B: "實惠好味", C: "惜食即享" };
  const defaultState = () => ({ cart: {}, orders: [], points: 150, collection: {} });

  let state = loadState();
  let activeCategory = "all";
  let activeGrade = "all";
  let query = "";
  let toastTimer = 0;
  let isDrawing = false;

  const els = {
    productGrid: document.querySelector("#product-grid"),
    productCount: document.querySelector("#product-count"),
    searchInput: document.querySelector("#search-input"),
    cartLines: document.querySelector("#cart-lines"),
    cartCount: document.querySelector("#cart-count"),
    headerCartCount: document.querySelector("#header-cart-count"),
    mobileCartCount: document.querySelector("#mobile-cart-count"),
    cartSubtotal: document.querySelector("#cart-subtotal"),
    cartDelivery: document.querySelector("#cart-delivery"),
    cartTotal: document.querySelector("#cart-total"),
    mobileCartTotal: document.querySelector("#mobile-cart-total"),
    shippingNote: document.querySelector("#shipping-note"),
    checkoutButton: document.querySelector("#checkout-button"),
    checkoutDialog: document.querySelector("#checkout-dialog"),
    checkoutForm: document.querySelector("#checkout-form"),
    checkoutSummary: document.querySelector("#checkout-summary"),
    receiptDialog: document.querySelector("#receipt-dialog"),
    receiptCode: document.querySelector("#receipt-code"),
    receiptPoints: document.querySelector("#receipt-points"),
    pointsValue: document.querySelector("#points-value"),
    drawButton: document.querySelector("#draw-button"),
    drawAction: document.querySelector("#draw-action"),
    gachaScreen: document.querySelector("#gacha-screen"),
    collectionGrid: document.querySelector("#collection-grid"),
    ordersList: document.querySelector("#orders-list"),
    clearDataButton: document.querySelector("#clear-data-button"),
    toast: document.querySelector("#toast"),
    weekLabel: document.querySelector("#week-label"),
  };

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return defaultState();
      return {
        cart: parsed.cart && typeof parsed.cart === "object" ? parsed.cart : {},
        orders: Array.isArray(parsed.orders) ? parsed.orders.map(sanitizeStoredOrder).filter(Boolean).slice(0, 30) : [],
        points: Number.isFinite(parsed.points) ? Math.max(0, Math.round(parsed.points)) : 150,
        collection: parsed.collection && typeof parsed.collection === "object" ? parsed.collection : {},
      };
    } catch {
      return defaultState();
    }
  }

  function sanitizeStoredOrder(order) {
    if (!order || typeof order !== "object" || !Array.isArray(order.lines)) return null;
    const lines = order.lines.map((line) => {
      if (!line || typeof line !== "object") return null;
      const knownProduct = products.find((product) => product.name === String(line.name || ""));
      if (!knownProduct) return null;
      const quantity = Math.max(1, Math.min(20, Math.round(Number(line.quantity) || 1)));
      return { name: knownProduct.name, emoji: knownProduct.emoji, price: knownProduct.price, quantity };
    }).filter(Boolean);
    if (lines.length === 0) return null;
    const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const delivery = subtotal >= 500 ? 0 : 60;
    const createdAt = Number.isFinite(Date.parse(String(order.createdAt))) ? String(order.createdAt) : new Date(0).toISOString();
    return {
      id: String(order.id || "DEMO-LOCAL").slice(0, 24),
      createdAt,
      nickname: String(order.nickname || "小菜友").slice(0, 20),
      slot: String(order.slot || "未選擇").slice(0, 30),
      note: String(order.note || "").slice(0, 50),
      lines,
      subtotal,
      delivery,
      total: subtotal + delivery,
      earnedPoints: Math.max(0, Math.round(Number(order.earnedPoints) || 0)),
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      showToast("瀏覽器阻擋本機儲存，本次資料可能無法保留。", true);
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function money(value) {
    return new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  function dateTime(value) {
    return new Intl.DateTimeFormat("zh-TW", {
      year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
    }).format(new Date(value));
  }

  function getWeekLabel() {
    const current = new Date();
    const day = current.getDay();
    const start = new Date(current);
    start.setDate(current.getDate() + (day === 0 ? -6 : 1 - day));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const short = (value) => `${value.getMonth() + 1}/${value.getDate()}`;
    return `${short(start)}（一）— ${short(end)}（日）`;
  }

  function cartQuantity(productId) {
    const product = products.find((item) => item.id === productId);
    if (!product) return 0;
    const raw = Number(state.cart[productId] || 0);
    return Math.max(0, Math.min(Number.isFinite(raw) ? Math.round(raw) : 0, product.stock, product.max));
  }

  function cartSnapshot() {
    const lines = products
      .map((product) => ({ product, quantity: cartQuantity(product.id) }))
      .filter((line) => line.quantity > 0);
    const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
    const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
    const delivery = subtotal === 0 || subtotal >= 500 ? 0 : 60;
    return { lines, itemCount, subtotal, delivery, total: subtotal + delivery };
  }

  function renderProducts() {
    const normalized = query.trim().toLocaleLowerCase("zh-TW");
    const filtered = products.filter((product) => {
      const categoryMatch = activeCategory === "all" || product.category === activeCategory;
      const gradeMatch = activeGrade === "all" || product.grade === activeGrade;
      const text = `${product.name}${product.cardName}${product.origin}`.toLocaleLowerCase("zh-TW");
      return categoryMatch && gradeMatch && text.includes(normalized);
    });

    els.productCount.textContent = `${filtered.length} 種蔬果符合條件`;
    if (filtered.length === 0) {
      els.productGrid.innerHTML = '<div class="empty-state"><span aria-hidden="true">⌕</span><h3>沒有符合的蔬果</h3><p>換個關鍵字或篩選條件再找找看。</p></div>';
      return;
    }

    els.productGrid.innerHTML = filtered.map((product) => {
      const quantity = cartQuantity(product.id);
      const controls = quantity > 0
        ? `<div class="quantity-control" aria-label="${product.name}數量">
            <button type="button" data-action="decrease" data-id="${product.id}" aria-label="減少一${escapeHtml(product.unit)}${product.name}">−</button>
            <strong aria-live="polite">${quantity}</strong>
            <button type="button" data-action="increase" data-id="${product.id}" aria-label="增加一${escapeHtml(product.unit)}${product.name}" ${quantity >= product.stock || quantity >= product.max ? "disabled" : ""}>＋</button>
          </div>`
        : `<button type="button" class="primary-button product-card__add" data-action="increase" data-id="${product.id}">加入菜籃</button>`;

      return `<article class="product-card${quantity ? " is-selected" : ""}" data-grade="${product.grade}">
        <div class="product-card__top">
          <span class="product-grade"><strong>${product.grade}</strong>${gradeNames[product.grade]}</span>
          <span class="stock-chip">剩 ${product.stock} ${escapeHtml(product.unit)}</span>
        </div>
        <div class="product-card__art"><span class="product-emoji" role="img" aria-label="${product.name}">${product.emoji}</span><span class="grade-corner" aria-hidden="true">${product.grade}</span></div>
        <div class="product-card__body">
          <span class="origin">${product.origin}・${product.cardName}</span>
          <h3>${product.name}</h3>
          <p>${product.note}</p>
          <div class="price-row"><strong>${money(product.price)}</strong><span>/ ${escapeHtml(product.unit)}</span></div>
          ${controls}
        </div>
      </article>`;
    }).join("");
  }

  function renderCart() {
    const cart = cartSnapshot();
    els.cartCount.textContent = String(cart.itemCount);
    els.headerCartCount.textContent = String(cart.itemCount);
    els.mobileCartCount.textContent = String(cart.itemCount);
    els.cartSubtotal.textContent = money(cart.subtotal);
    els.cartDelivery.textContent = cart.delivery === 0 ? "免費" : money(cart.delivery);
    els.cartTotal.textContent = money(cart.total);
    els.mobileCartTotal.textContent = money(cart.total);
    els.checkoutButton.disabled = cart.itemCount === 0;

    els.shippingNote.textContent = cart.subtotal >= 500
      ? "已達免運門檻，運費試算為免費。"
      : `再挑 ${money(Math.max(0, 500 - cart.subtotal))} 即達免運門檻。`;

    if (cart.lines.length === 0) {
      els.cartLines.innerHTML = '<div class="cart-empty"><span aria-hidden="true">籃</span><p>菜籃還是空的，從左邊挑一張喜歡的蔬果卡吧。</p></div>';
      return;
    }

    els.cartLines.innerHTML = `<div class="cart-lines">${cart.lines.map(({ product, quantity }) => `
      <div class="cart-line">
        <span class="cart-line__emoji" aria-hidden="true">${product.emoji}</span>
        <div><strong>${product.name}</strong><span>${product.grade} 級・${quantity} ${escapeHtml(product.unit)}</span></div>
        <b>${money(product.price * quantity)}</b>
      </div>`).join("")}</div>`;
  }

  function changeCart(productId, delta) {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const next = Math.max(0, Math.min(cartQuantity(productId) + delta, product.stock, product.max));
    if (next === 0) delete state.cart[productId];
    else state.cart[productId] = next;
    saveState();
    renderProducts();
    renderCart();
    showToast(delta > 0 ? `${product.name}已加入菜籃。` : `已調整${product.name}數量。`);
  }

  function renderCollection() {
    els.pointsValue.textContent = String(state.points);
    const canDraw = state.points >= GACHA_COST && !isDrawing;
    els.drawButton.disabled = !canDraw;
    els.drawAction.disabled = !canDraw;
    els.drawAction.textContent = state.points >= GACHA_COST ? `花 ${GACHA_COST} 點抽卡` : `還差 ${GACHA_COST - state.points} 點`;

    els.collectionGrid.innerHTML = products.map((product) => {
      const count = Math.max(0, Number(state.collection[product.id] || 0));
      return `<article class="collection-card${count ? "" : " is-locked"}">
        <span role="img" aria-label="${count ? product.name : "尚未解鎖"}">${count ? product.emoji : "？"}</span>
        <strong>${count ? product.cardName : "尚未解鎖"}</strong>
        <small>${count ? `收藏 × ${count}` : `${product.grade} 級卡`}</small>
      </article>`;
    }).join("");
  }

  function chooseGachaProduct() {
    const roll = Math.random() * 100;
    const grade = roll < 5 ? "S" : roll < 25 ? "A" : roll < 55 ? "B" : "C";
    const pool = products.filter((product) => product.grade === grade);
    return pool[Math.floor(Math.random() * pool.length)] || products[Math.floor(Math.random() * products.length)];
  }

  function drawCard() {
    if (isDrawing || state.points < GACHA_COST) return;
    isDrawing = true;
    state.points -= GACHA_COST;
    saveState();
    renderCollection();
    els.gachaScreen.innerHTML = '<span aria-hidden="true">⋯</span><strong>抽卡中</strong><small>本週好菜正在轉出來</small>';

    window.setTimeout(() => {
      const product = chooseGachaProduct();
      state.collection[product.id] = Math.max(0, Number(state.collection[product.id] || 0)) + 1;
      isDrawing = false;
      saveState();
      els.gachaScreen.innerHTML = `<span role="img" aria-label="${product.name}">${product.emoji}</span><strong>${product.grade} 級・${product.cardName}</strong><small>已存入本機收藏簿</small>`;
      renderCollection();
      showToast(`抽到「${product.cardName}」！`);
    }, 720);
  }

  function renderOrders() {
    if (state.orders.length === 0) {
      els.ordersList.innerHTML = '<div class="order-empty"><span aria-hidden="true">🧺</span><h2>還沒有本機訂單</h2><p>到菜攤挑選蔬果，再產生一張試玩訂單。</p><button type="button" class="primary-button" data-view-target="market">回菜攤挑菜</button></div>';
      return;
    }

    els.ordersList.innerHTML = state.orders.map((order) => `
      <article class="order-card">
        <div class="order-card__header"><div><small>${dateTime(order.createdAt)}</small><h3>${escapeHtml(order.id)}</h3></div><span class="status">只存本機</span></div>
        <div class="order-lines">${order.lines.map((line) => `<div><span>${escapeHtml(line.emoji)} ${escapeHtml(line.name)} × ${line.quantity}</span><strong>${money(line.price * line.quantity)}</strong></div>`).join("")}</div>
        <div class="order-meta"><strong>${escapeHtml(order.nickname)}</strong>・${escapeHtml(order.slot)}${order.note ? `<br />備註：${escapeHtml(order.note)}` : ""}</div>
        <div class="order-card__total"><span>試算合計</span><strong>${money(order.total)}</strong></div>
      </article>`).join("");
  }

  function openCheckout() {
    const cart = cartSnapshot();
    if (cart.itemCount === 0) return;
    els.checkoutSummary.innerHTML = `${cart.lines.map(({ product, quantity }) => `<span><span>${product.emoji} ${product.name} × ${quantity}</span><b>${money(product.price * quantity)}</b></span>`).join("")}<strong>合計 ${money(cart.total)}</strong>`;
    showDialog(els.checkoutDialog);
  }

  function placeLocalOrder(event) {
    event.preventDefault();
    const cart = cartSnapshot();
    if (cart.itemCount === 0) {
      closeDialog(els.checkoutDialog);
      showToast("菜籃已經是空的。", true);
      return;
    }

    const form = new FormData(els.checkoutForm);
    const earnedPoints = Math.max(1, Math.floor(cart.subtotal / 10));
    const id = `DEMO-${String(Date.now()).slice(-6)}`;
    const order = {
      id,
      createdAt: new Date().toISOString(),
      nickname: String(form.get("nickname") || "小菜友").slice(0, 20),
      slot: String(form.get("slot") || "未選擇").slice(0, 30),
      note: String(form.get("note") || "").slice(0, 50),
      lines: cart.lines.map(({ product, quantity }) => ({ name: product.name, emoji: product.emoji, price: product.price, quantity })),
      subtotal: cart.subtotal,
      delivery: cart.delivery,
      total: cart.total,
      earnedPoints,
    };

    state.orders.unshift(order);
    state.orders = state.orders.slice(0, 30);
    state.points += earnedPoints;
    state.cart = {};
    saveState();
    els.checkoutForm.reset();
    closeDialog(els.checkoutDialog);
    els.receiptCode.textContent = id;
    els.receiptPoints.textContent = `獲得 ${earnedPoints} 點試玩點數`;
    renderAll();
    showDialog(els.receiptDialog);
  }

  function setView(view) {
    const target = ["market", "gacha", "orders"].includes(view) ? view : "market";
    document.querySelectorAll("[data-view]").forEach((section) => {
      const active = section.dataset.view === target;
      section.hidden = !active;
      section.classList.toggle("is-active", active);
    });
    document.querySelectorAll(".topnav [data-view-target]").forEach((button) => {
      const active = button.dataset.viewTarget === target;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (target === "gacha") renderCollection();
    if (target === "orders") renderOrders();
    document.querySelector("#main-content").scrollIntoView({ block: "start" });
  }

  function showDialog(dialog) {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.style.background = isError ? "#9e342d" : "";
    els.toast.setAttribute("role", isError ? "alert" : "status");
    els.toast.setAttribute("aria-live", isError ? "assertive" : "polite");
    els.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
  }

  function clearLocalData() {
    const confirmed = window.confirm("確定要清除這台裝置上的菜籃、試玩訂單、點數與收藏嗎？");
    if (!confirmed) return;
    state = defaultState();
    saveState();
    renderAll();
    els.gachaScreen.innerHTML = '<span aria-hidden="true">🍍</span><strong>準備好了嗎？</strong><small>按下旋鈕抽菜卡</small>';
    showToast("本機試玩資料已清除。", true);
  }

  function scrollToCart() {
    const openCart = () => document.querySelector("#cart-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    const market = document.querySelector('[data-view="market"]');
    if (market.hidden) {
      setView("market");
      window.setTimeout(openCart, 40);
    } else openCart();
  }

  function renderAll() {
    renderProducts();
    renderCart();
    renderCollection();
    renderOrders();
  }

  els.productGrid.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    changeCart(button.dataset.id, button.dataset.action === "increase" ? 1 : -1);
  });

  els.searchInput.addEventListener("input", (event) => {
    query = event.target.value;
    renderProducts();
  });

  document.querySelectorAll("[data-category]").forEach((button) => button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    document.querySelectorAll("[data-category]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderProducts();
  }));

  document.querySelectorAll("[data-grade]").forEach((button) => button.addEventListener("click", () => {
    activeGrade = button.dataset.grade;
    document.querySelectorAll("[data-grade]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    renderProducts();
  }));

  document.addEventListener("click", (event) => {
    const viewButton = event.target.closest("[data-view-target]");
    if (viewButton) setView(viewButton.dataset.viewTarget);
    if (event.target.closest("[data-scroll-cart]")) scrollToCart();
    const closeButton = event.target.closest("[data-close-dialog]");
    if (closeButton) {
      const dialog = closeButton.closest("dialog");
      if (dialog) closeDialog(dialog);
    }
  });

  [els.checkoutDialog, els.receiptDialog].forEach((dialog) => dialog.addEventListener("click", (event) => {
    if (event.target === dialog) closeDialog(dialog);
  }));

  els.checkoutButton.addEventListener("click", openCheckout);
  els.checkoutForm.addEventListener("submit", placeLocalOrder);
  els.drawButton.addEventListener("click", drawCard);
  els.drawAction.addEventListener("click", drawCard);
  els.clearDataButton.addEventListener("click", clearLocalData);

  els.weekLabel.textContent = getWeekLabel();
  renderAll();

  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = loadState();
    renderAll();
  });

  window.THANK_YOU_CAI_DEMO = Object.freeze({
    products: products.map((product) => ({ ...product })),
    officialSite: OFFICIAL_SITE,
    storageKey: STORAGE_KEY,
  });
})();
