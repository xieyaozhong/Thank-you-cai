import { sql } from "drizzle-orm";
import { check, integer, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["owner", "customer"] }).notNull().default("customer"),
  points: integer("points").notNull().default(0),
  freeDrawWeek: text("free_draw_week"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  check("users_role_check", sql`${table.role} in ('owner', 'customer')`),
  check("users_points_nonnegative", sql`${table.points} >= 0`),
  uniqueIndex("users_single_owner_idx").on(table.role).where(sql`${table.role} = 'owner'`),
]);

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  cardName: text("card_name").notNull(),
  category: text("category", { enum: ["vegetable", "fruit"] }).notNull(),
  grade: text("grade", { enum: ["S", "A", "B", "C"] }).notNull(),
  price: integer("price").notNull(),
  unit: text("unit").notNull(),
  origin: text("origin").notNull(),
  stock: integer("stock").notNull(),
  maxPerOrder: integer("max_per_order").notNull(),
  conditionNote: text("condition_note").notNull(),
  spriteKey: text("sprite_key").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  check("products_category_check", sql`${table.category} in ('vegetable', 'fruit')`),
  check("products_grade_check", sql`${table.grade} in ('S', 'A', 'B', 'C')`),
  check("products_price_nonnegative", sql`${table.price} >= 0`),
  check("products_stock_nonnegative", sql`${table.stock} >= 0`),
  check("products_max_per_order_positive", sql`${table.maxPerOrder} > 0`),
]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email),
  status: text("status", { enum: ["placed", "out_for_delivery", "delivered"] }).notNull().default("placed"),
  subtotal: integer("subtotal").notNull(),
  deliveryFee: integer("delivery_fee").notNull(),
  total: integer("total").notNull(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  destination: text("destination").notNull(),
  deliverySlot: text("delivery_slot").notNull(),
  note: text("note").notNull().default(""),
  verificationCode: text("verification_code").notNull(),
  pointsEarned: integer("points_earned").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  verifiedAt: text("verified_at"),
}, (table) => [
  check("orders_status_check", sql`${table.status} in ('placed', 'out_for_delivery', 'delivered')`),
  check("orders_totals_nonnegative", sql`${table.subtotal} >= 0 and ${table.deliveryFee} >= 0 and ${table.total} >= 0`),
]);

export const orderItems = sqliteTable("order_items", {
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id),
  name: text("name").notNull(),
  cardName: text("card_name").notNull(),
  grade: text("grade", { enum: ["S", "A", "B", "C"] }).notNull(),
  unit: text("unit").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  conditionNote: text("condition_note").notNull(),
  spriteKey: text("sprite_key").notNull(),
}, (table) => [
  primaryKey({ columns: [table.orderId, table.productId] }),
  check("order_items_quantity_positive", sql`${table.quantity} > 0`),
]);

export const collections = sqliteTable("collections", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  cardId: text("card_id").notNull(),
  productId: text("product_id").notNull().references(() => products.id),
  name: text("name").notNull(),
  cardName: text("card_name").notNull(),
  grade: text("grade", { enum: ["S", "A", "B", "C"] }).notNull(),
  spriteKey: text("sprite_key").notNull(),
  count: integer("count").notNull().default(1),
  firstDrawnAt: text("first_drawn_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userEmail, table.cardId] }),
  check("collections_count_positive", sql`${table.count} > 0`),
]);

export const weeklyDraws = sqliteTable("weekly_draws", {
  userEmail: text("user_email").notNull().references(() => users.email, { onDelete: "cascade" }),
  weekKey: text("week_key").notNull(),
  drawnAt: text("drawn_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.userEmail, table.weekKey] }),
]);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
