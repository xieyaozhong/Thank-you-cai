import { getD1 } from "../../../db";
import {
  GRADE_ORDER,
  GRADE_RULES,
  INITIAL_PRODUCTS,
  getWeekLabel,
  type CollectionCard,
  type Grade,
  type MarketState,
  type Order,
  type OrderLine,
  type OrderStatus,
  type Product,
  type SpriteKey,
  type UserRole,
  type Viewer,
} from "../../market-data";

type Identity = { email: string; displayName: string };
type UserRow = { email: string; display_name: string; role: UserRole; points: number };
type ProductRow = {
  id: string; name: string; card_name: string; category: "vegetable" | "fruit"; grade: Grade;
  price: number; unit: string; origin: string; stock: number; max_per_order: number;
  condition_note: string; sprite_key: SpriteKey; sort_order: number;
};
type OrderRow = {
  id: string; user_email: string; status: OrderStatus; subtotal: number; delivery_fee: number;
  total: number; customer_name: string; phone: string; destination: string; delivery_slot: string;
  note: string; verification_code: string; points_earned: number; created_at: string; verified_at: string | null;
};
type OrderItemRow = {
  product_id: string; name: string; card_name: string; grade: Grade; unit: string;
  unit_price: number; quantity: number; condition_note: string; sprite_key: SpriteKey;
};
type CollectionRow = {
  card_id: string; product_id: string; name: string; card_name: string; grade: Grade;
  sprite_key: SpriteKey; count: number; first_drawn_at: string;
};

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) return Response.json({ error: error.message }, { status: error.status });
  console.error("菜攤 API 錯誤", error);
  return Response.json({ error: "菜攤暫時忙碌中，請稍後再試。" }, { status: 500 });
}

let initialization: Promise<void> | null = null;

export async function ensureMarketDatabase() {
  if (!initialization) {
    initialization = initializeMarketDatabase().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  await initialization;
}

async function initializeMarketDatabase() {
  const db = getD1();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('owner', 'customer')),
      points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
      free_draw_week TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS users_single_owner_idx ON users(role) WHERE role = 'owner'"),
    db.prepare(`CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      card_name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('vegetable', 'fruit')),
      grade TEXT NOT NULL CHECK (grade IN ('S', 'A', 'B', 'C')),
      price INTEGER NOT NULL CHECK (price >= 0),
      unit TEXT NOT NULL,
      origin TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK (stock >= 0),
      max_per_order INTEGER NOT NULL CHECK (max_per_order > 0),
      condition_note TEXT NOT NULL,
      sprite_key TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY NOT NULL,
      user_email TEXT NOT NULL REFERENCES users(email),
      status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'out_for_delivery', 'delivered')),
      subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
      delivery_fee INTEGER NOT NULL CHECK (delivery_fee >= 0),
      total INTEGER NOT NULL CHECK (total >= 0),
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      destination TEXT NOT NULL,
      delivery_slot TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      verification_code TEXT NOT NULL,
      points_earned INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      verified_at TEXT
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders(user_email, created_at DESC)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS order_items (
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      card_name TEXT NOT NULL,
      grade TEXT NOT NULL,
      unit TEXT NOT NULL,
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL CHECK (quantity > 0),
      condition_note TEXT NOT NULL,
      sprite_key TEXT NOT NULL,
      PRIMARY KEY (order_id, product_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS collections (
      user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      card_id TEXT NOT NULL,
      product_id TEXT NOT NULL REFERENCES products(id),
      name TEXT NOT NULL,
      card_name TEXT NOT NULL,
      grade TEXT NOT NULL,
      sprite_key TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1 CHECK (count > 0),
      first_drawn_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_email, card_id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS weekly_draws (
      user_email TEXT NOT NULL REFERENCES users(email) ON DELETE CASCADE,
      week_key TEXT NOT NULL,
      drawn_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_email, week_key)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
  ]);

  const now = new Date().toISOString();
  await db.batch([
    ...INITIAL_PRODUCTS.map((product, index) => db.prepare(`INSERT OR IGNORE INTO products
      (id, name, card_name, category, grade, price, unit, origin, stock, max_per_order, condition_note, sprite_key, sort_order, active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`)
      .bind(product.id, product.name, product.cardName, product.category, product.grade, product.price, product.unit, product.origin, product.stock, product.maxPerOrder, product.conditionNote, product.spriteKey, index, now)),
    db.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('week_label', ?, ?)").bind(currentWeekLabel(), now),
    db.prepare("INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES ('last_updated_at', ?, ?)").bind(now, now),
  ]);
}

function taipeiDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

function currentWeekKey() {
  const taipeiDate = new Date(`${taipeiDateString()}T00:00:00.000Z`);
  const day = taipeiDate.getUTCDay();
  taipeiDate.setUTCDate(taipeiDate.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return taipeiDate.toISOString().slice(0, 10);
}

function currentWeekLabel() {
  return getWeekLabel(new Date(`${taipeiDateString()}T12:00:00+08:00`));
}

function decodeDisplayName(value: string | null, encoding: string | null) {
  if (!value || encoding !== "percent-encoded-utf-8") return null;
  try { return decodeURIComponent(value); } catch { return null; }
}

export function requestIdentity(request: Request): Identity | null {
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (email) {
    const fullName = decodeDisplayName(
      request.headers.get("oai-authenticated-user-full-name"),
      request.headers.get("oai-authenticated-user-full-name-encoding"),
    );
    return { email, displayName: fullName ?? email };
  }
  const hostname = new URL(request.url).hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return { email: "owner@local.test", displayName: "本機攤主" };
  }
  return null;
}

async function requireUser(request: Request) {
  const identity = requestIdentity(request);
  if (!identity) throw new ApiError(401, "請先使用 ChatGPT 登入，完成後即可繼續操作。");
  return ensureUser(identity);
}

async function requireOwner(request: Request) {
  const user = await requireUser(request);
  if (user.role !== "owner") throw new ApiError(403, "這個功能只開放給菜攤攤主。");
  return user;
}

async function ensureUser(identity: Identity): Promise<UserRow> {
  await ensureMarketDatabase();
  const db = getD1();
  let user = await db.prepare("SELECT email, display_name, role, points FROM users WHERE email = ?").bind(identity.email).first<UserRow>();
  if (!user) {
    const owner = await db.prepare("SELECT email FROM users WHERE role = 'owner' LIMIT 1").first<{ email: string }>();
    const preferredRole: UserRole = owner ? "customer" : "owner";
    try {
      await db.prepare("INSERT INTO users (email, display_name, role) VALUES (?, ?, ?)").bind(identity.email, identity.displayName, preferredRole).run();
    } catch (error) {
      if (preferredRole !== "owner") throw error;
      await db.prepare("INSERT OR IGNORE INTO users (email, display_name, role) VALUES (?, ?, 'customer')").bind(identity.email, identity.displayName).run();
    }
    user = await db.prepare("SELECT email, display_name, role, points FROM users WHERE email = ?").bind(identity.email).first<UserRow>();
  } else if (user.display_name !== identity.displayName) {
    await db.prepare("UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE email = ?").bind(identity.displayName, identity.email).run();
    user = { ...user, display_name: identity.displayName };
  }
  if (!user) throw new ApiError(500, "無法建立菜攤帳號。");
  return user;
}

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id, name: row.name, cardName: row.card_name, category: row.category, grade: row.grade,
    price: row.price, unit: row.unit, origin: row.origin, stock: row.stock,
    maxPerOrder: row.max_per_order, conditionNote: row.condition_note, spriteKey: row.sprite_key,
  };
}

async function readProducts() {
  const result = await getD1().prepare(`SELECT id, name, card_name, category, grade, price, unit, origin, stock,
    max_per_order, condition_note, sprite_key, sort_order FROM products WHERE active = 1 ORDER BY sort_order, id`).all<ProductRow>();
  return result.results.map(rowToProduct);
}

async function hydrateOrder(row: OrderRow, viewer: UserRow): Promise<Order> {
  const items = await getD1().prepare(`SELECT product_id, name, card_name, grade, unit, unit_price,
    quantity, condition_note, sprite_key FROM order_items WHERE order_id = ? ORDER BY rowid`).bind(row.id).all<OrderItemRow>();
  const lines: OrderLine[] = items.results.map((item) => ({
    productId: item.product_id,
    name: item.name,
    cardName: item.card_name,
    grade: item.grade,
    unit: item.unit,
    unitPrice: item.unit_price,
    quantity: item.quantity,
    conditionNote: item.condition_note,
    spriteKey: item.sprite_key,
  }));
  return {
    id: row.id,
    userEmail: viewer.role === "owner" ? row.user_email : undefined,
    status: row.status,
    lines,
    subtotal: row.subtotal,
    deliveryFee: row.delivery_fee,
    total: row.total,
    customerName: row.customer_name,
    phone: row.phone,
    destination: row.destination,
    deliverySlot: row.delivery_slot,
    note: row.note,
    verificationCode: row.user_email === viewer.email ? row.verification_code : undefined,
    pointsEarned: row.points_earned,
    createdAt: row.created_at,
    verifiedAt: row.verified_at ?? undefined,
  };
}

async function readOrders(viewer: UserRow) {
  const statement = viewer.role === "owner"
    ? getD1().prepare("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100")
    : getD1().prepare("SELECT * FROM orders WHERE user_email = ? ORDER BY created_at DESC LIMIT 50").bind(viewer.email);
  const rows = await statement.all<OrderRow>();
  return Promise.all(rows.results.map((row) => hydrateOrder(row, viewer)));
}

async function readCollection(email: string) {
  const rows = await getD1().prepare(`SELECT card_id, product_id, name, card_name, grade, sprite_key,
    count, first_drawn_at FROM collections WHERE user_email = ? ORDER BY first_drawn_at DESC`).bind(email).all<CollectionRow>();
  return rows.results.map<CollectionCard>((row) => ({
    cardId: row.card_id,
    productId: row.product_id,
    name: row.name,
    cardName: row.card_name,
    grade: row.grade,
    spriteKey: row.sprite_key,
    count: row.count,
    firstDrawnAt: row.first_drawn_at,
  }));
}

export async function getMarketState(request: Request): Promise<MarketState> {
  await ensureMarketDatabase();
  const identity = requestIdentity(request);
  const user = identity ? await ensureUser(identity) : null;
  const [products, settingsResult] = await Promise.all([
    readProducts(),
    getD1().prepare("SELECT key, value FROM settings WHERE key IN ('week_label', 'last_updated_at')").all<{ key: string; value: string }>(),
  ]);
  const settings = new Map(settingsResult.results.map((row) => [row.key, row.value]));

  let viewer: Viewer | null = null;
  let orders: Order[] = [];
  let collection: CollectionCard[] = [];
  if (user) {
    const [weeklyDraw, userOrders, userCollection] = await Promise.all([
      getD1().prepare("SELECT week_key FROM weekly_draws WHERE user_email = ? AND week_key = ?").bind(user.email, currentWeekKey()).first<{ week_key: string }>(),
      readOrders(user),
      readCollection(user.email),
    ]);
    viewer = {
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      points: user.points,
      freeDraws: weeklyDraw ? 0 : 1,
    };
    orders = userOrders;
    collection = userCollection;
  }

  return {
    products,
    weekLabel: settings.get("week_label") ?? currentWeekLabel(),
    lastUpdatedAt: settings.get("last_updated_at") ?? new Date().toISOString(),
    viewer,
    orders,
    collection,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(payload: Record<string, unknown>, key: string, maxLength: number) {
  const value = typeof payload[key] === "string" ? payload[key].trim() : "";
  if (!value) throw new ApiError(400, `${key} 為必填欄位。`);
  if (value.length > maxLength) throw new ApiError(400, `${key} 字數過長。`);
  return value;
}

function randomDigits() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(100000 + (value[0] % 900000));
}

function randomFloat() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] / 4_294_967_296;
}

export async function createOrder(request: Request, input: unknown) {
  const user = await requireUser(request);
  if (!isRecord(input) || !Array.isArray(input.lines) || input.lines.length === 0 || input.lines.length > 20) {
    throw new ApiError(400, "訂單品項格式不正確。");
  }

  const customerName = requiredText(input, "customerName", 30);
  const phone = requiredText(input, "phone", 10);
  const destination = requiredText(input, "destination", 100);
  const deliverySlot = requiredText(input, "deliverySlot", 30);
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 80) : "";
  if (!/^09\d{8}$/.test(phone)) throw new ApiError(400, "手機號碼需為 09 開頭的 10 位數字。");
  const allowedSlots = new Set(["週三 14:00–17:00", "週三 18:00–20:00", "週六 09:00–12:00", "週六 14:00–17:00"]);
  if (!allowedSlots.has(deliverySlot)) throw new ApiError(400, "配送時段不在可選範圍內。");

  const requested = new Map<string, number>();
  for (const value of input.lines) {
    if (!isRecord(value) || typeof value.productId !== "string" || !Number.isInteger(value.quantity)) {
      throw new ApiError(400, "訂單品項格式不正確。");
    }
    const productId = value.productId.trim();
    const quantity = Number(value.quantity);
    if (!productId || quantity < 1 || requested.has(productId)) throw new ApiError(400, "訂單包含重複或無效品項。");
    requested.set(productId, quantity);
  }

  const productMap = new Map((await readProducts()).map((product) => [product.id, product]));
  const selected = [...requested].map(([id, quantity]) => {
    const product = productMap.get(id);
    if (!product) throw new ApiError(400, "有一項蔬果已經下架，請重新整理菜籃。");
    if (quantity > product.maxPerOrder) throw new ApiError(400, `${product.name} 每單最多 ${product.maxPerOrder} ${product.unit}。`);
    if (quantity > product.stock) throw new ApiError(409, `${product.name} 的庫存剛剛有變動，現在只剩 ${product.stock} ${product.unit}。`);
    return { product, quantity };
  });
  const subtotal = selected.reduce((sum, { product, quantity }) => sum + product.price * quantity, 0);
  const deliveryFee = subtotal >= 500 ? 0 : 60;
  const total = subtotal + deliveryFee;
  const pointsEarned = Math.floor(subtotal / 10);
  const datePart = taipeiDateString().replaceAll("-", "");
  const orderId = `TC-${datePart}-${crypto.randomUUID().replaceAll("-", "").slice(0, 6).toUpperCase()}`;
  const verificationCode = randomDigits();
  const createdAt = new Date().toISOString();
  const db = getD1();

  try {
    await db.batch([
      db.prepare(`INSERT INTO orders (id, user_email, status, subtotal, delivery_fee, total, customer_name, phone,
        destination, delivery_slot, note, verification_code, points_earned, created_at)
        VALUES (?, ?, 'placed', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(orderId, user.email, subtotal, deliveryFee, total, customerName, phone, destination, deliverySlot, note, verificationCode, pointsEarned, createdAt),
      ...selected.flatMap(({ product, quantity }) => [
        db.prepare(`INSERT INTO order_items (order_id, product_id, name, card_name, grade, unit, unit_price,
          quantity, condition_note, sprite_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(orderId, product.id, product.name, product.cardName, product.grade, product.unit, product.price, quantity, product.conditionNote, product.spriteKey),
        db.prepare("UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(quantity, product.id),
      ]),
    ]);
  } catch {
    throw new ApiError(409, "庫存剛剛有變動，請重新整理菜單後再送一次。");
  }

  const row = await db.prepare("SELECT * FROM orders WHERE id = ?").bind(orderId).first<OrderRow>();
  if (!row) throw new ApiError(500, "訂單已送出，但暫時無法讀取收據。");
  return hydrateOrder(row, user);
}

export async function dispatchOrder(request: Request, orderId: string) {
  await requireOwner(request);
  const result = await getD1().prepare("UPDATE orders SET status = 'out_for_delivery' WHERE id = ? AND status = 'placed'").bind(orderId).run();
  if (!result.meta.changes) throw new ApiError(409, "這張訂單目前無法安排出車，可能已處理或不存在。");
}

export async function verifyOrder(request: Request, orderId: string, input: unknown) {
  await requireOwner(request);
  const code = isRecord(input) && typeof input.code === "string" ? input.code.trim() : "";
  if (!/^\d{6}$/.test(code)) throw new ApiError(400, "請輸入六位數核銷碼。");
  const db = getD1();
  const order = await db.prepare("SELECT user_email, status, verification_code, points_earned FROM orders WHERE id = ?").bind(orderId).first<{
    user_email: string; status: OrderStatus; verification_code: string; points_earned: number;
  }>();
  if (!order) throw new ApiError(404, "找不到這張訂單。");
  if (order.status !== "out_for_delivery") throw new ApiError(409, "訂單尚未出車或已經完成核銷。");
  if (order.verification_code !== code) throw new ApiError(400, "核銷碼不正確，請請顧客再確認一次。");

  const results = await db.batch([
    db.prepare(`UPDATE users SET points = points + ?, updated_at = CURRENT_TIMESTAMP
      WHERE email = ? AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND status = 'out_for_delivery' AND verification_code = ?)`)
      .bind(order.points_earned, order.user_email, orderId, code),
    db.prepare(`UPDATE orders SET status = 'delivered', verified_at = CURRENT_TIMESTAMP
      WHERE id = ? AND status = 'out_for_delivery' AND verification_code = ?`).bind(orderId, code),
  ]);
  if (!results[1]?.meta.changes) throw new ApiError(409, "這張訂單剛剛已被其他裝置核銷。");
}

export async function drawGacha(request: Request) {
  const user = await requireUser(request);
  const db = getD1();
  const products = await readProducts();
  if (products.length === 0) throw new ApiError(409, "本週卡池還沒有蔬果卡。");
  const weekKey = currentWeekKey();
  const weeklyDraw = await db.prepare("SELECT week_key FROM weekly_draws WHERE user_email = ? AND week_key = ?").bind(user.email, weekKey).first<{ week_key: string }>();
  const useFreeDraw = !weeklyDraw;
  if (!useFreeDraw && user.points < 50) throw new ApiError(409, `還差 ${50 - user.points} 點才能再抽一次。`);

  const availableGrades = GRADE_ORDER.filter((grade) => products.some((product) => product.grade === grade));
  const totalWeight = availableGrades.reduce((sum, grade) => sum + GRADE_RULES[grade].drawWeight, 0);
  let roll = randomFloat() * totalWeight;
  let selectedGrade = availableGrades[availableGrades.length - 1];
  for (const grade of availableGrades) {
    roll -= GRADE_RULES[grade].drawWeight;
    if (roll <= 0) { selectedGrade = grade; break; }
  }
  const candidates = products.filter((product) => product.grade === selectedGrade);
  const product = candidates[Math.floor(randomFloat() * candidates.length)];
  const cardId = `${product.id}-${product.grade}`;
  const firstDrawnAt = new Date().toISOString();

  try {
    await db.batch([
      useFreeDraw
        ? db.prepare("INSERT INTO weekly_draws (user_email, week_key, drawn_at) VALUES (?, ?, ?)").bind(user.email, weekKey, firstDrawnAt)
        : db.prepare("UPDATE users SET points = points - 50, updated_at = CURRENT_TIMESTAMP WHERE email = ?").bind(user.email),
      db.prepare(`INSERT INTO collections (user_email, card_id, product_id, name, card_name, grade, sprite_key, count, first_drawn_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
        ON CONFLICT(user_email, card_id) DO UPDATE SET count = collections.count + 1`)
        .bind(user.email, cardId, product.id, product.name, product.cardName, product.grade, product.spriteKey, firstDrawnAt),
    ]);
  } catch {
    throw new ApiError(409, "抽卡狀態剛剛有變動，請重新整理後再試。");
  }
  const row = await db.prepare(`SELECT card_id, product_id, name, card_name, grade, sprite_key, count, first_drawn_at
    FROM collections WHERE user_email = ? AND card_id = ?`).bind(user.email, cardId).first<CollectionRow>();
  if (!row) throw new ApiError(500, "抽卡完成，但收藏圖鑑暫時沒有回應。");
  return {
    cardId: row.card_id, productId: row.product_id, name: row.name, cardName: row.card_name,
    grade: row.grade, spriteKey: row.sprite_key, count: row.count, firstDrawnAt: row.first_drawn_at,
  } satisfies CollectionCard;
}

export async function publishMenu(request: Request, input: unknown) {
  await requireOwner(request);
  if (!isRecord(input) || !Array.isArray(input.products) || input.products.length === 0) {
    throw new ApiError(400, "請提供要發布的菜單品項。");
  }
  const existing = new Set((await readProducts()).map((product) => product.id));
  const seen = new Set<string>();
  const updates = input.products.map((value) => {
    if (!isRecord(value) || typeof value.id !== "string" || !existing.has(value.id) || seen.has(value.id)) {
      throw new ApiError(400, "菜單包含不存在或重複的品項。");
    }
    seen.add(value.id);
    const grade = value.grade;
    const price = Number(value.price);
    const stock = Number(value.stock);
    const conditionNote = typeof value.conditionNote === "string" ? value.conditionNote.trim() : "";
    if (!GRADE_ORDER.includes(grade as Grade)) throw new ApiError(400, "蔬果等級必須是 S、A、B 或 C。");
    if (!Number.isInteger(price) || price < 0 || price > 100_000) throw new ApiError(400, "單價格式不正確。");
    if (!Number.isInteger(stock) || stock < 0 || stock > 9_999) throw new ApiError(400, "庫存格式不正確。");
    if (!conditionNote || conditionNote.length > 160) throw new ApiError(400, "請填寫 160 字內的本批菜況。");
    return { id: value.id, grade: grade as Grade, price, stock, conditionNote };
  });
  const lastUpdatedAt = new Date().toISOString();
  const weekLabel = currentWeekLabel();
  const db = getD1();
  await db.batch([
    ...updates.map((product) => db.prepare(`UPDATE products SET grade = ?, price = ?, stock = ?, condition_note = ?,
      updated_at = ? WHERE id = ?`).bind(product.grade, product.price, product.stock, product.conditionNote, lastUpdatedAt, product.id)),
    db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('week_label', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).bind(weekLabel, lastUpdatedAt),
    db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('last_updated_at', ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).bind(lastUpdatedAt, lastUpdatedAt),
  ]);
  return { weekLabel, lastUpdatedAt };
}
