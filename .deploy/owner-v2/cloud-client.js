(() => {
  "use strict";

  const config = window.THANK_YOU_CAI_CLOUD || {};
  const SESSION_KEY = "thank-you-cai-owner-session-v2";
  const LEGACY_SESSION_KEY = "thank-you-cai-owner-session-v1";
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

  window.THANK_YOU_CAI_CLOUD_CLIENT = Object.freeze({
    config: Object.freeze({ ...config, storeId }),
    isConfigured: () => configured,
    signIn,
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
