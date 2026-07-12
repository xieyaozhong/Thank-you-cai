(() => {
  "use strict";

  const catalog = window.THANK_YOU_CAI_CATALOG;
  if (!catalog) throw new Error("找不到蔬果目錄 catalog.js");

  const OWNER_SETTINGS_KEY = "thank-you-cai-owner-settings-v1";
  const APP_STORAGE_KEY = "thank-you-cai-github-pages-v1";
  const gradeNames = { S: "閃亮特選", A: "新鮮優選", B: "實惠好味", C: "惜食即享" };
  let dirty = false;
  let toastTimer = 0;

  const els = {
    list: document.querySelector("#owner-product-list"),
    announcement: document.querySelector("#announcement-input"),
    announcementCount: document.querySelector("#announcement-count"),
    save: document.querySelector("#save-settings"),
    stickySave: document.querySelector("#sticky-save-button"),
    reset: document.querySelector("#reset-settings"),
    status: document.querySelector("#save-status"),
    orders: document.querySelector("#owner-orders"),
    refreshOrders: document.querySelector("#refresh-orders"),
    statTotal: document.querySelector("#stat-total"),
    statEnabled: document.querySelector("#stat-enabled"),
    statStock: document.querySelector("#stat-stock"),
    statOrders: document.querySelector("#stat-orders"),
    ownerLink: document.querySelector("#owner-link"),
    copyLink: document.querySelector("#copy-link"),
    toast: document.querySelector("#owner-toast"),
  };

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
  }

  function renderPixelSprite(key, label) {
    const sprite = catalog.sprites[key];
    if (!sprite) return `<span class="pixel-sprite-fallback" aria-label="${escapeHtml(label)}">菜</span>`;
    const cells = sprite.pixels.flatMap((row) => [...row].map((pixel) => {
      const color = sprite.palette[pixel];
      return `<i${color ? ` style="background:${color}"` : ""}></i>`;
    })).join("");
    return `<span class="pixel-sprite" role="img" aria-label="${escapeHtml(label)}">${cells}</span>`;
  }

  function loadSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(OWNER_SETTINGS_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : { announcement: "", products: {} };
    } catch {
      return { announcement: "", products: {} };
    }
  }

  function loadAppState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) || "null");
      return parsed && typeof parsed === "object" ? parsed : { orders: [] };
    } catch {
      return { orders: [] };
    }
  }

  function setDirty(value = true) {
    dirty = value;
    els.status.textContent = dirty ? "有尚未儲存的修改" : "設定已儲存";
  }

  function renderProducts() {
    const settings = loadSettings();
    const overrides = settings.products && typeof settings.products === "object" ? settings.products : {};
    els.announcement.value = String(settings.announcement || "").slice(0, 120);
    els.announcementCount.textContent = String(els.announcement.value.length);

    els.list.innerHTML = catalog.products.map((product) => {
      const override = overrides[product.id] || {};
      const price = Number.isFinite(Number(override.price)) ? Math.max(0, Math.round(Number(override.price))) : product.price;
      const stock = Number.isFinite(Number(override.stock)) ? Math.max(0, Math.round(Number(override.stock))) : product.stock;
      const enabled = override.enabled !== false;
      return `<article class="owner-product-row${enabled ? "" : " is-disabled"}" data-product-id="${product.id}">
        <div class="owner-product-ident">${renderPixelSprite(product.sprite, product.name)}<div><strong>${escapeHtml(product.name)}</strong><small>${product.grade} 級・${escapeHtml(gradeNames[product.grade])}・${escapeHtml(product.origin)}</small></div></div>
        <label>售價（NT$）<input data-field="price" type="number" min="0" max="99999" step="1" value="${price}" /></label>
        <label>庫存<input data-field="stock" type="number" min="0" max="9999" step="1" value="${stock}" /></label>
        <label class="owner-toggle"><input data-field="enabled" type="checkbox" ${enabled ? "checked" : ""} /><span>${enabled ? "已上架" : "已下架"}</span></label>
      </article>`;
    }).join("");
    updateStats();
    setDirty(false);
  }

  function collectSettings() {
    const products = {};
    els.list.querySelectorAll("[data-product-id]").forEach((row) => {
      const id = row.dataset.productId;
      const price = Math.max(0, Math.round(Number(row.querySelector('[data-field="price"]').value) || 0));
      const stock = Math.max(0, Math.round(Number(row.querySelector('[data-field="stock"]').value) || 0));
      const enabled = row.querySelector('[data-field="enabled"]').checked;
      products[id] = { price, stock, enabled };
    });
    return { announcement: els.announcement.value.trim().slice(0, 120), products, updatedAt: new Date().toISOString() };
  }

  function saveSettings() {
    localStorage.setItem(OWNER_SETTINGS_KEY, JSON.stringify(collectSettings()));
    setDirty(false);
    updateStats();
    showToast("攤主設定已儲存，前台會套用最新內容。");
  }

  function resetSettings() {
    if (!window.confirm("確定要把公告、價格、庫存與上架狀態全部恢復預設嗎？")) return;
    localStorage.removeItem(OWNER_SETTINGS_KEY);
    renderProducts();
    showToast("已恢復預設設定。", true);
  }

  function updateStats() {
    const rows = [...els.list.querySelectorAll("[data-product-id]")];
    const enabledRows = rows.filter((row) => row.querySelector('[data-field="enabled"]').checked);
    const stock = enabledRows.reduce((sum, row) => sum + Math.max(0, Number(row.querySelector('[data-field="stock"]').value) || 0), 0);
    const orders = Array.isArray(loadAppState().orders) ? loadAppState().orders : [];
    els.statTotal.textContent = String(rows.length);
    els.statEnabled.textContent = String(enabledRows.length);
    els.statStock.textContent = String(Math.round(stock));
    els.statOrders.textContent = String(orders.length);
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "時間不明";
    return new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
  }

  function money(value) {
    return `NT$${Math.max(0, Math.round(Number(value) || 0)).toLocaleString("zh-TW")}`;
  }

  function renderOrders() {
    const state = loadAppState();
    const orders = Array.isArray(state.orders) ? state.orders : [];
    els.statOrders.textContent = String(orders.length);
    if (!orders.length) {
      els.orders.innerHTML = '<div class="owner-empty"><strong>目前沒有本機試玩訂單</strong><p>到前台建立訂單後，摘要會顯示在這裡。</p></div>';
      return;
    }
    els.orders.innerHTML = orders.slice(0, 20).map((order) => {
      const lineCount = Array.isArray(order.lines) ? order.lines.reduce((sum, line) => sum + Math.max(0, Number(line.quantity) || 0), 0) : 0;
      return `<article class="owner-order-card"><header><div><small>${escapeHtml(formatDate(order.createdAt))}</small><h3>${escapeHtml(order.id || "本機訂單")}</h3></div><span class="status">試玩</span></header><p>${escapeHtml(order.nickname || "小菜友")}・${lineCount} 件・${escapeHtml(order.slot || "未選擇時段")}</p><footer><span>合計</span><strong>${money(order.total)}</strong></footer></article>`;
    }).join("");
  }

  function showToast(message, isError = false) {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.style.background = isError ? "#9e342d" : "";
    els.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(() => els.toast.classList.remove("is-visible"), 2600);
  }

  async function copyOwnerLink() {
    const url = new URL("./owner.html", window.location.href).href;
    try {
      await navigator.clipboard.writeText(url);
      showToast("攤主頁面連結已複製。");
    } catch {
      window.prompt("複製這個攤主頁面連結：", url);
    }
  }

  els.list.addEventListener("input", (event) => {
    const row = event.target.closest("[data-product-id]");
    if (!row) return;
    if (event.target.dataset.field === "enabled") {
      const label = row.querySelector(".owner-toggle span");
      label.textContent = event.target.checked ? "已上架" : "已下架";
      row.classList.toggle("is-disabled", !event.target.checked);
    }
    setDirty(true);
    updateStats();
  });
  els.announcement.addEventListener("input", () => { els.announcementCount.textContent = String(els.announcement.value.length); setDirty(true); });
  els.save.addEventListener("click", saveSettings);
  els.stickySave.addEventListener("click", saveSettings);
  els.reset.addEventListener("click", resetSettings);
  els.refreshOrders.addEventListener("click", () => { renderOrders(); updateStats(); showToast("訂單摘要已更新。"); });
  els.copyLink.addEventListener("click", copyOwnerLink);
  window.addEventListener("beforeunload", (event) => { if (!dirty) return; event.preventDefault(); event.returnValue = ""; });
  window.addEventListener("storage", (event) => { if (event.key === APP_STORAGE_KEY) { renderOrders(); updateStats(); } if (event.key === OWNER_SETTINGS_KEY) renderProducts(); });

  const link = new URL("./owner.html", window.location.href).href;
  els.ownerLink.textContent = link;
  renderProducts();
  renderOrders();
})();
