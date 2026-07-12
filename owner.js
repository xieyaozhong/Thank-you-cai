(() => {
  "use strict";

  const catalog = window.THANK_YOU_CAI_CATALOG;
  const cloud = window.THANK_YOU_CAI_CLOUD_CLIENT;
  if (!catalog) throw new Error("找不到蔬果目錄");

  const CUSTOMER_STORAGE_KEY = "thank-you-cai-github-pages-v1";
  const OWNER_SETTINGS_KEY = "thank-you-cai-owner-settings-v1";
  const OWNER_ORDER_META_KEY = "thank-you-cai-owner-order-meta-v1";
  const OWNER_PREFERENCES_KEY = "thank-you-cai-owner-preferences-v1";
  const LOW_STOCK_THRESHOLD = 5;
  const statusNames = { pending: "待確認", confirmed: "已確認", preparing: "備貨中", ready: "可取貨", completed: "已完成", cancelled: "已取消" };
  const statusSteps = ["pending", "confirmed", "preparing", "ready", "completed", "cancelled"];
  const gradeNames = { S: "閃亮特選", A: "新鮮優選", B: "實惠好味", C: "惜食即享" };

  let orders = [];
  let dirty = false;
  let localMode = false;
  let sessionEmail = "";
  let toastTimer = 0;
  let refreshTimer = 0;
  let refreshInProgress = false;
  let knownOrderCodes = new Set();
  let hasLoadedOrders = false;
  const selectedOrderIds = new Set();
  const selectedProductIds = new Set();

  const $ = (selector) => document.querySelector(selector);
  const els = {
    auth: $("#owner-auth"), app: $("#owner-app"), loginForm: $("#owner-login-form"), loginButton: $("#owner-login-button"), logout: $("#owner-logout"), resetPassword: $("#owner-reset-password"), setupHelp: $("#cloud-setup-help"), localPreview: $("#owner-local-preview"), authDescription: $("#auth-description"),
    cloudTitle: $("#owner-cloud-title"), cloudStatus: $("#owner-cloud-status"), modeBadge: $("#owner-mode-badge"),
    list: $("#owner-product-list"), announcement: $("#announcement-input"), announcementCount: $("#announcement-count"), save: $("#save-settings"), stickySave: $("#sticky-save-button"), reset: $("#reset-settings"), saveStatus: $("#save-status"),
    productSearch: $("#product-search"), productCategory: $("#product-category-filter"), productStatus: $("#product-status-filter"), productResultCount: $("#product-result-count"), selectFilteredProducts: $("#select-filtered-products"), selectedProductCount: $("#selected-product-count"),
    orders: $("#owner-orders"), refreshOrders: $("#refresh-orders"), search: $("#order-search"), statusFilter: $("#order-status-filter"), rangeFilter: $("#order-range-filter"), dateFilter: $("#order-date-filter"), sort: $("#order-sort"), clearOrderFilters: $("#clear-order-filters"), exportOrders: $("#export-orders"), lastSynced: $("#last-synced"), orderResultCount: $("#order-result-count"),
    selectAllOrders: $("#select-all-orders"), selectedOrderCount: $("#selected-order-count"), bulkOrderStatus: $("#bulk-order-status"), applyBulkStatus: $("#apply-bulk-status"),
    overviewToday: $("#overview-today"), overviewTodayAmount: $("#overview-today-amount"), overviewPending: $("#overview-pending"), overviewProcessing: $("#overview-processing"), overviewCompleted: $("#overview-completed"), overviewCompletionRate: $("#overview-completion-rate"), overviewRevenue: $("#overview-revenue"), overviewAverage: $("#overview-average"), overviewTotal: $("#overview-total"), weekRevenue: $("#week-revenue"), salesChart: $("#sales-chart"), topProducts: $("#top-products"), lowStockList: $("#low-stock-list"),
    statTotal: $("#stat-total"), statEnabled: $("#stat-enabled"), statStock: $("#stat-stock"), statLowStock: $("#stat-low-stock"), statOrders: $("#stat-orders"), customerLink: $("#customer-link"), copyCustomerLink: $("#copy-customer-link"), toast: $("#owner-toast"),
    enableNotifications: $("#enable-notifications"), systemNotificationButton: $("#system-notification-button"), notificationStatus: $("#notification-status"), autoRefreshToggle: $("#auto-refresh-toggle"), refreshIntervalLabel: $("#refresh-interval-label"), diagnosticMode: $("#diagnostic-mode"), diagnosticDatabase: $("#diagnostic-database"), diagnosticUser: $("#diagnostic-user"), diagnosticSync: $("#diagnostic-sync"),
  };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }

  function money(value) {
    return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  function formatDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "時間不明" : new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
  }

  function localDateKey(value = new Date()) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function renderPixelSprite(key, label) {
    const sprite = catalog.sprites[key];
    if (!sprite) return '<span class="brand__mark" aria-hidden="true">菜</span>';
    return `<span class="pixel-sprite" role="img" aria-label="${escapeHtml(label)}">${sprite.pixels.flatMap((row) => [...row].map((pixel) => `<i${sprite.palette[pixel] ? ` style="background:${sprite.palette[pixel]}"` : ""}></i>`)).join("")}</span>`;
  }

  function showToast(message, isError = false) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.style.background = isError ? "#9e342d" : "";
    els.toast.classList.add("is-visible");
    toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 3600);
  }

  function setCloudStatus(message, ok = false) {
    els.cloudStatus.textContent = message;
    els.cloudTitle.textContent = ok ? "雲端同步已連線" : "攤主工作台";
    els.modeBadge.textContent = localMode ? "本機預覽" : (ok ? "雲端模式" : "連線中");
    els.modeBadge.classList.toggle("is-cloud", ok && !localMode);
    els.modeBadge.classList.toggle("is-local", localMode);
  }

  function setDirty(value = true) {
    dirty = value;
    els.saveStatus.textContent = value ? (localMode ? "有尚未儲存的本機修改" : "有尚未同步的修改") : (localMode ? "設定已保存在本機" : "設定已同步");
  }

  function loadJson(storage, key, fallback) {
    try {
      const value = JSON.parse(storage.getItem(key) || "null");
      return value && typeof value === "object" ? value : fallback;
    } catch { return fallback; }
  }

  function loadPreferences() {
    return { autoRefresh: true, ...loadJson(localStorage, OWNER_PREFERENCES_KEY, {}) };
  }

  function savePreferences(patch) {
    const next = { ...loadPreferences(), ...patch };
    localStorage.setItem(OWNER_PREFERENCES_KEY, JSON.stringify(next));
    return next;
  }

  function loadLocalSettings() {
    return loadJson(localStorage, OWNER_SETTINGS_KEY, { announcement: "", products: {} });
  }

  function saveLocalSettings(settings) {
    localStorage.setItem(OWNER_SETTINGS_KEY, JSON.stringify(settings));
  }

  function loadLocalOrderMeta() {
    return loadJson(localStorage, OWNER_ORDER_META_KEY, {});
  }

  function saveLocalOrderMeta(meta) {
    localStorage.setItem(OWNER_ORDER_META_KEY, JSON.stringify(meta));
  }

  function orderKey(order) {
    return String(order.id || order.order_code || "");
  }

  function loadLocalOrders() {
    const state = loadJson(localStorage, CUSTOMER_STORAGE_KEY, { orders: [] });
    const meta = loadLocalOrderMeta();
    return (Array.isArray(state.orders) ? state.orders : []).map((order, index) => {
      const code = String(order.id || `LOCAL-${index + 1}`);
      const ownerMeta = meta[code] || {};
      return {
        id: code,
        order_code: code,
        created_at: order.createdAt || new Date(0).toISOString(),
        updated_at: ownerMeta.updatedAt || order.createdAt || new Date(0).toISOString(),
        customer_name: order.nickname || "小菜友",
        contact: order.contact || "未提供",
        pickup_slot: order.slot || "未選擇",
        note: order.note || "",
        items: Array.isArray(order.lines) ? order.lines : [],
        subtotal: Number(order.subtotal) || 0,
        delivery: Number(order.delivery) || 0,
        total: Number(order.total) || 0,
        status: statusNames[order.status] ? order.status : "pending",
        owner_note: ownerMeta.ownerNote || "",
        priority: Boolean(ownerMeta.priority),
        _local: true,
      };
    });
  }

  function updateLocalOrderStatus(code, status) {
    const state = loadJson(localStorage, CUSTOMER_STORAGE_KEY, { cart: {}, orders: [], points: 0, collection: {} });
    if (!Array.isArray(state.orders)) state.orders = [];
    const target = state.orders.find((order) => String(order.id) === String(code));
    if (!target) throw new Error("找不到本機訂單。");
    target.status = status;
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(state));
  }

  function updateLocalOrderMeta(code, patch) {
    const meta = loadLocalOrderMeta();
    meta[code] = { ...(meta[code] || {}), ...patch, updatedAt: new Date().toISOString() };
    saveLocalOrderMeta(meta);
  }

  function productRowValues(row) {
    return {
      id: row.dataset.productId,
      price: Math.max(0, Math.round(Number(row.querySelector('[data-field="price"]').value) || 0)),
      stock: Math.max(0, Math.round(Number(row.querySelector('[data-field="stock"]').value) || 0)),
      enabled: row.querySelector('[data-field="enabled"]').checked,
    };
  }

  function renderProducts(settings = loadLocalSettings()) {
    const overrides = settings.products || {};
    els.announcement.value = String(settings.announcement || "").slice(0, 120);
    els.announcementCount.textContent = els.announcement.value.length;
    selectedProductIds.clear();
    els.list.innerHTML = catalog.products.map((product) => {
      const override = overrides[product.id] || {};
      const price = Number.isFinite(Number(override.price)) ? Math.max(0, Math.round(Number(override.price))) : product.price;
      const stock = Number.isFinite(Number(override.stock)) ? Math.max(0, Math.round(Number(override.stock))) : product.stock;
      const enabled = override.enabled !== false;
      const low = enabled && stock <= LOW_STOCK_THRESHOLD;
      return `<article class="owner-product-row${enabled ? "" : " is-disabled"}${low ? " is-low-stock" : ""}" data-product-id="${escapeHtml(product.id)}" data-category="${escapeHtml(product.category)}" data-search="${escapeHtml(`${product.name} ${product.cardName} ${product.origin}`.toLowerCase())}">
        <input class="product-select" type="checkbox" aria-label="選取 ${escapeHtml(product.name)}" />
        <div class="owner-product-ident">${renderPixelSprite(product.sprite, product.name)}<div><strong>${escapeHtml(product.name)}</strong><small>${product.grade} 級・${escapeHtml(gradeNames[product.grade])}・${escapeHtml(product.origin)}</small>${low ? `<span class="stock-warning">${stock === 0 ? "已售罄" : `低庫存 ${stock}`}</span>` : ""}</div></div>
        <label>售價（NT$）<input data-field="price" type="number" inputmode="numeric" min="0" max="99999" value="${price}" /></label>
        <label>庫存<div class="stock-control"><button type="button" data-stock-delta="-1" aria-label="庫存減一">−</button><input data-field="stock" type="number" inputmode="numeric" min="0" max="9999" value="${stock}" /><button type="button" data-stock-delta="1" aria-label="庫存加一">＋</button></div></label>
        <label class="owner-toggle"><input data-field="enabled" type="checkbox" ${enabled ? "checked" : ""}/><span>${enabled ? "已上架" : "已下架"}</span></label>
      </article>`;
    }).join("");
    filterProducts();
    updateProductStats();
    setDirty(false);
  }

  function collectSettings() {
    const products = {};
    els.list.querySelectorAll("[data-product-id]").forEach((row) => {
      const values = productRowValues(row);
      products[values.id] = { price: values.price, stock: values.stock, enabled: values.enabled };
    });
    return { announcement: els.announcement.value.trim().slice(0, 120), products, updatedAt: new Date().toISOString() };
  }

  function visibleProductRows() {
    return [...els.list.querySelectorAll("[data-product-id]")].filter((row) => !row.hidden);
  }

  function filterProducts() {
    const query = els.productSearch.value.trim().toLowerCase();
    const category = els.productCategory.value;
    const status = els.productStatus.value;
    let visible = 0;
    els.list.querySelectorAll("[data-product-id]").forEach((row) => {
      const values = productRowValues(row);
      const matchesQuery = !query || row.dataset.search.includes(query);
      const matchesCategory = category === "all" || row.dataset.category === category;
      const matchesStatus = status === "all" || (status === "enabled" && values.enabled) || (status === "disabled" && !values.enabled) || (status === "low" && values.enabled && values.stock <= LOW_STOCK_THRESHOLD) || (status === "out" && values.stock === 0);
      row.hidden = !(matchesQuery && matchesCategory && matchesStatus);
      if (!row.hidden) visible += 1;
    });
    els.productResultCount.textContent = `顯示 ${visible} 項商品`;
    syncProductSelectionUi();
  }

  function updateProductRowAppearance(row) {
    const values = productRowValues(row);
    row.classList.toggle("is-disabled", !values.enabled);
    row.classList.toggle("is-low-stock", values.enabled && values.stock <= LOW_STOCK_THRESHOLD);
    row.querySelector(".owner-toggle span").textContent = values.enabled ? "已上架" : "已下架";
    const identity = row.querySelector(".owner-product-ident div");
    let warning = identity.querySelector(".stock-warning");
    if (values.enabled && values.stock <= LOW_STOCK_THRESHOLD) {
      if (!warning) { warning = document.createElement("span"); warning.className = "stock-warning"; identity.append(warning); }
      warning.textContent = values.stock === 0 ? "已售罄" : `低庫存 ${values.stock}`;
    } else warning?.remove();
  }

  function updateProductStats() {
    const rows = [...els.list.querySelectorAll("[data-product-id]")];
    const values = rows.map(productRowValues);
    const enabled = values.filter((item) => item.enabled);
    const low = enabled.filter((item) => item.stock <= LOW_STOCK_THRESHOLD);
    els.statTotal.textContent = rows.length;
    els.statEnabled.textContent = enabled.length;
    els.statStock.textContent = enabled.reduce((sum, item) => sum + item.stock, 0);
    els.statLowStock.textContent = low.length;
    els.statOrders.textContent = orders.length;
    renderLowStock();
  }

  function syncProductSelectionUi() {
    els.list.querySelectorAll("[data-product-id]").forEach((row) => {
      row.querySelector(".product-select").checked = selectedProductIds.has(row.dataset.productId);
    });
    els.selectedProductCount.textContent = `已選 ${selectedProductIds.size} 項`;
  }

  function bulkEditProducts(action) {
    if (action === "clear") {
      selectedProductIds.clear();
      syncProductSelectionUi();
      return;
    }
    if (!selectedProductIds.size) { showToast("請先選取商品。", true); return; }
    els.list.querySelectorAll("[data-product-id]").forEach((row) => {
      if (!selectedProductIds.has(row.dataset.productId)) return;
      const enabled = row.querySelector('[data-field="enabled"]');
      const stock = row.querySelector('[data-field="stock"]');
      if (action === "enable") enabled.checked = true;
      if (action === "disable") enabled.checked = false;
      if (action === "add10") stock.value = Math.min(9999, Math.max(0, Number(stock.value) || 0) + 10);
      updateProductRowAppearance(row);
    });
    setDirty(true);
    filterProducts();
    updateProductStats();
  }

  function orderSearchText(order) {
    const itemNames = (Array.isArray(order.items) ? order.items : []).map((item) => item.name || "").join(" ");
    return `${order.order_code} ${order.customer_name} ${order.contact} ${order.pickup_slot} ${order.note || ""} ${order.owner_note || ""} ${itemNames}`.toLowerCase();
  }

  function filteredOrders() {
    const query = els.search.value.trim().toLowerCase();
    const status = els.statusFilter.value;
    const range = els.rangeFilter.value;
    const date = els.dateFilter.value;
    const now = new Date();
    const todayKey = localDateKey(now);
    const rangeStart = range === "7" || range === "30" ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - (Number(range) - 1)) : null;
    const list = orders.filter((order) => {
      const created = new Date(order.created_at);
      const matchesQuery = !query || orderSearchText(order).includes(query);
      const matchesStatus = status === "all" || order.status === status;
      const matchesDate = !date || localDateKey(created) === date;
      const matchesRange = range === "all" || (range === "today" && localDateKey(created) === todayKey) || (rangeStart && created >= rangeStart);
      return matchesQuery && matchesStatus && matchesDate && matchesRange;
    });
    return list.sort((a, b) => {
      if (els.sort.value === "oldest") return new Date(a.created_at) - new Date(b.created_at);
      if (els.sort.value === "total-desc") return Number(b.total || 0) - Number(a.total || 0);
      if (els.sort.value === "pickup") return String(a.pickup_slot).localeCompare(String(b.pickup_slot), "zh-Hant");
      return new Date(b.created_at) - new Date(a.created_at);
    });
  }

  function contactLink(contact) {
    const value = String(contact || "").trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return `mailto:${encodeURIComponent(value)}`;
    const digits = value.replace(/[^0-9+]/g, "");
    if (digits.replace(/\D/g, "").length >= 8) return `tel:${digits}`;
    return "";
  }

  function renderOrders() {
    const list = filteredOrders();
    const existingIds = new Set(orders.map(orderKey));
    [...selectedOrderIds].forEach((id) => { if (!existingIds.has(id)) selectedOrderIds.delete(id); });
    updateOverview();
    els.orderResultCount.textContent = `顯示 ${list.length} 張訂單（全部 ${orders.length} 張）`;
    if (!list.length) {
      els.orders.innerHTML = '<div class="owner-empty"><strong>沒有符合條件的訂單</strong><p>調整搜尋或篩選條件後再試一次。</p></div>';
      syncOrderSelectionUi(list);
      return;
    }
    els.orders.innerHTML = list.map((order) => {
      const items = Array.isArray(order.items) ? order.items : [];
      const quantity = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const id = orderKey(order);
      const href = contactLink(order.contact);
      const contact = href ? `<a href="${escapeHtml(href)}">${escapeHtml(order.contact)}</a>` : `<span>${escapeHtml(order.contact)}</span>`;
      return `<article class="owner-order-card${order.priority ? " is-priority" : ""}" data-order-id="${escapeHtml(id)}" data-status="${escapeHtml(order.status)}">
        <header>
          <div class="order-heading"><input class="order-checkbox" type="checkbox" aria-label="選取訂單 ${escapeHtml(order.order_code)}" ${selectedOrderIds.has(id) ? "checked" : ""}/><div><small>${escapeHtml(formatDate(order.created_at))}${order._local ? "・本機訂單" : ""}</small><h3>${escapeHtml(order.order_code)}</h3></div></div>
          <div class="order-header-actions"><button type="button" class="priority-button${order.priority ? " is-active" : ""}" data-order-action="priority" aria-pressed="${order.priority ? "true" : "false"}">${order.priority ? "★ 優先" : "☆ 標為優先"}</button><select class="order-status-select" data-current="${escapeHtml(order.status)}" aria-label="訂單狀態">${Object.entries(statusNames).map(([value, name]) => `<option value="${value}" ${value === order.status ? "selected" : ""}>${name}</option>`).join("")}</select></div>
        </header>
        <div class="owner-order-customer"><div><small>顧客</small><strong>${escapeHtml(order.customer_name)}</strong></div><div><small>聯絡方式</small>${contact}</div><div><small>取貨時段</small><span>${escapeHtml(order.pickup_slot)}</span></div></div>
        <details><summary>${quantity} 件商品・查看訂單明細</summary><div class="owner-order-lines">${items.map((item) => `<div><span>${escapeHtml(item.name)} × ${Number(item.quantity) || 0}${item.unit ? `（${escapeHtml(item.unit)}）` : ""}</span><strong>${money((Number(item.price) || 0) * (Number(item.quantity) || 0))}</strong></div>`).join("")}</div>${order.note ? `<p class="owner-order-note"><strong>顧客備註：</strong>${escapeHtml(order.note)}</p>` : ""}</details>
        <div class="order-owner-tools"><label>攤主內部備註<textarea class="owner-note-field" maxlength="500" placeholder="例如：已電話確認、需分袋、延後取貨…">${escapeHtml(order.owner_note || "")}</textarea></label><button type="button" class="secondary-button" data-order-action="save-note">儲存備註</button></div>
        <footer class="order-card-footer"><div class="order-card-footer__actions"><button type="button" class="secondary-button" data-order-action="copy">複製摘要</button><button type="button" class="secondary-button" data-order-action="print">列印訂單</button></div><div class="order-card-total"><span>訂單合計</span><strong>${money(order.total)}</strong></div></footer>
      </article>`;
    }).join("");
    syncOrderSelectionUi(list);
  }

  function syncOrderSelectionUi(list = filteredOrders()) {
    const visibleIds = list.map(orderKey);
    const selectedVisible = visibleIds.filter((id) => selectedOrderIds.has(id)).length;
    els.selectAllOrders.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
    els.selectAllOrders.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
    els.selectedOrderCount.textContent = `已選 ${selectedOrderIds.size} 張`;
    els.applyBulkStatus.disabled = !selectedOrderIds.size || !els.bulkOrderStatus.value;
  }

  function updateOverview() {
    const activeOrders = orders.filter((order) => order.status !== "cancelled");
    const today = localDateKey();
    const todayOrders = activeOrders.filter((order) => localDateKey(order.created_at) === today);
    const pending = orders.filter((order) => order.status === "pending");
    const processing = orders.filter((order) => ["confirmed", "preparing", "ready"].includes(order.status));
    const completed = orders.filter((order) => order.status === "completed");
    const revenue = completed.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const average = activeOrders.length ? activeOrders.reduce((sum, order) => sum + Number(order.total || 0), 0) / activeOrders.length : 0;
    const completionRate = activeOrders.length ? Math.round(completed.length / activeOrders.length * 100) : 0;
    els.overviewToday.textContent = todayOrders.length;
    els.overviewTodayAmount.textContent = money(todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0));
    els.overviewPending.textContent = pending.length;
    els.overviewProcessing.textContent = processing.length;
    els.overviewCompleted.textContent = completed.length;
    els.overviewCompletionRate.textContent = `完成率 ${completionRate}%`;
    els.overviewRevenue.textContent = money(revenue);
    els.overviewAverage.textContent = money(average);
    els.overviewTotal.textContent = `共 ${orders.length} 張訂單`;
    els.statOrders.textContent = orders.length;
    renderSalesChart();
    renderTopProducts();
    renderLowStock();
  }

  function renderSalesChart() {
    const days = [];
    const now = new Date();
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
      const key = localDateKey(date);
      const total = orders.filter((order) => order.status === "completed" && localDateKey(order.created_at) === key).reduce((sum, order) => sum + Number(order.total || 0), 0);
      days.push({ key, label: `${date.getMonth() + 1}/${date.getDate()}`, total });
    }
    const max = Math.max(1, ...days.map((day) => day.total));
    els.weekRevenue.textContent = money(days.reduce((sum, day) => sum + day.total, 0));
    els.salesChart.innerHTML = days.map((day) => `<div class="sales-bar" title="${escapeHtml(day.key)}：${escapeHtml(money(day.total))}"><div class="sales-bar__track"><span class="sales-bar__fill" style="height:${Math.max(day.total ? 5 : 0, Math.round(day.total / max * 100))}%"></span></div><strong>${day.total ? escapeHtml(money(day.total)) : "—"}</strong><small>${escapeHtml(day.label)}</small></div>`).join("");
  }

  function renderTopProducts() {
    const totals = new Map();
    orders.filter((order) => order.status !== "cancelled").forEach((order) => {
      (Array.isArray(order.items) ? order.items : []).forEach((item) => {
        const name = String(item.name || "未命名商品");
        totals.set(name, (totals.get(name) || 0) + Number(item.quantity || 0));
      });
    });
    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    els.topProducts.innerHTML = ranked.length ? ranked.map(([name, count], index) => `<div><b>${index + 1}</b><span>${escapeHtml(name)}</span><strong>${count} 件</strong></div>`).join("") : '<p class="insight-empty">有訂單後會顯示熱銷排行。</p>';
  }

  function renderLowStock() {
    if (!els.list.children.length) return;
    const lows = [...els.list.querySelectorAll("[data-product-id]")].map((row) => {
      const product = catalog.products.find((item) => item.id === row.dataset.productId);
      return { ...productRowValues(row), name: product?.name || row.dataset.productId };
    }).filter((item) => item.enabled && item.stock <= LOW_STOCK_THRESHOLD).sort((a, b) => a.stock - b.stock).slice(0, 6);
    els.lowStockList.innerHTML = lows.length ? lows.map((item) => `<div><span aria-hidden="true">${item.stock === 0 ? "●" : "▲"}</span><span>${escapeHtml(item.name)}</span><strong class="${item.stock === 0 ? "is-danger" : ""}">${item.stock === 0 ? "售罄" : `${item.stock} 件`}</strong></div>`).join("") : '<p class="insight-empty">目前沒有低庫存商品。</p>';
  }

  function newOrderNotice(newOrders) {
    if (!newOrders.length) return;
    const total = newOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
    showToast(`收到 ${newOrders.length} 張新訂單，合計 ${money(total)}。`);
    beep();
    if (Notification.permission === "granted") {
      new Notification("謝謝你，菜！收到新訂單", { body: `${newOrders.length} 張新訂單，合計 ${money(total)}`, icon: "./og.png" });
    }
  }

  function beep() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 720;
      gain.gain.setValueAtTime(.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.12, context.currentTime + .02);
      gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .22);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + .24);
      oscillator.addEventListener("ended", () => context.close());
    } catch { /* Notification sound is optional. */ }
  }

  async function requestNotifications() {
    if (!("Notification" in window)) { showToast("此瀏覽器不支援系統通知。", true); return; }
    const permission = await Notification.requestPermission();
    updateNotificationUi();
    showToast(permission === "granted" ? "已開啟新訂單通知。" : "未取得通知權限。", permission !== "granted");
  }

  function updateNotificationUi() {
    const supported = "Notification" in window;
    const permission = supported ? Notification.permission : "unsupported";
    const text = permission === "granted" ? "新訂單通知已開啟。" : permission === "denied" ? "通知已被瀏覽器封鎖，請到網站設定重新允許。" : permission === "unsupported" ? "此瀏覽器不支援系統通知。" : "尚未開啟通知。";
    els.notificationStatus.textContent = text;
    els.enableNotifications.textContent = permission === "granted" ? "新訂單通知已開啟" : "開啟新訂單通知";
    els.enableNotifications.disabled = permission === "granted" || permission === "unsupported";
    els.systemNotificationButton.textContent = permission === "granted" ? "通知已開啟" : "設定新訂單通知";
    els.systemNotificationButton.disabled = permission === "granted" || permission === "unsupported";
  }

  async function refreshOrders(options = {}) {
    if (refreshInProgress) return;
    refreshInProgress = true;
    els.refreshOrders.disabled = true;
    els.refreshOrders.textContent = "同步中…";
    try {
      const nextOrders = localMode ? loadLocalOrders() : await cloud.listOrders();
      const currentCodes = new Set(nextOrders.map((order) => order.order_code));
      if (hasLoadedOrders && !options.silent) {
        const fresh = nextOrders.filter((order) => !knownOrderCodes.has(order.order_code));
        newOrderNotice(fresh);
      }
      orders = nextOrders;
      knownOrderCodes = currentCodes;
      hasLoadedOrders = true;
      const now = new Date();
      els.lastSynced.textContent = `${localMode ? "本機讀取" : "最後同步"}：${formatTime(now)}`;
      els.diagnosticSync.textContent = formatDate(now);
      setCloudStatus(localMode ? "目前顯示這台裝置建立的訂單。" : "所有顧客訂單已同步。", !localMode);
      renderOrders();
    } catch (error) {
      showToast(error.message, true);
      if (error.status === 401) showLogin();
    } finally {
      refreshInProgress = false;
      els.refreshOrders.disabled = false;
      els.refreshOrders.textContent = "立即同步";
    }
  }

  async function saveSettings() {
    const settings = collectSettings();
    try {
      els.save.disabled = true;
      els.stickySave.disabled = true;
      if (!localMode) await cloud.saveStoreSettings(settings);
      saveLocalSettings(settings);
      setDirty(false);
      showToast(localMode ? "商品與公告已保存在這台裝置。" : "商品與公告已同步到所有顧客端。");
    } catch (error) {
      showToast(error.message, true);
    } finally {
      els.save.disabled = false;
      els.stickySave.disabled = false;
    }
  }

  async function loadRemoteSettings() {
    if (localMode) { renderProducts(); return; }
    try {
      const remote = await cloud.getStoreSettings();
      if (remote) {
        const settings = { announcement: remote.announcement || "", products: remote.products || {}, updatedAt: remote.updated_at };
        saveLocalSettings(settings);
        renderProducts(settings);
      } else renderProducts();
    } catch (error) {
      renderProducts();
      showToast(`商品設定改用本機快取：${error.message}`, true);
    }
  }

  async function setOrderStatus(order, status) {
    if (!statusNames[status]) throw new Error("不支援的訂單狀態。");
    if (order._local || localMode) updateLocalOrderStatus(order.order_code, status);
    else await cloud.updateOrderStatus(order.id, status);
    order.status = status;
    order.updated_at = new Date().toISOString();
  }

  async function applyBulkStatus() {
    const status = els.bulkOrderStatus.value;
    if (!status || !selectedOrderIds.size) return;
    const selected = orders.filter((order) => selectedOrderIds.has(orderKey(order)));
    if (!confirm(`確定將 ${selected.length} 張訂單更新為「${statusNames[status]}」嗎？`)) return;
    els.applyBulkStatus.disabled = true;
    try {
      const cloudOrders = selected.filter((order) => !order._local && !localMode);
      if (cloudOrders.length) await cloud.updateOrdersStatus(cloudOrders.map((order) => order.id), status);
      selected.filter((order) => order._local || localMode).forEach((order) => updateLocalOrderStatus(order.order_code, status));
      selected.forEach((order) => { order.status = status; order.updated_at = new Date().toISOString(); });
      selectedOrderIds.clear();
      els.bulkOrderStatus.value = "";
      renderOrders();
      showToast(`已更新 ${selected.length} 張訂單。`);
    } catch (error) {
      showToast(error.message, true);
    } finally {
      syncOrderSelectionUi();
    }
  }

  async function saveOrderMeta(order, patch) {
    if (order._local || localMode) updateLocalOrderMeta(order.order_code, patch);
    else await cloud.updateOrderDetails(order.id, patch);
    if (Object.hasOwn(patch, "ownerNote")) order.owner_note = patch.ownerNote;
    if (Object.hasOwn(patch, "priority")) order.priority = patch.priority;
    order.updated_at = new Date().toISOString();
  }

  function orderSummary(order) {
    const lines = (Array.isArray(order.items) ? order.items : []).map((item) => `- ${item.name} × ${Number(item.quantity) || 0}：${money((Number(item.price) || 0) * (Number(item.quantity) || 0))}`).join("\n");
    return [`【謝謝你，菜！訂單】`, `訂單編號：${order.order_code}`, `狀態：${statusNames[order.status] || order.status}`, `顧客：${order.customer_name}`, `聯絡：${order.contact}`, `取貨：${order.pickup_slot}`, "", lines, "", `小計：${money(order.subtotal)}`, `運費：${money(order.delivery)}`, `合計：${money(order.total)}`, order.note ? `顧客備註：${order.note}` : "", order.owner_note ? `攤主備註：${order.owner_note}` : ""].filter(Boolean).join("\n");
  }

  async function copyOrder(order) {
    const text = orderSummary(order);
    try { await navigator.clipboard.writeText(text); showToast("訂單摘要已複製。"); }
    catch { prompt("複製訂單摘要：", text); }
  }

  function printOrder(order) {
    const popup = window.open("", "_blank", "width=760,height=900");
    if (!popup) { showToast("瀏覽器封鎖了列印視窗。", true); return; }
    const items = (Array.isArray(order.items) ? order.items : []).map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${Number(item.quantity) || 0}</td><td>${escapeHtml(money(item.price))}</td><td>${escapeHtml(money((Number(item.price) || 0) * (Number(item.quantity) || 0)))}</td></tr>`).join("");
    popup.document.write(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${escapeHtml(order.order_code)}</title><style>body{font-family:system-ui,sans-serif;max-width:720px;margin:32px auto;color:#183427}h1{margin-bottom:4px}small{color:#666}section{margin:20px 0;padding:14px;border:1px solid #aaa;border-radius:10px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd;text-align:left}.total{text-align:right;font-size:1.35rem;font-weight:800}@media print{body{margin:0}button{display:none}}</style></head><body><h1>謝謝你，菜！訂單</h1><small>${escapeHtml(formatDate(order.created_at))}</small><section><strong>${escapeHtml(order.order_code)}</strong><p>狀態：${escapeHtml(statusNames[order.status] || order.status)}<br>顧客：${escapeHtml(order.customer_name)}<br>聯絡：${escapeHtml(order.contact)}<br>取貨：${escapeHtml(order.pickup_slot)}</p></section><table><thead><tr><th>商品</th><th>數量</th><th>單價</th><th>金額</th></tr></thead><tbody>${items}</tbody></table>${order.note ? `<p>顧客備註：${escapeHtml(order.note)}</p>` : ""}${order.owner_note ? `<p>攤主備註：${escapeHtml(order.owner_note)}</p>` : ""}<p class="total">合計 ${escapeHtml(money(order.total))}</p><button onclick="window.print()">列印</button><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  }

  function csvCell(value) {
    const text = String(value ?? "");
    return `"${text.replaceAll('"', '""')}"`;
  }

  function exportCsv() {
    const list = filteredOrders();
    if (!list.length) { showToast("目前沒有可匯出的訂單。", true); return; }
    const rows = [["訂單編號", "建立時間", "狀態", "顧客", "聯絡方式", "取貨時段", "商品明細", "小計", "運費", "合計", "顧客備註", "攤主備註", "優先"]];
    list.forEach((order) => rows.push([order.order_code, formatDate(order.created_at), statusNames[order.status] || order.status, order.customer_name, order.contact, order.pickup_slot, (order.items || []).map((item) => `${item.name}×${item.quantity}`).join("；"), order.subtotal, order.delivery, order.total, order.note || "", order.owner_note || "", order.priority ? "是" : "否"]));
    const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `thank-you-cai-orders-${localDateKey()}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`已匯出 ${list.length} 張訂單。`);
  }

  function updateDiagnostics() {
    els.diagnosticMode.textContent = localMode ? "本機預覽模式" : "雲端營運模式";
    els.diagnosticDatabase.textContent = cloud?.isConfigured() ? "Supabase 已設定" : "尚未設定";
    els.diagnosticUser.textContent = sessionEmail || (localMode ? "本機預覽，未登入" : "—");
    const interval = Math.max(5, Math.round((Number(cloud?.config?.refreshIntervalMs) || 10000) / 1000));
    els.refreshIntervalLabel.textContent = interval;
  }

  function setRefreshTimer() {
    clearInterval(refreshTimer);
    const preferences = loadPreferences();
    els.autoRefreshToggle.checked = preferences.autoRefresh !== false;
    if (preferences.autoRefresh !== false && !localMode) {
      refreshTimer = setInterval(() => refreshOrders({ silent: false }), Math.max(5000, Number(cloud.config.refreshIntervalMs) || 10000));
    }
  }

  function showLogin() {
    clearInterval(refreshTimer);
    localMode = false;
    sessionEmail = "";
    els.app.hidden = true;
    els.auth.hidden = false;
    els.logout.textContent = "登出";
    setCloudStatus(cloud?.isConfigured() ? "請登入攤主帳號。" : "雲端資料庫尚未設定。", false);
    updateDiagnostics();
  }

  async function showDashboard(options = {}) {
    localMode = Boolean(options.local);
    sessionEmail = options.email || "";
    els.auth.hidden = true;
    els.app.hidden = false;
    els.logout.textContent = localMode ? "離開預覽" : "登出";
    selectedOrderIds.clear();
    knownOrderCodes = new Set();
    hasLoadedOrders = false;
    updateDiagnostics();
    await Promise.all([loadRemoteSettings(), refreshOrders({ silent: true })]);
    setRefreshTimer();
  }

  async function init() {
    const customerUrl = new URL("./customer.html", location.href).href;
    els.customerLink.textContent = customerUrl;
    updateNotificationUi();
    updateDiagnostics();
    if (!cloud?.isConfigured()) {
      els.setupHelp.hidden = false;
      els.loginForm.hidden = true;
      els.resetPassword.hidden = true;
      els.authDescription.textContent = "目前尚未連接雲端資料庫，可先預覽完整攤主功能與同裝置訂單。";
      setCloudStatus("雲端資料庫尚未設定。", false);
      return;
    }
    const session = await cloud.getSession();
    if (!session) { showLogin(); return; }
    try {
      const allowed = await cloud.checkOwnerAccess();
      if (!allowed) {
        await cloud.signOut();
        showLogin();
        showToast("這個帳號尚未加入 owner_accounts，無法開啟攤主工作台。", true);
        return;
      }
      setCloudStatus(`已登入 ${session.email}`, true);
      await showDashboard({ email: session.email });
    } catch (error) {
      showLogin();
      showToast(error.message, true);
    }
  }

  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    els.loginButton.disabled = true;
    els.loginButton.textContent = "登入中…";
    try {
      const session = await cloud.signIn(form.get("email"), form.get("password"), form.get("remember") === "on");
      const allowed = await cloud.checkOwnerAccess();
      if (!allowed) {
        await cloud.signOut();
        throw new Error("登入成功，但此帳號尚未加入 owner_accounts。");
      }
      setCloudStatus(`已登入 ${session.email}`, true);
      await showDashboard({ email: session.email });
    } catch (error) {
      showToast(error.message, true);
    } finally {
      els.loginButton.disabled = false;
      els.loginButton.textContent = "登入工作台";
    }
  });

  els.resetPassword.addEventListener("click", async () => {
    const email = els.loginForm.elements.email.value;
    try {
      await cloud.requestPasswordReset(email, new URL("./owner.html", location.href).href);
      showToast("密碼重設信已寄出；請確認 Supabase Redirect URL 已包含此攤主頁網址。");
    } catch (error) { showToast(error.message, true); }
  });

  els.localPreview.addEventListener("click", () => showDashboard({ local: true }));
  els.logout.addEventListener("click", async () => {
    if (!localMode) await cloud.signOut();
    showLogin();
    setCloudStatus(localMode ? "已離開本機預覽。" : "已安全登出。", false);
  });

  els.refreshOrders.addEventListener("click", () => refreshOrders({ silent: false }));
  [els.search, els.statusFilter, els.rangeFilter, els.dateFilter, els.sort].forEach((element) => element.addEventListener("input", renderOrders));
  els.clearOrderFilters.addEventListener("click", () => {
    els.search.value = ""; els.statusFilter.value = "all"; els.rangeFilter.value = "all"; els.dateFilter.value = ""; els.sort.value = "newest"; renderOrders();
  });
  els.exportOrders.addEventListener("click", exportCsv);
  els.bulkOrderStatus.addEventListener("change", () => syncOrderSelectionUi());
  els.applyBulkStatus.addEventListener("click", applyBulkStatus);
  els.selectAllOrders.addEventListener("change", () => {
    filteredOrders().forEach((order) => {
      const id = orderKey(order);
      if (els.selectAllOrders.checked) selectedOrderIds.add(id); else selectedOrderIds.delete(id);
    });
    renderOrders();
  });

  els.orders.addEventListener("change", async (event) => {
    const checkbox = event.target.closest(".order-checkbox");
    if (checkbox) {
      const card = checkbox.closest("[data-order-id]");
      if (checkbox.checked) selectedOrderIds.add(card.dataset.orderId); else selectedOrderIds.delete(card.dataset.orderId);
      syncOrderSelectionUi();
      return;
    }
    const select = event.target.closest(".order-status-select");
    if (!select) return;
    const card = select.closest("[data-order-id]");
    const order = orders.find((item) => orderKey(item) === card.dataset.orderId);
    if (!order) return;
    const previous = select.dataset.current;
    select.disabled = true;
    try {
      await setOrderStatus(order, select.value);
      select.dataset.current = select.value;
      card.dataset.status = select.value;
      updateOverview();
      showToast(`訂單已更新為「${statusNames[select.value]}」。`);
    } catch (error) {
      select.value = previous;
      showToast(error.message, true);
    } finally { select.disabled = false; }
  });

  els.orders.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-order-action]");
    if (!button) return;
    const card = button.closest("[data-order-id]");
    const order = orders.find((item) => orderKey(item) === card.dataset.orderId);
    if (!order) return;
    const action = button.dataset.orderAction;
    if (action === "copy") { await copyOrder(order); return; }
    if (action === "print") { printOrder(order); return; }
    button.disabled = true;
    try {
      if (action === "priority") {
        await saveOrderMeta(order, { priority: !order.priority });
        renderOrders();
        showToast(order.priority ? "已標為優先訂單。" : "已取消優先標記。");
      }
      if (action === "save-note") {
        const note = card.querySelector(".owner-note-field").value.trim().slice(0, 500);
        await saveOrderMeta(order, { ownerNote: note });
        showToast(localMode ? "攤主備註已保存在本機。" : "攤主備註已同步。");
      }
    } catch (error) { showToast(error.message, true); }
    finally { button.disabled = false; }
  });

  els.list.addEventListener("input", (event) => {
    const row = event.target.closest("[data-product-id]");
    if (!row) return;
    if (event.target.classList.contains("product-select")) {
      if (event.target.checked) selectedProductIds.add(row.dataset.productId); else selectedProductIds.delete(row.dataset.productId);
      syncProductSelectionUi();
      return;
    }
    updateProductRowAppearance(row);
    setDirty(true);
    filterProducts();
    updateProductStats();
  });

  els.list.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stock-delta]");
    if (!button) return;
    const row = button.closest("[data-product-id]");
    const input = row.querySelector('[data-field="stock"]');
    input.value = Math.min(9999, Math.max(0, (Number(input.value) || 0) + Number(button.dataset.stockDelta)));
    updateProductRowAppearance(row);
    setDirty(true);
    filterProducts();
    updateProductStats();
  });

  [els.productSearch, els.productCategory, els.productStatus].forEach((element) => element.addEventListener("input", filterProducts));
  els.selectFilteredProducts.addEventListener("click", () => {
    visibleProductRows().forEach((row) => selectedProductIds.add(row.dataset.productId));
    syncProductSelectionUi();
  });
  document.querySelector(".product-bulk-bar").addEventListener("click", (event) => {
    const button = event.target.closest("[data-product-bulk]");
    if (button) bulkEditProducts(button.dataset.productBulk);
  });

  els.announcement.addEventListener("input", () => { els.announcementCount.textContent = els.announcement.value.length; setDirty(true); });
  els.save.addEventListener("click", saveSettings);
  els.stickySave.addEventListener("click", saveSettings);
  els.reset.addEventListener("click", () => {
    if (confirm("確定恢復全部商品的預設價格、庫存與上下架狀態嗎？")) {
      localStorage.removeItem(OWNER_SETTINGS_KEY);
      renderProducts();
      setDirty(true);
    }
  });

  els.copyCustomerLink.addEventListener("click", async () => {
    const url = new URL("./customer.html", location.href).href;
    try { await navigator.clipboard.writeText(url); showToast("顧客連結已複製。"); }
    catch { prompt("複製顧客連結：", url); }
  });

  els.enableNotifications.addEventListener("click", requestNotifications);
  els.systemNotificationButton.addEventListener("click", requestNotifications);
  els.autoRefreshToggle.addEventListener("change", () => {
    savePreferences({ autoRefresh: els.autoRefreshToggle.checked });
    setRefreshTimer();
    showToast(els.autoRefreshToggle.checked ? "已開啟自動同步。" : "已關閉自動同步，可使用「立即同步」。");
  });

  addEventListener("online", () => refreshOrders({ silent: false }));
  document.addEventListener("visibilitychange", () => { if (!document.hidden && !els.app.hidden) refreshOrders({ silent: true }); });
  addEventListener("storage", (event) => {
    if (localMode && [CUSTOMER_STORAGE_KEY, OWNER_SETTINGS_KEY].includes(event.key)) {
      loadRemoteSettings();
      refreshOrders({ silent: false });
    }
  });
  addEventListener("beforeunload", (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });

  init();
})();
