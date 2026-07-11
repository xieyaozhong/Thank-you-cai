"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  GACHA_COST,
  GRADE_ORDER,
  GRADE_RULES,
  INITIAL_PRODUCTS,
  getWeekLabel,
  money,
  timeText,
  type Category,
  type CollectionCard,
  type Grade,
  type MarketState,
  type Order,
  type OrderStatus,
  type Product,
  type Viewer,
  type View,
} from "./market-data";
import { EmptyState, GradeBadge, PixelSprite } from "./ui";

const SIGN_IN_PATH = "/signin-with-chatgpt?return_to=%2F";

type DrawPhase = "idle" | "turning" | "shaking" | "waiting" | "dropping" | "revealing" | "syncing" | "error";

const DRAW_PHASE_LABELS: Record<DrawPhase, string> = {
  idle: "轉動旋鈕，扭出本週好菜",
  turning: "旋鈕轉動中…",
  shaking: "卡池翻滾中…",
  waiting: "正在確認這顆扭蛋…",
  dropping: "扭蛋掉下來了！",
  revealing: "扭蛋打開中…",
  syncing: "卡片已出現，正在收進圖鑑…",
  error: "這次沒有轉成功",
};

function waitForAnimation(duration: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, duration));
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "暫時無法連線菜攤，請稍後再試。");
  return payload;
}

export default function Home() {
  const [view, setView] = useState<View>("market");
  const [inventory, setInventory] = useState<Product[]>(INITIAL_PRODUCTS);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const [collection, setCollection] = useState<CollectionCard[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState("2026-07-06T00:30:00.000Z");
  const [weekLabel, setWeekLabel] = useState(getWeekLabel());
  const [category, setCategory] = useState<"all" | Category>("all");
  const [gradeFilter, setGradeFilter] = useState<"all" | Grade>("all");
  const [query, setQuery] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [drawResult, setDrawResult] = useState<CollectionCard | null>(null);
  const [drawPhase, setDrawPhase] = useState<DrawPhase>("idle");
  const [verificationInputs, setVerificationInputs] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyAction, setBusyAction] = useState("");
  const toastTimer = useRef<number | null>(null);
  const drawLockRef = useRef(false);

  const isDrawing = drawPhase !== "idle";

  const applyMarketState = useCallback((state: MarketState) => {
    setInventory(state.products);
    setOrders(state.orders);
    setViewer(state.viewer);
    setCollection(state.collection);
    setWeekLabel(state.weekLabel);
    setLastUpdatedAt(state.lastUpdatedAt);
    setCart((current) => Object.fromEntries(
      Object.entries(current).filter(([id, quantity]) => {
        const product = state.products.find((item) => item.id === id);
        return product && quantity > 0 && quantity <= product.stock;
      }),
    ));
  }, []);

  const refreshMarket = useCallback(async () => {
    const state = await requestJson<MarketState>("/api/market", { cache: "no-store" });
    applyMarketState(state);
    return state;
  }, [applyMarketState]);

  useEffect(() => {
    let active = true;
    requestJson<MarketState>("/api/market", { cache: "no-store" })
      .then((state) => {
        if (!active) return;
        applyMarketState(state);
        setLoadError("");
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "載入菜單失敗。");
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applyMarketState]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setCheckoutOpen(false);
      setReceipt(null);
      setDrawResult(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const cartLines = useMemo(
    () => inventory.filter((product) => (cart[product.id] ?? 0) > 0).map((product) => ({ product, quantity: cart[product.id] })),
    [inventory, cart],
  );
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const deliveryFee = subtotal === 0 || subtotal >= 500 ? 0 : 60;
  const total = subtotal + deliveryFee;
  const points = viewer?.points ?? 0;
  const freeDraws = viewer?.freeDraws ?? 0;
  const isOwner = viewer?.role === "owner";

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-TW");
    return inventory.filter((product) => {
      const matchesCategory = category === "all" || product.category === category;
      const matchesGrade = gradeFilter === "all" || product.grade === gradeFilter;
      const haystack = `${product.name}${product.cardName}${product.origin}`.toLocaleLowerCase("zh-TW");
      return matchesCategory && matchesGrade && haystack.includes(normalizedQuery);
    });
  }, [inventory, category, gradeFilter, query]);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 3000);
  };

  const showRequestError = (error: unknown) => {
    showToast(error instanceof Error ? error.message : "操作沒有完成，請再試一次。");
  };

  const changeCart = (product: Product, delta: number) => {
    setCart((current) => {
      const nextQuantity = Math.max(0, Math.min((current[product.id] ?? 0) + delta, product.stock, product.maxPerOrder));
      if (nextQuantity === 0) {
        const next = { ...current };
        delete next[product.id];
        return next;
      }
      return { ...current, [product.id]: nextQuantity };
    });
  };

  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!viewer) {
      window.location.assign(SIGN_IN_PATH);
      return;
    }
    if (cartLines.length === 0) {
      showToast("菜籃還是空的，先挑幾張蔬果卡吧！");
      return;
    }
    const form = new FormData(event.currentTarget);
    setBusyAction("order");
    try {
      const { order } = await requestJson<{ order: Order }>("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          lines: cartLines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
          customerName: String(form.get("customerName") ?? ""),
          phone: String(form.get("phone") ?? ""),
          destination: String(form.get("destination") ?? ""),
          deliverySlot: String(form.get("deliverySlot") ?? ""),
          note: String(form.get("note") ?? ""),
        }),
      });
      setCart({});
      setCheckoutOpen(false);
      setReceipt(order);
      event.currentTarget.reset();
      await refreshMarket();
    } catch (error) {
      showRequestError(error);
    } finally {
      setBusyAction("");
    }
  };

  const markOutForDelivery = async (orderId: string) => {
    setBusyAction(`dispatch-${orderId}`);
    try {
      await requestJson(`/api/orders/${encodeURIComponent(orderId)}/dispatch`, { method: "POST", body: "{}" });
      await refreshMarket();
      showToast("訂單已交給送貨手，等待顧客提供核銷碼。");
    } catch (error) {
      showRequestError(error);
    } finally {
      setBusyAction("");
    }
  };

  const verifyOrder = async (order: Order) => {
    if (order.status !== "out_for_delivery") return;
    setBusyAction(`verify-${order.id}`);
    try {
      await requestJson(`/api/orders/${encodeURIComponent(order.id)}/verify`, {
        method: "POST",
        body: JSON.stringify({ code: verificationInputs[order.id] ?? "" }),
      });
      setVerificationInputs((current) => ({ ...current, [order.id]: "" }));
      await refreshMarket();
      showToast(`核銷成功！已發放 ${order.pointsEarned} 點水果點數。`);
    } catch (error) {
      showRequestError(error);
    } finally {
      setBusyAction("");
    }
  };

  const drawCard = async () => {
    if (drawLockRef.current || isDrawing || inventory.length === 0) return;
    if (!viewer) {
      window.location.assign(SIGN_IN_PATH);
      return;
    }
    if (freeDraws === 0 && points < GACHA_COST) {
      showToast(`還差 ${GACHA_COST - points} 點才能再抽一次。`);
      return;
    }
    drawLockRef.current = true;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pause = (duration: number) => reduceMotion ? Promise.resolve() : waitForAnimation(duration);
    setDrawPhase("turning");
    const drawOutcome = requestJson<{ card: CollectionCard }>("/api/gacha", { method: "POST", body: "{}" }).then(
      ({ card }) => ({ ok: true as const, card }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    try {
      await pause(420);
      setDrawPhase("shaking");
      await pause(480);
      setDrawPhase("waiting");

      const outcome = await drawOutcome;
      if (!outcome.ok) {
        setDrawPhase("error");
        await pause(260);
        showRequestError(outcome.error);
        return;
      }

      setDrawPhase("dropping");
      await pause(520);
      setDrawPhase("revealing");
      await pause(320);
      setDrawResult(outcome.card);
      setDrawPhase("syncing");

      try {
        await refreshMarket();
      } catch {
        showToast("卡片已抽出，但點數與圖鑑暫時無法同步，請重新整理頁面。");
      }
    } finally {
      drawLockRef.current = false;
      setDrawPhase("idle");
    }
  };

  const updateProduct = (id: string, patch: Partial<Product>) => {
    setInventory((current) => current.map((product) => product.id === id ? { ...product, ...patch } : product));
  };

  const publishWeeklyMenu = async () => {
    setBusyAction("publish");
    try {
      await requestJson("/api/menu", {
        method: "PATCH",
        body: JSON.stringify({
          products: inventory.map(({ id, grade, price, stock, conditionNote }) => ({ id, grade, price, stock, conditionNote })),
        }),
      });
      await refreshMarket();
      showToast("本週菜單已發布，所有裝置都會讀到最新資料！");
    } catch (error) {
      showRequestError(error);
    } finally {
      setBusyAction("");
    }
  };

  const statusLabel: Record<OrderStatus, string> = {
    placed: "訂單成立",
    out_for_delivery: "配送中・待核銷",
    delivered: "完成・點數已發",
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">跳到主要內容</a>
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setView("market")}>
          <span className="brand__mark" aria-hidden="true">菜</span>
          <span><strong>謝謝你，菜！</strong><small>自家菜攤週報</small></span>
        </button>
        <nav className="topnav" aria-label="主要功能">
          {([ ["market", "本週菜單"], ["gacha", "水果抽卡"], ["orders", isOwner ? "訂單核銷" : "我的訂單"], ...(isOwner ? [["stall", "攤主更新"]] : []) ] as [View, string][]).map(([key, label]) => (
            <button key={key} type="button" className={view === key ? "is-active" : ""} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>
          ))}
        </nav>
        {viewer ? <div className="account-cluster">
          <div className="account-chip" title={viewer.email}><strong>{viewer.displayName}</strong><small>{isOwner ? "攤主" : "菜友"}</small></div>
          <div className="wallet-chip" aria-label={`水果點數 ${points} 點`}><span aria-hidden="true">◆</span><strong>{points}</strong><small>水果點</small></div>
        </div> : <a className="secondary-button header-signin" href={SIGN_IN_PATH}>登入下單</a>}
      </header>

      <main id="main-content">
        {isLoading && <div className="loading-panel" role="status"><span className="button-spinner" aria-hidden="true" /><strong>正在同步今天的菜攤…</strong></div>}
        {loadError && <div className="error-panel" role="alert"><div><strong>雲端菜單暫時沒有回應</strong><p>{loadError}</p></div><button type="button" className="secondary-button" onClick={() => { setIsLoading(true); setLoadError(""); refreshMarket().catch(showRequestError).finally(() => setIsLoading(false)); }}>重新整理</button></div>}
        {view === "market" && (
          <>
            <section className="hero section-wrap" aria-labelledby="hero-title">
              <div className="hero__copy">
                <span className="eyebrow">PIXEL FARM MARKET・雲端同步</span>
                <h1 id="hero-title">這週吃什麼？<br />來菜攤挑一籃。</h1>
                <p>每張卡都標好菜況、果況與價格。選好卡片，就能生成一張可愛訂單。</p>
                <div className="hero__facts">
                  <span><strong>{weekLabel}</strong>本週採收</span>
                  <span><strong>週三・週六</strong>配送日</span>
                  <span><strong>{timeText(lastUpdatedAt)}</strong>最後同步</span>
                </div>
              </div>
              <div className="hero__machine" aria-label="本週免費抽卡資訊">
                <div className="mini-machine"><span className="mini-machine__shine" aria-hidden="true" /><PixelSprite spriteKey="guava" label="珍珠芭樂" small /><span className="mini-machine__slot" aria-hidden="true" /></div>
                <div><strong>{freeDraws > 0 ? "本週免費抽 1 次" : `${GACHA_COST} 點再抽`}</strong><span>抽到的是收藏圖鑑卡，不會扣實體庫存。</span><button type="button" className="text-button" onClick={() => setView("gacha")}>去轉轉看 →</button></div>
              </div>
            </section>

            <section className="grade-guide section-wrap" aria-labelledby="grade-title">
              <div className="section-heading section-heading--compact"><div><span className="eyebrow">CARD CONDITION</span><h2 id="grade-title">S・A・B・C 怎麼看？</h2></div><p>所有等級都通過食用安全底線；C 級是惜食品，不是腐壞品。</p></div>
              <div className="grade-grid">
                {GRADE_ORDER.map((grade) => (
                  <details className={`grade-rule grade-rule--${grade.toLowerCase()}`} key={grade}>
                    <summary><GradeBadge grade={grade} /><span>{GRADE_RULES[grade].short}</span><b aria-hidden="true">＋</b></summary>
                    <p>{GRADE_RULES[grade].standard}</p><small>適合：{GRADE_RULES[grade].usage}</small>
                  </details>
                ))}
              </div>
            </section>

            <section className="market-section section-wrap" aria-labelledby="market-title">
              <div className="section-heading">
                <div><span className="eyebrow">THIS WEEK&apos;S HARVEST</span><h2 id="market-title">本週蔬果卡</h2><p>{inventory.length} 張卡已由自家菜攤發布。</p></div>
                <label className="search-box"><span className="sr-only">搜尋蔬果</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋蔬果或產地" /><span aria-hidden="true">⌕</span></label>
              </div>
              <div className="filters" aria-label="蔬果篩選">
                <div className="filter-group">
                  {([ ["all", "全部"], ["vegetable", "蔬菜"], ["fruit", "水果"] ] as ["all" | Category, string][]).map(([key, label]) => (
                    <button key={key} type="button" aria-pressed={category === key} className={category === key ? "is-active" : ""} onClick={() => setCategory(key)}>{label}</button>
                  ))}
                </div>
                <div className="filter-group filter-group--grades">
                  <button type="button" aria-pressed={gradeFilter === "all"} className={gradeFilter === "all" ? "is-active" : ""} onClick={() => setGradeFilter("all")}>全等級</button>
                  {GRADE_ORDER.map((grade) => <button key={grade} type="button" aria-pressed={gradeFilter === grade} className={gradeFilter === grade ? "is-active" : ""} onClick={() => setGradeFilter(grade)}>{grade} 級</button>)}
                </div>
              </div>

              <div className="market-layout">
                <div className="product-grid" aria-live="polite">
                  {filteredProducts.map((product) => {
                    const quantity = cart[product.id] ?? 0;
                    return (
                      <article className={`product-card product-card--${product.grade.toLowerCase()}${quantity > 0 ? " is-selected" : ""}`} key={product.id}>
                        <div className="product-card__top"><GradeBadge grade={product.grade} /><span className="stock-chip">{product.stock > 0 ? `剩 ${product.stock} ${product.unit}` : "本週售完"}</span></div>
                        <div className="product-card__art"><PixelSprite spriteKey={product.spriteKey} label={product.name} /><span className="grade-corner" aria-hidden="true">{product.grade === "S" ? "✦" : product.grade}</span></div>
                        <div className="product-card__body">
                          <span className="origin">{product.origin}產・{product.cardName}</span><h3>{product.name}</h3><p>{product.conditionNote}</p>
                          <div className="price-row"><strong>{money(product.price)}</strong><span>/ {product.unit}</span></div>
                          {quantity > 0 ? (
                            <div className="quantity-control" aria-label={`${product.name}數量`}>
                              <button type="button" aria-label={`減少一${product.unit}${product.name}`} onClick={() => changeCart(product, -1)}>−</button><strong aria-live="polite">{quantity}</strong><button type="button" aria-label={`增加一${product.unit}${product.name}`} disabled={quantity >= product.stock || quantity >= product.maxPerOrder} onClick={() => changeCart(product, 1)}>＋</button>
                            </div>
                          ) : <button type="button" className="primary-button product-card__add" disabled={product.stock === 0} onClick={() => changeCart(product, 1)}>{product.stock === 0 ? "本週售完" : "＋ 加入菜籃"}</button>}
                        </div>
                      </article>
                    );
                  })}
                  {filteredProducts.length === 0 && <EmptyState title="沒有符合的卡片" text="換個分類或搜尋詞再看看。" />}
                </div>

                <aside className="cart-panel" aria-labelledby="cart-title">
                  <div className="cart-panel__header"><div><span className="eyebrow">YOUR BASKET</span><h2 id="cart-title">我的菜籃</h2></div><span className="cart-count">{itemCount}</span></div>
                  {cartLines.length === 0 ? <div className="cart-empty"><span aria-hidden="true">╲＿╱</span><p>點一張喜歡的蔬果卡，菜籃就會裝起來。</p></div> : (
                    <div className="cart-lines">{cartLines.map(({ product, quantity }) => <div className="cart-line" key={product.id}><PixelSprite spriteKey={product.spriteKey} label={product.name} small /><div><strong>{product.name}</strong><span>{product.grade} 級・{quantity} {product.unit}</span></div><b>{money(product.price * quantity)}</b></div>)}</div>
                  )}
                  <div className="cart-totals"><span><span>商品</span><strong>{money(subtotal)}</strong></span><span><span>配送</span><strong>{deliveryFee === 0 ? "免運" : money(deliveryFee)}</strong></span><span className="cart-total"><span>合計</span><strong>{money(total)}</strong></span></div>
                  <p className="shipping-note">{subtotal >= 500 ? "太棒了！本籃已享免運。" : `再選 ${money(Math.max(0, 500 - subtotal))} 免運。`}</p>
                  {viewer ? <button type="button" className="primary-button primary-button--wide" disabled={cartLines.length === 0} onClick={() => setCheckoutOpen(true)}>生成我的可愛訂單</button> : <a className="primary-button primary-button--wide" href={SIGN_IN_PATH}>登入後送出訂單</a>}
                </aside>
              </div>
            </section>
          </>
        )}

        {view === "gacha" && (
          <section className="page-section section-wrap" aria-labelledby="gacha-title">
            <div className="page-intro page-intro--gacha"><div><span className="eyebrow">FRUIT POINT GACHA</span><h1 id="gacha-title">水果抽卡樂園</h1><p>免費抽用完後，每次花 {GACHA_COST} 水果點。抽到的是收藏卡，不會自動加入實體訂單。</p></div><div className="point-board"><span>目前持有</span><strong>{points}</strong><small>水果點</small></div></div>
            {!viewer ? <div className="auth-panel"><span aria-hidden="true">◆</span><div><h2>登入後開始收藏</h2><p>每週送一次免費抽卡；完成訂單核銷還能累積水果點。</p></div><a className="primary-button" href={SIGN_IN_PATH}>使用 ChatGPT 登入</a></div> : <>
              <div className="gacha-layout">
              <div className="gacha-machine" data-phase={drawPhase} aria-busy={isDrawing}>
                <div className="gacha-machine__screen">
                  <div className="gacha-machine__balls" aria-hidden="true"><span /><span /><span /><span /><span /></div>
                  <div className="gacha-machine__screen-content">
                    <div className="gacha-machine__mascot"><span className="gacha-machine__spark" aria-hidden="true">✦</span><PixelSprite spriteKey="pineapple" label="金鑽鳳梨" /><span className="gacha-machine__spark" aria-hidden="true">✦</span></div>
                    <strong>{DRAW_PHASE_LABELS[drawPhase]}</strong>
                  </div>
                </div>
                <div className="gacha-machine__label">謝謝你菜・本週卡池</div>
                <button type="button" className="gacha-knob" disabled={isDrawing || (freeDraws === 0 && points < GACHA_COST)} onClick={drawCard} aria-label={freeDraws > 0 ? "使用免費次數抽卡" : `使用 ${GACHA_COST} 點抽卡`}><span className="gacha-knob__handle" aria-hidden="true">↻</span></button>
                <div className="gacha-machine__chute" aria-hidden="true">
                  <span className="gacha-capsule"><span className="gacha-capsule__top" /><span className="gacha-capsule__bottom" /><span className="gacha-capsule__flash">✦</span></span>
                  <span className="gacha-machine__tray" />
                </div>
                <span className="sr-only" role="status" aria-live="polite">{DRAW_PHASE_LABELS[drawPhase]}</span>
                <button type="button" className="primary-button gacha-action" disabled={isDrawing || (freeDraws === 0 && points < GACHA_COST)} onClick={drawCard}>{isDrawing ? DRAW_PHASE_LABELS[drawPhase] : freeDraws > 0 ? `免費抽卡（剩 ${freeDraws} 次）` : `使用 ${GACHA_COST} 點抽一次`}</button>
              </div>
              <div className="gacha-info">
                <div className="pixel-panel"><span className="eyebrow">DROP RATE</span><h2>本週卡池機率</h2><div className="rate-list">{GRADE_ORDER.map((grade) => <span key={grade}><GradeBadge grade={grade} /><strong>{GRADE_RULES[grade].drawWeight}%</strong></span>)}</div><p>先抽等級，再從該等級的本週卡片中等機率出現。重複卡會累積收藏張數。</p></div>
                <div className="pixel-panel pixel-panel--tip"><strong>怎麼得到水果點？</strong><p>送貨手核銷訂單後，每 NT$10 商品金額得到 1 點。運費不列入計算。</p></div>
              </div>
              </div>
              <div className="collection-section"><div className="section-heading"><div><span className="eyebrow">MY CARD BOOK</span><h2>我的蔬果圖鑑</h2><p>已收藏 {collection.length} / {inventory.length} 種本週卡片。</p></div></div><div className="collection-grid">
                {inventory.map((product) => { const collected = collection.find((card) => card.cardId === `${product.id}-${product.grade}`); return <article className={`collection-card${collected ? " is-unlocked" : ""}`} key={product.id}><GradeBadge grade={product.grade} /><div className={collected ? "" : "is-silhouette"}><PixelSprite spriteKey={product.spriteKey} label={product.name} small /></div><strong>{collected ? product.cardName : "？？？？"}</strong><span>{collected ? `收藏 × ${collected.count}` : "尚未相遇"}</span></article>; })}
              </div></div>
            </>}
          </section>
        )}

        {view === "orders" && (
          <section className="page-section section-wrap" aria-labelledby="orders-title">
            <div className="page-intro"><div><span className="eyebrow">ORDER & DELIVERY</span><h1 id="orders-title">{isOwner ? "訂單與送貨核銷" : "我的菜攤訂單"}</h1><p>{isOwner ? "安排出車後，向顧客取得六位數核銷碼；核銷完成才會發水果點。" : "收到蔬果後，把訂單上的六位數核銷碼告訴送貨手，就能收到水果點。"}</p></div><button type="button" className="secondary-button" onClick={() => setView("market")}>＋ 再去挑菜</button></div>
            {!viewer ? <div className="auth-panel"><span aria-hidden="true">菜</span><div><h2>登入後查看訂單</h2><p>你的訂單、核銷碼與水果點會安全地綁定登入帳號。</p></div><a className="primary-button" href={SIGN_IN_PATH}>使用 ChatGPT 登入</a></div> : orders.length === 0 ? <EmptyState title="還沒有訂單" text={isOwner ? "新訂單送出後會出現在這裡。" : "選幾張本週蔬果卡，就能生成第一張可愛訂單。"} /> : (
              <div className={`orders-layout${isOwner ? "" : " orders-layout--single"}`}>
                <div className="orders-column"><div className="section-heading section-heading--compact"><div><span className="eyebrow">{isOwner ? "ALL ORDERS" : "CUSTOMER"}</span><h2>{isOwner ? "全部訂單" : "我的訂單"}</h2></div></div>
                  {orders.map((order) => <article className="order-card" key={order.id}>
                    <div className="order-card__header"><div><small>{timeText(order.createdAt)}</small><h3>{order.id}</h3></div><span className={`status status--${order.status}`}>{statusLabel[order.status]}</span></div>
                    <div className="order-lines">{order.lines.map((line) => <div key={`${order.id}-${line.productId}`}><span>{line.grade}・{line.name} × {line.quantity}</span><strong>{money(line.unitPrice * line.quantity)}</strong></div>)}</div>
                    <div className="order-card__delivery"><span><b>配送：</b>{order.deliverySlot}</span><span><b>地點：</b>{order.destination}</span></div>
                    {order.verificationCode && <div className="verification-ticket"><span>{order.status === "delivered" ? "已完成核銷" : "到貨時提供核銷碼"}</span><strong>{order.verificationCode}</strong><small>完成可得 {order.pointsEarned} 水果點</small></div>}
                    <div className="order-card__total"><span>訂單合計</span><strong>{money(order.total)}</strong></div>
                  </article>)}
                </div>
                {isOwner && <div className="delivery-console"><div className="console-title"><span className="console-light" aria-hidden="true" /><div><span className="eyebrow">DELIVERY MODE</span><h2>送貨核銷台</h2></div></div><p>先安排出車；到貨後輸入顧客提供的六位數碼，系統會自動發放點數。</p>
                  {orders.filter((order) => order.status !== "delivered").map((order) => <div className="delivery-job" key={order.id}><div><strong>{order.id}</strong><span>{order.customerName}・{order.destination}</span></div>{order.status === "placed" ? <button type="button" className="secondary-button" disabled={busyAction === `dispatch-${order.id}`} onClick={() => markOutForDelivery(order.id)}>{busyAction === `dispatch-${order.id}` ? "處理中…" : "安排出車"}</button> : <div className="verify-row"><label><span className="sr-only">輸入 {order.id} 的六位數核銷碼</span><input inputMode="numeric" maxLength={6} value={verificationInputs[order.id] ?? ""} placeholder="六位數核銷碼" onChange={(event) => setVerificationInputs((current) => ({ ...current, [order.id]: event.target.value.replace(/\D/g, "") }))} /></label><button type="button" className="primary-button" disabled={busyAction === `verify-${order.id}` || (verificationInputs[order.id] ?? "").length !== 6} onClick={() => verifyOrder(order)}>{busyAction === `verify-${order.id}` ? "核銷中…" : "核銷＋發點"}</button></div>}</div>)}
                  {orders.every((order) => order.status === "delivered") && <p className="all-done">本週配送任務都完成了！</p>}
                </div>}
              </div>
            )}
          </section>
        )}

        {view === "stall" && isOwner && (
          <section className="page-section section-wrap" aria-labelledby="stall-title">
            <div className="page-intro page-intro--stall"><div><span className="eyebrow">STALL OWNER MODE</span><h1 id="stall-title">自家菜攤更新站</h1><p>每週修改等級、價格、庫存與菜況，按一次發布，所有顧客裝置就會讀到最新資料。</p></div><div className="sync-status"><span className="sync-dot" aria-hidden="true" /><span><strong>雲端同步正常</strong><small>最近發布 {timeText(lastUpdatedAt)}</small></span></div></div>
            <div className="local-notice"><strong>攤主專用工作區</strong><p>這裡的修改會先留在畫面上；按下發布後才會一次同步到顧客菜單。</p></div>
            <div className="stall-panel"><div className="stall-panel__header"><div><span className="eyebrow">WEEKLY CATALOG</span><h2>{weekLabel} 菜單</h2></div><button type="button" className="primary-button" disabled={busyAction === "publish"} onClick={publishWeeklyMenu}>{busyAction === "publish" ? "發布中…" : "發布本週菜單"}</button></div>
              <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>圖卡／品項</th><th>等級</th><th>單價</th><th>庫存</th><th>本批菜況／果況</th></tr></thead><tbody>
                {inventory.map((product) => <tr key={product.id}><td><div className="inventory-product"><PixelSprite spriteKey={product.spriteKey} label={product.name} small /><span><strong>{product.name}</strong><small>{product.origin}・{product.unit}</small></span></div></td><td><label><span className="sr-only">{product.name}等級</span><select value={product.grade} onChange={(event) => updateProduct(product.id, { grade: event.target.value as Grade })}>{GRADE_ORDER.map((grade) => <option key={grade} value={grade}>{grade}・{GRADE_RULES[grade].name}</option>)}</select></label></td><td><label className="money-input"><span>$</span><input type="number" min="0" step="5" value={product.price} onChange={(event) => updateProduct(product.id, { price: Math.max(0, Number(event.target.value)) })} /></label></td><td><label><span className="sr-only">{product.name}庫存</span><input type="number" min="0" max="999" value={product.stock} onChange={(event) => updateProduct(product.id, { stock: Math.max(0, Number(event.target.value)) })} /></label></td><td><label><span className="sr-only">{product.name}本批狀況</span><input value={product.conditionNote} onChange={(event) => updateProduct(product.id, { conditionNote: event.target.value })} /></label></td></tr>)}
              </tbody></table></div><p className="stall-footnote">發布前請確認：腐壞、發霉、異味或嚴重病蟲害品不能上架，C 級也必須安全可食。</p>
            </div>
          </section>
        )}
      </main>

      <footer className="footer section-wrap"><div><strong>謝謝你，菜！</strong><span>把每一份好味道，送到剛剛好的地方。</span></div><span>每週一更新・週三／週六配送・雲端安全同步</span></footer>
      {itemCount > 0 && view === "market" && <button type="button" className="mobile-cart-bar" onClick={() => viewer ? setCheckoutOpen(true) : window.location.assign(SIGN_IN_PATH)}><span>{itemCount} 樣・{money(total)}</span><strong>{viewer ? "查看菜籃 →" : "登入後結帳 →"}</strong></button>}

      {checkoutOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCheckoutOpen(false)}><section className="order-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="關閉訂單表單" onClick={() => setCheckoutOpen(false)}>×</button><span className="eyebrow">CUTE ORDER FORM</span><h2 id="checkout-title">生成我的可愛訂單</h2><p>送出後會同步到菜攤，攤主就能為你備貨。</p>
        <div className="checkout-summary">{cartLines.map(({ product, quantity }) => <span key={product.id}><span>{product.grade}・{product.name} × {quantity}</span><strong>{money(product.price * quantity)}</strong></span>)}<span className="checkout-summary__total"><span>含配送合計</span><strong>{money(total)}</strong></span></div>
        <form className="checkout-form" onSubmit={placeOrder}><div className="form-grid"><label><span>收件人</span><input name="customerName" required maxLength={30} defaultValue={viewer?.displayName ?? ""} placeholder="例如：菜菜子" /></label><label><span>手機</span><input name="phone" required inputMode="tel" pattern="09[0-9]{8}" placeholder="0912345678" title="請輸入 09 開頭的 10 位手機號碼" /></label><label className="form-grid__wide"><span>配送／取貨地點</span><input name="destination" required maxLength={100} placeholder="地址或約定取貨點" /></label><label><span>希望時段</span><select name="deliverySlot" required defaultValue=""><option value="" disabled>請選擇</option><option>週三 14:00–17:00</option><option>週三 18:00–20:00</option><option>週六 09:00–12:00</option><option>週六 14:00–17:00</option></select></label><label><span>給菜攤的話（選填）</span><input name="note" maxLength={80} placeholder="例如：香蕉想要偏綠" /></label></div><button type="submit" className="primary-button primary-button--wide" disabled={busyAction === "order"}>{busyAction === "order" ? "正在送到菜攤…" : `送出訂單・${money(total)}`}</button></form>
      </section></div>}

      {receipt && <div className="modal-backdrop" role="presentation"><section className="receipt-modal" role="dialog" aria-modal="true" aria-labelledby="receipt-title"><div className="receipt-face" aria-hidden="true">\(^▽^)/</div><span className="eyebrow">ORDER COMPLETE</span><h2 id="receipt-title">訂單裝好囉！</h2><p>請保存這組到貨核銷碼，送貨手核銷後會發 {receipt.pointsEarned} 水果點。</p><div className="receipt-code"><span>{receipt.id}</span><strong>{receipt.verificationCode}</strong><small>六位數核銷碼</small></div><button type="button" className="primary-button primary-button--wide" onClick={() => { setReceipt(null); setView("orders"); }}>查看我的訂單</button></section></div>}

      {drawResult && <div className="modal-backdrop" role="presentation"><section className={`draw-modal draw-modal--${drawResult.grade.toLowerCase()}`} role="dialog" aria-modal="true" aria-labelledby="draw-title"><span className="draw-stars" aria-hidden="true">✦　✦　✦</span><GradeBadge grade={drawResult.grade} /><PixelSprite spriteKey={drawResult.spriteKey} label={drawResult.name} /><span className="eyebrow">NEW CARD!</span><h2 id="draw-title">{drawResult.cardName}</h2><p>{GRADE_RULES[drawResult.grade].short}・已收進你的蔬果圖鑑。</p><button type="button" className="primary-button primary-button--wide" onClick={() => setDrawResult(null)}>收進圖鑑</button></section></div>}

      <div className="toast" role="status" aria-live="polite" aria-atomic="true" data-visible={Boolean(toast)}>{toast}</div>
    </div>
  );
}
