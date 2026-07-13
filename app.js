(() => {
  "use strict";

  const STORAGE_KEY = "thank-you-cai-github-pages-v1";
  const GACHA_COST = 50;
  const GACHA_PHASES = {
    turning: ["旋鈕轉動中…", "握緊，扭蛋機要啟動了"],
    shaking: ["卡池翻滾中…", "本週好菜正在裡面碰撞"],
    waiting: ["正在確認這顆扭蛋…", "馬上就會掉出來"],
    dropping: ["扭蛋掉下來了！", "咚！請看取物口"],
    revealing: ["扭蛋打開中…", "看看是哪一張蔬果卡"],
  };

  const catalog = window.THANK_YOU_CAI_CATALOG;
  const cloud = window.THANK_YOU_CAI_CLOUD_CLIENT;
  if (!catalog) throw new Error("找不到蔬果目錄 catalog.js");
  const sprites = catalog.sprites;
  const OWNER_SETTINGS_KEY = "thank-you-cai-owner-settings-v1";

  function loadOwnerSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(OWNER_SETTINGS_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : { announcement: "", products: {} };
    } catch {
      return { announcement: "", products: {} };
    }
  }

  function buildProducts() {
    const settings = loadOwnerSettings();
    const overrides = settings.products && typeof settings.products === "object" ? settings.products : {};
    return catalog.products.map((base) => {
      const override = overrides[base.id] && typeof overrides[base.id] === "object" ? overrides[base.id] : {};
      const price = Number(override.price);
      const stock = Number(override.stock);
      return {
        ...base,
        price: Number.isFinite(price) ? Math.max(0, Math.round(price)) : base.price,
        stock: Number.isFinite(stock) ? Math.max(0, Math.round(stock)) : base.stock,
        enabled: override.enabled !== false,
      };
    }).filter((product) => product.enabled);
  }

  let products = buildProducts();
  const gradeNames = { S: "閃亮特選", A: "新鮮優選", B: "實惠好味", C: "惜食即享" };
  const defaultState = () => ({ cart: {}, orders: [], points: 150, collection: {} });

  let state = loadState();
  let activeCategory = "all";
  let activeGrade = "all";
  let query = "";
  let toastTimer = 0;
  let isDrawing = false;
  let drawSequence = 0;

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
    gachaMachine: document.querySelector("#gacha-machine"),
    gachaScreen: document.querySelector("#gacha-screen"),
    gachaScreenArt: document.querySelector("#gacha-screen-art"),
    gachaStatus: document.querySelector("#gacha-status"),
    gachaHint: document.querySelector("#gacha-hint"),
    collectionGrid: document.querySelector("#collection-grid"),
    ordersList: document.querySelector("#orders-list"),
    clearDataButton: document.querySelector("#clear-data-button"),
    toast: document.querySelector("#toast"),
    weekLabel: document.querySelector("#week-label"),
    sellerAnnouncement: document.querySelector("#seller-announcement"),
    sellerAnnouncementText: document.querySelector("#seller-announcement-text"),
    catalogTotal: document.querySelector("#catalog-total"),
    cloudStatus: document.querySelector("#cloud-status"),
    cloudStatusTitle: document.querySelector("#cloud-status-title"),
    submitOrderButton: document.querySelector("#submit-order-button"),
    receiptTitle: document.querySelector("#receipt-title"),
    receiptMessage: document.querySelector("#receipt-message"),
    receiptLabel: document.querySelector("#receipt-label"),
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
      return { name: knownProduct.name, sprite: knownProduct.sprite, price: knownProduct.price, quantity };
    }).filter(Boolean);
    if (lines.length === 0) return null;
    const subtotal = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);
    const delivery = subtotal >= 500 ? 0 : 60;
    const createdAt = Number.isFinite(Date.parse(String(order.createdAt))) ? String(order.createdAt) : new Date(0).toISOString();
    return {
      id: String(order.id || "TYC-LOCAL").slice(0, 24),
      createdAt,
      nickname: String(order.nickname || "小菜友").slice(0, 30),
      slot: String(order.slot || "未選擇").slice(0, 30),
      note: String(order.note || "").slice(0, 120),
      contact: String(order.contact || "").slice(0, 50),
      customerToken: String(order.customerToken || getCustomerToken()),
      status: String(order.status || "pending"),
      syncStatus: String(order.syncStatus || "local"),
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

  function getCustomerToken() {
    const key = "thank-you-cai-customer-token-v1";
    let token = localStorage.getItem(key);
    if (!token) {
      token = self.crypto?.randomUUID?.() || `00000000-0000-4000-8000-${Math.random().toString(16).slice(2).padEnd(12, "0").slice(0, 12)}`;
      localStorage.setItem(key, token);
    }
    return token;
  }

  function orderCode() {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
    const random = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `TYC-${stamp}-${random}`;
  }

  function updateCloudStatus(message, ok = false) {
    if (els.cloudStatus) els.cloudStatus.textContent = message;
    if (els.cloudStatusTitle) els.cloudStatusTitle.textContent = ok ? "雲端訂單已連線" : "顧客菜攤";
  }

  async function refreshCloudSettings() {
    if (!cloud?.isConfigured()) {
      updateCloudStatus("目前為離線模式：訂單會保存在此裝置，待雲端設定完成後再同步。", false);
      return;
    }
    try {
      const remote = await cloud.getStoreSettings();
      if (remote) {
        localStorage.setItem(OWNER_SETTINGS_KEY, JSON.stringify({ announcement: remote.announcement || "", products: remote.products || {}, updatedAt: remote.updated_at }));
        products = buildProducts();
        renderAll();
      }
      updateCloudStatus("訂單會同步到攤主工作台；斷線時會先保存在此裝置。", true);
    } catch (error) {
      updateCloudStatus(`雲端暫時無法連線：${error.message}`, false);
    }
  }

  async function syncPendingOrders() {
    if (!cloud?.isConfigured() || !navigator.onLine) return;
    const pending = state.orders.filter((order) => order.syncStatus === "pending");
    for (const order of pending) {
      try {
        await cloud.createOrder(order);
        order.syncStatus = "synced";
      } catch (error) {
        if (error.status === 409) order.syncStatus = "synced";
      }
    }
    saveState();
    renderOrders();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function renderPixelSprite(spriteKey, label, small = false) {
    const sprite = sprites[spriteKey];
    if (!sprite) return '<span class="pixel-sprite-fallback" aria-hidden="true">？</span>';
    const cells = sprite.pixels.flatMap((row) => [...row]).map((pixel) => {
      const color = pixel === "." ? "transparent" : sprite.palette[pixel];
      return `<span class="pixel-sprite__cell" style="background:${color}"></span>`;
    }).join("");
    return `<span class="pixel-sprite${small ? " pixel-sprite--small" : ""}" role="img" aria-label="${escapeHtml(label)}">${cells}</span>`;
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
        <div class="product-card__art">${renderPixelSprite(product.sprite, product.name)}<span class="grade-corner" aria-hidden="true">${product.grade}</span></div>
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
        ${renderPixelSprite(product.sprite, product.name, true)}
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
        ${count ? renderPixelSprite(product.sprite, product.name, true) : '<span class="pixel-sprite-fallback" aria-label="尚未解鎖">？</span>'}
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

  function setGachaPhase(phase) {
    const busy = phase !== "idle";
    els.gachaMachine.dataset.phase = phase;
    els.gachaMachine.setAttribute("aria-busy", String(busy));
    if (GACHA_PHASES[phase]) {
      els.gachaStatus.textContent = GACHA_PHASES[phase][0];
      els.gachaHint.textContent = GACHA_PHASES[phase][1];
      els.drawAction.textContent = GACHA_PHASES[phase][0];
    }
  }

  function setGachaDisplay(sprite, label, status, hint) {
    els.gachaScreenArt.innerHTML = renderPixelSprite(sprite, label);
    els.gachaStatus.textContent = status;
    els.gachaHint.textContent = hint;
  }

  function waitForGacha(duration) {
    return new Promise((resolve) => window.setTimeout(resolve, duration));
  }

  async function drawCard() {
    if (isDrawing || state.points < GACHA_COST) return;
    const sequence = ++drawSequence;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const pause = (duration) => reduceMotion ? Promise.resolve() : waitForGacha(duration);
    isDrawing = true;
    state.points -= GACHA_COST;
    saveState();
    renderCollection();
    setGachaDisplay("pineapple", "金鑽鳳梨", "旋鈕轉動中…", "握緊，扭蛋機要啟動了");
    setGachaPhase("turning");

    try {
      await pause(420);
      if (sequence !== drawSequence) return;
      setGachaPhase("shaking");
      await pause(480);
      if (sequence !== drawSequence) return;
      setGachaPhase("waiting");
      await pause(160);
      if (sequence !== drawSequence) return;
      setGachaPhase("dropping");
      await pause(520);
      if (sequence !== drawSequence) return;
      setGachaPhase("revealing");
      await pause(320);
      if (sequence !== drawSequence) return;

      const product = chooseGachaProduct();
      state.collection[product.id] = Math.max(0, Number(state.collection[product.id] || 0)) + 1;
      saveState();
      setGachaDisplay(product.sprite, product.name, `${product.grade} 級・${product.cardName}`, "已存入本機收藏簿");
      showToast(`抽到「${product.cardName}」！`);
    } finally {
      if (sequence === drawSequence) {
        isDrawing = false;
        setGachaPhase("idle");
        renderCollection();
      }
    }
  }

  function renderOrders() {
    if (state.orders.length === 0) {
      els.ordersList.innerHTML = '<div class="order-empty"><span aria-hidden="true">🧺</span><h2>還沒有訂單</h2><p>到菜攤挑選蔬果，再送出第一張訂單。</p><button type="button" class="primary-button" data-view-target="market">回菜攤挑菜</button></div>';
      return;
    }
    const labels = { synced: "已同步", pending: "待同步", local: "僅此裝置" };
    els.ordersList.innerHTML = state.orders.map((order) => `
      <article class="order-card">
        <div class="order-card__header"><div><small>${dateTime(order.createdAt)}</small><h3>${escapeHtml(order.id)}</h3></div><span class="status">${labels[order.syncStatus] || "處理中"}</span></div>
        <div class="order-lines">${order.lines.map((line) => `<div><span class="order-line-product">${renderPixelSprite(line.sprite, line.name, true)}<span>${escapeHtml(line.name)} × ${line.quantity}</span></span><strong>${money(line.price * line.quantity)}</strong></div>`).join("")}</div>
        <div class="order-meta"><strong>${escapeHtml(order.nickname)}</strong>・${escapeHtml(order.slot)}${order.note ? `<br />備註：${escapeHtml(order.note)}` : ""}</div>
        <div class="order-card__total"><span>訂單合計</span><strong>${money(order.total)}</strong></div>
      </article>`).join("");
  }

  function openCheckout() {
    const cart = cartSnapshot();
    if (cart.itemCount === 0) return;
    els.checkoutSummary.innerHTML = `${cart.lines.map(({ product, quantity }) => `<span><span class="checkout-product">${renderPixelSprite(product.sprite, product.name, true)}<span>${product.name} × ${quantity}</span></span><b>${money(product.price * quantity)}</b></span>`).join("")}<strong>合計 ${money(cart.total)}</strong>`;
    showDialog(els.checkoutDialog);
  }

  async function placeOrder(event) {
    event.preventDefault();
    const cart = cartSnapshot();
    if (cart.itemCount === 0) { closeDialog(els.checkoutDialog); showToast("菜籃已經是空的。", true); return; }
    const form = new FormData(els.checkoutForm);
    const earnedPoints = Math.max(1, Math.floor(cart.subtotal / 10));
    const order = {
      id: orderCode(), createdAt: new Date().toISOString(),
      nickname: String(form.get("nickname") || "小菜友").slice(0, 30),
      contact: String(form.get("contact") || "").slice(0, 50),
      slot: String(form.get("slot") || "未選擇").slice(0, 30),
      note: String(form.get("note") || "").slice(0, 120),
      lines: cart.lines.map(({ product, quantity }) => ({ productId: product.id, name: product.name, sprite: product.sprite, unit: product.unit, price: product.price, quantity })),
      subtotal: cart.subtotal, delivery: cart.delivery, total: cart.total, earnedPoints,
      customerToken: getCustomerToken(), status: "pending", syncStatus: cloud?.isConfigured() ? "pending" : "local"
    };
    els.submitOrderButton.disabled = true;
    els.submitOrderButton.textContent = "正在送出…";
    let synced = false;
    try {
      if (cloud?.isConfigured()) { await cloud.createOrder(order); order.syncStatus = "synced"; synced = true; }
    } catch (error) {
      order.syncStatus = "pending";
      showToast(`雲端暫時無法連線，訂單已保存在此裝置：${error.message}`, true);
    } finally {
      els.submitOrderButton.disabled = false;
      els.submitOrderButton.textContent = "送出訂單";
    }
    state.orders.unshift(order); state.orders = state.orders.slice(0, 50); state.points += earnedPoints; state.cart = {}; saveState();
    els.checkoutForm.reset(); closeDialog(els.checkoutDialog);
    els.receiptCode.textContent = order.id;
    els.receiptPoints.textContent = `獲得 ${earnedPoints} 點水果點`;
    els.receiptTitle.textContent = synced ? "訂單已送到攤主端" : "訂單已保存在此裝置";
    els.receiptMessage.textContent = synced ? "攤主工作台已能查看這筆訂單。" : (cloud?.isConfigured() ? "目前連線失敗，恢復網路後會自動補送。" : "雲端尚未設定，因此目前只保存在這台裝置。 ");
    renderAll(); showDialog(els.receiptDialog);
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
    const confirmed = window.confirm("確定要清除這台裝置上的菜籃、訂單紀錄、菜籽點數與收藏嗎？");
    if (!confirmed) return;
    drawSequence += 1;
    isDrawing = false;
    setGachaPhase("idle");
    state = defaultState();
    saveState();
    renderAll();
    setGachaDisplay("pineapple", "金鑽鳳梨", "準備好了嗎？", "按下旋鈕抽菜卡");
    showToast("本機顧客資料已清除。", true);
  }

  function scrollToCart() {
    const openCart = () => document.querySelector("#cart-panel").scrollIntoView({ behavior: "smooth", block: "center" });
    const market = document.querySelector('[data-view="market"]');
    if (market.hidden) {
      setView("market");
      window.setTimeout(openCart, 40);
    } else openCart();
  }

  function renderOwnerSettings() {
    const settings = loadOwnerSettings();
    const announcement = String(settings.announcement || "").trim().slice(0, 120);
    if (els.sellerAnnouncement && els.sellerAnnouncementText) {
      els.sellerAnnouncement.hidden = !announcement;
      els.sellerAnnouncementText.textContent = announcement;
    }
    if (els.catalogTotal) els.catalogTotal.textContent = `${products.length} 種蔬果`;
  }

  function renderAll() {
    renderOwnerSettings();
    renderProducts();
    renderCart();
    renderCollection();
    renderOrders();
  }

  function hydrateStaticSprites() {
    document.querySelectorAll("[data-sprite]").forEach((slot) => {
      const key = slot.dataset.sprite;
      const label = slot.dataset.label || key;
      slot.innerHTML = renderPixelSprite(key, label);
    });
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
  els.checkoutForm.addEventListener("submit", placeOrder);
  els.drawButton.addEventListener("click", drawCard);
  els.drawAction.addEventListener("click", drawCard);
  els.clearDataButton.addEventListener("click", clearLocalData);

  els.weekLabel.textContent = getWeekLabel();
  hydrateStaticSprites();
  renderAll();
  refreshCloudSettings();
  syncPendingOrders();
  window.addEventListener("online", syncPendingOrders);

  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      state = loadState();
      renderAll();
    }
    if (event.key === OWNER_SETTINGS_KEY) {
      products = buildProducts();
      renderAll();
    }
  });

  window.THANK_YOU_CAI_APP_CORE = Object.freeze({
    products: products.map((product) => ({ ...product })),
    storageKey: STORAGE_KEY,
    ownerSettingsKey: OWNER_SETTINGS_KEY,
  });
})();
