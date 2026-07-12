(() => {
  "use strict";

  const config = window.THANK_YOU_CAI_CLOUD || {};
  const SESSION_KEY = "thank-you-cai-owner-session-v2";
  const LEGACY_SESSION_KEY = "thank-you-cai-owner-session-v1";
  const APPROVED_OWNER_EMAIL = "handsomeboy784@gmail.com";
  const cleanUrl = String(config.url || "").replace(/\/$/, "");
  const key = String(config.publishableKey || "");
  const storeId = String(config.storeId || "thank-you-cai");
  const configured = /^https:\/\/.+\.supabase\.co$/i.test(cleanUrl) && key.length > 20 && !key.includes("__SUPABASE_");

  function headers(token, extra = {}) {
    const result = { apikey: key, ...extra };
    if (!Object.keys(result).some((name) => name.toLowerCase() === "content-type")) result["Content-Type"] = "application/json";
    if (token) result.Authorization = `Bearer ${token}`;
    return result;
  }

  async function request(path, options = {}, token = "") {
    if (!configured) throw new Error("雲端訂單服務尚未設定。");
    const response = await fetch(`${cleanUrl}${path}`, { ...options, headers: headers(token, options.headers || {}) });
    const text = await response.text();
    let body = null;
    if (text) {
      try { body = JSON.parse(text); } catch { body = text; }
    }
    if (!response.ok) {
      const message = body?.message || body?.error_description || body?.hint || body?.details || `雲端服務錯誤（${response.status}）`;
      const error = new Error(message);
      error.status = response.status;
      error.body = body;
      throw error;
    }
    return body;
  }

  function readStoredSession(storage) {
    try {
      const value = JSON.parse(storage.getItem(SESSION_KEY) || storage.getItem(LEGACY_SESSION_KEY) || "null");
      return value && value.accessToken ? value : null;
    } catch { return null; }
  }

  function loadSession() {
    const temporary = readStoredSession(sessionStorage);
    if (temporary) return { ...temporary, remember: false };
    const persistent = readStoredSession(localStorage);
    return persistent ? { ...persistent, remember: true } : null;
  }

  function clearSession() {
    [localStorage, sessionStorage].forEach((storage) => {
      storage.removeItem(SESSION_KEY);
      storage.removeItem(LEGACY_SESSION_KEY);
    });
  }

  function saveSession(payload, remember = false) {
    const session = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + Math.max(60, Number(payload.expires_in || 3600) - 60) * 1000,
      email: payload.user?.email || payload.email || "",
      remember: Boolean(remember),
    };
    clearSession();
    (session.remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  async function signIn(email, password, remember = false) {
    const payload = await request("/auth/v1/token?grant_type=password", {
      method: "POST",
      body: JSON.stringify({ email: String(email).trim(), password: String(password) }),
    });
    return saveSession(payload, remember);
  }

  async function signUpOwner(email, password, redirectTo) {
    const address = String(email || "").trim().toLowerCase();
    if (address !== APPROVED_OWNER_EMAIL) throw new Error("這個信箱不在核准攤主名單中。");
    if (String(password || "").length < 8) throw new Error("密碼至少需要 8 碼。");
    const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
    return request(`/auth/v1/signup${query}`, {
      method: "POST",
      body: JSON.stringify({
        email: address,
        password: String(password),
        data: { requested_role: "store_owner", store_id: storeId },
      }),
    });
  }

  async function getSession() {
    const session = loadSession();
    if (!session) return null;
    if (Date.now() < Number(session.expiresAt || 0)) return session;
    if (!session.refreshToken) { clearSession(); return null; }
    try {
      const payload = await request("/auth/v1/token?grant_type=refresh_token", {
        method: "POST",
        body: JSON.stringify({ refresh_token: session.refreshToken }),
      });
      return saveSession(payload, session.remember);
    } catch {
      clearSession();
      return null;
    }
  }

  async function signOut() {
    const session = loadSession();
    try {
      if (session?.accessToken && configured) {
        await request("/auth/v1/logout?scope=local", { method: "POST", body: "{}" }, session.accessToken);
      }
    } catch {
      // The local session must still be removed if the server is unavailable.
    } finally {
      clearSession();
    }
  }

  async function requestPasswordReset(email, redirectTo) {
    const address = String(email || "").trim();
    if (!address) throw new Error("請先輸入攤主電子郵件。");
    const query = redirectTo ? `?redirect_to=${encodeURIComponent(redirectTo)}` : "";
    await request(`/auth/v1/recover${query}`, { method: "POST", body: JSON.stringify({ email: address }) });
  }

  async function checkOwnerAccess() {
    const session = await getSession();
    if (!session) return false;
    const value = await request("/rest/v1/rpc/is_store_owner", { method: "POST", body: "{}" }, session.accessToken);
    return value === true;
  }

  async function createOrder(order) {
    await request("/rest/v1/orders", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        store_id: storeId,
        order_code: order.id,
        customer_name: order.nickname,
        contact: order.contact,
        pickup_slot: order.slot,
        note: order.note || "",
        items: order.lines,
        subtotal: order.subtotal,
        delivery: order.delivery,
        total: order.total,
        customer_token: order.customerToken,
        status: "pending",
      }),
    });
  }

  async function getStoreSettings() {
    const rows = await request(`/rest/v1/store_settings?store_id=eq.${encodeURIComponent(storeId)}&select=store_id,announcement,products,updated_at&limit=1`, { method: "GET" });
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  }

  async function saveStoreSettings(settings) {
    const session = await getSession();
    if (!session) throw new Error("攤主登入已過期，請重新登入。");
    await request("/rest/v1/store_settings?on_conflict=store_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ store_id: storeId, announcement: settings.announcement || "", products: settings.products || {}, updated_at: new Date().toISOString() }),
    }, session.accessToken);
  }

  async function listOrders() {
    const session = await getSession();
    if (!session) throw new Error("攤主登入已過期，請重新登入。");
    const common = "id,order_code,created_at,customer_name,contact,pickup_slot,note,items,subtotal,delivery,total,status,updated_at";
    const basePath = `/rest/v1/orders?store_id=eq.${encodeURIComponent(storeId)}&order=created_at.desc&limit=1000`;
    try {
      return await request(`${basePath}&select=${common},owner_note,priority`, { method: "GET" }, session.accessToken);
    } catch (error) {
      if (error.status !== 400) throw error;
      const legacy = await request(`${basePath}&select=${common}`, { method: "GET" }, session.accessToken);
      return (Array.isArray(legacy) ? legacy : []).map((order) => ({ ...order, owner_note: "", priority: false, _legacySchema: true }));
    }
  }

  async function updateOrdersStatus(ids, status) {
    const session = await getSession();
    if (!session) throw new Error("攤主登入已過期，請重新登入。");
    const cleanIds = [...new Set((Array.isArray(ids) ? ids : [ids]).map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))];
    if (!cleanIds.length) throw new Error("沒有可更新的雲端訂單。");
    const filter = cleanIds.join(",");
    await request(`/rest/v1/orders?id=in.(${filter})&store_id=eq.${encodeURIComponent(storeId)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
    }, session.accessToken);
  }

  async function updateOrderStatus(id, status) {
    return updateOrdersStatus([id], status);
  }

  async function updateOrderDetails(id, details = {}) {
    const session = await getSession();
    if (!session) throw new Error("攤主登入已過期，請重新登入。");
    const payload = { updated_at: new Date().toISOString() };
    if (Object.hasOwn(details, "ownerNote")) payload.owner_note = String(details.ownerNote || "").slice(0, 500);
    if (Object.hasOwn(details, "priority")) payload.priority = Boolean(details.priority);
    try {
      await request(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}&store_id=eq.${encodeURIComponent(storeId)}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(payload),
      }, session.accessToken);
    } catch (error) {
      if (error.status === 400) throw new Error("請在 Supabase 重新執行最新版 SUPABASE_SETUP.sql，才能使用攤主備註與優先標記。");
      throw error;
    }
  }

  function installOwnerSignupUi() {
    const loginForm = document.querySelector("#owner-login-form");
    if (!loginForm || document.querySelector("#owner-account-onboarding")) return;
    const resetButton = document.querySelector("#owner-reset-password");
    const loginEmail = loginForm.elements.email;
    if (loginEmail && !loginEmail.value) loginEmail.value = APPROVED_OWNER_EMAIL;

    const panel = document.createElement("div");
    panel.id = "owner-account-onboarding";
    panel.style.marginTop = "12px";
    panel.innerHTML = `
      <button id="owner-show-signup" class="secondary-button primary-button--wide" type="button" aria-expanded="false">首次使用：建立攤主帳號</button>
      <form id="owner-signup-form" hidden style="margin-top:12px;padding:14px;border:1px solid rgba(24,52,39,.14);border-radius:14px;background:rgba(255,255,255,.72)">
        <strong>建立核准攤主帳號</strong>
        <p style="margin:.4rem 0 .8rem;color:#587063;font-size:.88rem">此工作台只允許 ${APPROVED_OWNER_EMAIL} 取得攤主權限。請自行設定至少 8 碼的密碼。</p>
        <label>核准信箱<input name="email" type="email" value="${APPROVED_OWNER_EMAIL}" readonly /></label>
        <label>設定密碼<input name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
        <label>再次輸入密碼<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required /></label>
        <button id="owner-signup-button" class="primary-button primary-button--wide" type="submit">建立攤主帳號</button>
        <p id="owner-signup-status" role="status" aria-live="polite" style="margin:.75rem 0 0;font-size:.86rem"></p>
      </form>`;
    loginForm.insertAdjacentElement("afterend", panel);
    if (resetButton) panel.insertAdjacentElement("afterend", resetButton);

    const toggle = panel.querySelector("#owner-show-signup");
    const signupForm = panel.querySelector("#owner-signup-form");
    const signupButton = panel.querySelector("#owner-signup-button");
    const status = panel.querySelector("#owner-signup-status");

    toggle.addEventListener("click", () => {
      signupForm.hidden = !signupForm.hidden;
      toggle.setAttribute("aria-expanded", String(!signupForm.hidden));
      if (!signupForm.hidden) signupForm.elements.password.focus();
    });

    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const password = String(signupForm.elements.password.value || "");
      const confirmPassword = String(signupForm.elements.confirmPassword.value || "");
      status.style.color = "#9e342d";
      if (!configured) {
        status.textContent = "Supabase 尚未完成設定。";
        return;
      }
      if (password.length < 8) {
        status.textContent = "密碼至少需要 8 碼。";
        return;
      }
      if (password !== confirmPassword) {
        status.textContent = "兩次輸入的密碼不一致。";
        return;
      }
      signupButton.disabled = true;
      signupButton.textContent = "建立中…";
      try {
        const redirect = new URL("./owner.html?signup=confirmed", location.href).href;
        const payload = await signUpOwner(APPROVED_OWNER_EMAIL, password, redirect);
        status.style.color = "#397247";
        status.textContent = payload?.access_token
          ? "攤主帳號已建立。現在可以使用上方表單登入。"
          : "註冊資料已送出，請到信箱完成驗證後再登入。";
        loginEmail.value = APPROVED_OWNER_EMAIL;
        loginForm.elements.password.value = password;
        signupForm.reset();
      } catch (error) {
        const message = String(error.message || error);
        status.textContent = /already|registered|exists/i.test(message)
          ? "這個信箱已建立帳號，請直接登入或使用忘記密碼。"
          : message;
      } finally {
        signupButton.disabled = false;
        signupButton.textContent = "建立攤主帳號";
      }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", installOwnerSignupUi, { once: true });
  else installOwnerSignupUi();

  window.THANK_YOU_CAI_CLOUD_CLIENT = Object.freeze({
    config: Object.freeze({ ...config, storeId, approvedOwnerEmail: APPROVED_OWNER_EMAIL }),
    isConfigured: () => configured,
    signIn,
    signUpOwner,
    signOut,
    getSession,
    requestPasswordReset,
    checkOwnerAccess,
    createOrder,
    getStoreSettings,
    saveStoreSettings,
    listOrders,
    updateOrderStatus,
    updateOrdersStatus,
    updateOrderDetails,
  });
})();
