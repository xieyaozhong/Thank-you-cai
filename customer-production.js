(() => {
  "use strict";

  const RELEASE = "production-v1";
  const PROFILE_KEY = "thank-you-cai-customer-profile-v1";
  const STATE_KEY = "thank-you-cai-github-pages-v1";
  const TOKEN_KEY = "thank-you-cai-customer-token-v1";

  const $ = (selector, root = document) => root.querySelector(selector);

  function setText(selector, value) {
    const node = $(selector);
    if (node) node.textContent = value;
  }

  function readProfile() {
    try {
      const value = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
      return value && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function saveProfile(form) {
    const remember = form.elements.rememberCustomer?.checked !== false;
    if (!remember) {
      localStorage.removeItem(PROFILE_KEY);
      return;
    }
    const profile = {
      nickname: String(form.elements.nickname?.value || "").trim().slice(0, 30),
      contact: String(form.elements.contact?.value || "").trim().slice(0, 50),
      slot: String(form.elements.slot?.value || "").trim().slice(0, 40),
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function prefillProfile(form) {
    const profile = readProfile();
    if (form.elements.nickname && !form.elements.nickname.value) form.elements.nickname.value = profile.nickname || "";
    if (form.elements.contact && !form.elements.contact.value) form.elements.contact.value = profile.contact || "";
    if (form.elements.slot && !form.elements.slot.value) form.elements.slot.value = profile.slot || "";
  }

  function installFormalCopy() {
    document.documentElement.dataset.customerRelease = RELEASE;
    document.body.classList.add("customer-production");
    document.title = "線上訂購｜謝謝你，菜！";

    const description = $('meta[name="description"]');
    if (description) description.content = "謝謝你，菜！線上訂購：查看本週蔬果、菜況、價格與庫存，送出訂單並追蹤同步狀態。";
    const ogTitle = $('meta[property="og:title"]');
    if (ogTitle) ogTitle.content = "謝謝你，菜！｜本週蔬果線上訂購";
    const ogDescription = $('meta[property="og:description"]');
    if (ogDescription) ogDescription.content = "每週新鮮蔬果、透明菜況與線上訂購，送出後同步至攤主工作台。";

    setText(".brand small", "線上訂購");
    setText('.topnav [data-view-target="gacha"]', "菜卡活動");
    setText(".hero__copy .eyebrow", "WEEKLY FRESH MARKET");
    setText(".hero__copy > p", "查看本週菜況、產地、價格與庫存，選好後直接送出訂單，由攤主確認取貨安排。");
    setText('.hero__actions [data-view-target="gacha"]', "參加菜卡活動");
    setText("#cart-panel .local-only", "訂單送出後會同步至攤主工作台；連線中斷時將先保存在此裝置並自動補送。");

    setText('.page-intro--gacha .eyebrow', "VEGGIE CARD REWARDS");
    setText("#gacha-title", "菜卡收藏活動");
    setText(".page-intro--gacha p", "每次使用 50 點抽一張本週蔬果卡；點數與收藏保存在目前裝置，可由完成訂單取得點數。");
    setText(".point-board span", "菜籽點數");
    setText(".point-board small", "此裝置");

    setText('[data-view="orders"] .page-intro p', "這裡保存你在此裝置送出的訂單。顯示「已同步」代表攤主工作台已收到訂單。");
    setText("#clear-data-button", "清除本機顧客資料");

    setText("#checkout-dialog .eyebrow", "ORDER CHECKOUT");
    setText("#checkout-dialog h2", "確認並送出訂單");
    setText("#checkout-dialog form > p", "請填寫可聯絡資料。送出後，攤主會依實際庫存與取貨時段確認訂單。");
    setText("#receipt-points", "獲得 0 點菜籽點數");

    const footerSmall = $(".footer > small");
    if (footerSmall) footerSmall.textContent = "正式線上訂購版・商品、售價與庫存以本週頁面及攤主最終確認為準。";
    const noscript = $(".noscript");
    if (noscript) noscript.textContent = "此訂購頁需要 JavaScript 才能使用菜籃、送出訂單與查看訂單紀錄。";
  }

  function installServiceStrip() {
    const statusBar = $(".demo-notice");
    if (!statusBar || $("#production-service-strip")) return;
    statusBar.classList.add("production-status");

    const networkBadge = document.createElement("span");
    networkBadge.id = "production-network-badge";
    networkBadge.className = "production-network-badge";
    networkBadge.setAttribute("role", "status");
    statusBar.append(networkBadge);

    const strip = document.createElement("section");
    strip.id = "production-service-strip";
    strip.className = "production-service-strip section-wrap";
    strip.setAttribute("aria-label", "訂購服務資訊");
    strip.innerHTML = `
      <article><span aria-hidden="true">✓</span><div><strong>正式線上訂購</strong><small>送出後同步至攤主工作台</small></div></article>
      <article><span aria-hidden="true">鮮</span><div><strong>菜況透明標示</strong><small>等級、產地、價格與庫存清楚呈現</small></div></article>
      <article><span aria-hidden="true">籃</span><div><strong>滿 NT$500 免運</strong><small>取貨時段與最終庫存由攤主確認</small></div></article>
      <button id="install-customer-app" class="production-install-button" type="button" hidden>安裝到裝置</button>`;
    statusBar.insertAdjacentElement("afterend", strip);

    const cloudStatus = $("#cloud-status");
    const updateNetwork = () => {
      const message = String(cloudStatus?.textContent || "");
      networkBadge.classList.remove("is-online", "is-offline", "is-checking");
      if (!navigator.onLine) {
        networkBadge.textContent = "目前離線・訂單將待同步";
        networkBadge.classList.add("is-offline");
      } else if (/同步到攤主|已連線|同步正常/.test(message)) {
        networkBadge.textContent = "雲端同步正常";
        networkBadge.classList.add("is-online");
      } else {
        networkBadge.textContent = "正在確認雲端連線";
        networkBadge.classList.add("is-checking");
      }
    };
    updateNetwork();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    if (cloudStatus) new MutationObserver(updateNetwork).observe(cloudStatus, { childList: true, characterData: true, subtree: true });

    let installPrompt = null;
    const installButton = $("#install-customer-app");
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      installPrompt = event;
      installButton.hidden = false;
    });
    installButton?.addEventListener("click", async () => {
      if (!installPrompt) return;
      installButton.disabled = true;
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      installButton.hidden = true;
      installButton.disabled = false;
    });
  }

  function installOrderProcess() {
    const market = $('[data-view="market"]');
    const marketSection = $("#weekly-market");
    if (!market || !marketSection || $("#production-order-process")) return;
    const section = document.createElement("section");
    section.id = "production-order-process";
    section.className = "production-order-process section-wrap";
    section.innerHTML = `
      <div class="section-heading section-heading--compact">
        <div><span class="eyebrow">HOW TO ORDER</span><h2>三步完成訂購</h2></div>
        <p>本頁不收取線上付款；付款與交付方式依攤主確認通知辦理。</p>
      </div>
      <div class="production-process-grid">
        <article><b>1</b><div><strong>挑選本週蔬果</strong><span>依菜況、價格與庫存加入菜籃</span></div></article>
        <article><b>2</b><div><strong>填寫聯絡與取貨資料</strong><span>送出前再次確認品項與金額</span></div></article>
        <article><b>3</b><div><strong>等待攤主確認</strong><span>訂單同步後，由攤主確認實際庫存與交付</span></div></article>
      </div>`;
    marketSection.insertAdjacentElement("beforebegin", section);
  }

  function installCheckoutEnhancements() {
    const form = $("#checkout-form");
    const submitButton = $("#submit-order-button");
    if (!form || !submitButton || $("#production-checkout-assurance")) return;

    const nickname = form.elements.nickname;
    const contact = form.elements.contact;
    if (nickname) {
      nickname.minLength = 1;
      nickname.placeholder = "例如：林小姐";
    }
    if (contact) {
      contact.minLength = 5;
      contact.inputMode = "tel";
      contact.placeholder = "手機、電話或可聯絡的 LINE 名稱";
    }

    const assurance = document.createElement("div");
    assurance.id = "production-checkout-assurance";
    assurance.className = "production-checkout-assurance";
    assurance.innerHTML = `
      <strong>訂購與資料使用說明</strong>
      <ul>
        <li>聯絡資料只用於本次訂單確認與交付聯繫。</li>
        <li>送出訂單不等同付款完成，實際庫存與取貨安排以攤主確認為準。</li>
        <li>網路中斷時，訂單會保存在此裝置並在恢復連線後嘗試補送。</li>
      </ul>
      <label class="production-checkbox"><input name="rememberCustomer" type="checkbox" checked />記住稱呼、聯絡方式與常用取貨時段</label>
      <label class="production-checkbox production-checkbox--required"><input name="orderConsent" type="checkbox" required />我已確認訂單內容，並同意攤主使用上述資料聯繫本次訂單</label>`;
    submitButton.insertAdjacentElement("beforebegin", assurance);

    const checkoutButton = $("#checkout-button");
    checkoutButton?.addEventListener("click", () => window.setTimeout(() => prefillProfile(form), 0));

    form.addEventListener("submit", (event) => {
      if (nickname) nickname.value = nickname.value.trim();
      if (contact) contact.value = contact.value.trim();
      if (!form.checkValidity()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        form.reportValidity();
        return;
      }
      saveProfile(form);
    }, true);
  }

  function installOrderTools() {
    const intro = $('[data-view="orders"] .page-intro');
    const clearButton = $("#clear-data-button");
    if (!intro || !clearButton || $("#retry-order-sync")) return;

    const actions = document.createElement("div");
    actions.className = "production-order-actions";
    clearButton.insertAdjacentElement("beforebegin", actions);
    actions.append(clearButton);

    const retry = document.createElement("button");
    retry.id = "retry-order-sync";
    retry.type = "button";
    retry.className = "secondary-button";
    retry.textContent = "重新同步待送訂單";
    actions.prepend(retry);
    retry.addEventListener("click", () => {
      retry.disabled = true;
      retry.textContent = navigator.onLine ? "正在重新同步…" : "目前離線";
      window.dispatchEvent(new Event("online"));
      window.setTimeout(() => {
        retry.disabled = false;
        retry.textContent = "重新同步待送訂單";
      }, 1800);
    });

    clearButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const confirmed = window.confirm("確定要清除這台裝置上的菜籃、訂單紀錄、菜籽點數、收藏與已記住的顧客資料嗎？此動作不會刪除攤主端已收到的訂單。");
      if (!confirmed) return;
      localStorage.removeItem(STATE_KEY);
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem(TOKEN_KEY);
      location.reload();
    }, true);
  }

  function installFooterNotice() {
    const footer = $(".footer");
    if (!footer || $("#production-footer-notice")) return;
    const details = document.createElement("details");
    details.id = "production-footer-notice";
    details.className = "production-footer-notice";
    details.innerHTML = `
      <summary>訂購須知與隱私說明</summary>
      <p>本頁只蒐集完成訂單所需的稱呼、聯絡方式、取貨時段與備註。資料用於攤主確認及交付聯繫；本機訂單紀錄可由你自行清除。商品價格、庫存與取貨安排以攤主最終確認為準。</p>`;
    footer.append(details);
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || location.protocol !== "https:") return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js", { scope: "./" }).catch(() => {});
    }, { once: true });
  }

  function init() {
    installFormalCopy();
    installServiceStrip();
    installOrderProcess();
    installCheckoutEnhancements();
    installOrderTools();
    installFooterNotice();
    registerServiceWorker();
    window.THANK_YOU_CAI_APP = Object.freeze({ release: RELEASE, profileKey: PROFILE_KEY });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
