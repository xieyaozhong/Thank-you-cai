export type Grade = "S" | "A" | "B" | "C";
export type Category = "vegetable" | "fruit";
export type View = "market" | "gacha" | "orders" | "stall";
export type OrderStatus = "placed" | "out_for_delivery" | "delivered";
export type UserRole = "owner" | "customer";

export const GRADE_RULES: Record<
  Grade,
  {
    name: string;
    short: string;
    standard: string;
    usage: string;
    drawWeight: number;
  }
> = {
  S: {
    name: "閃亮特選",
    short: "外觀與鮮度最佳",
    standard: "大小均勻、外觀完整，幾乎沒有碰傷；成熟度與鮮度都在最佳狀態。",
    usage: "送禮、生食、精緻料理",
    drawWeight: 5,
  },
  A: {
    name: "新鮮優選",
    short: "日常品質很好",
    standard: "允許少量自然皮痕或形狀差異，鮮度、口感與風味都完整。",
    usage: "日常生食與料理",
    drawWeight: 20,
  },
  B: {
    name: "實惠好味",
    short: "外觀普通但好吃",
    standard: "大小不一或有明顯表皮痕跡，整理後仍可安心正常食用。",
    usage: "家庭料理、便當、果汁",
    drawWeight: 30,
  },
  C: {
    name: "惜食即享",
    short: "熟度高，請盡快享用",
    standard: "外型不規則、熟度較高或需少量修切，但仍通過安全底線，絕非腐壞品。",
    usage: "湯品、燉煮、果汁、果醬",
    drawWeight: 45,
  },
};

export const SPRITES = {
  cabbage: {
    pixels: ["....22....", "...2112...", "..213312..", ".21333312.", "2131313312", "2133333312", ".21333312.", "..211112..", "...2442...", "....44...."],
    palette: { "1": "#294529", "2": "#78a94b", "3": "#b8d46a", "4": "#d9e7a4" },
  },
  bokchoy: {
    pixels: ["...11.11..", "..1221221.", ".122212221", "..1222221.", "...1331...", "...1331...", "..143341..", ".14433441.", "..444444..", "...4444..."],
    palette: { "1": "#294529", "2": "#397247", "3": "#78a94b", "4": "#d9e7a4" },
  },
  cucumber: {
    pixels: ["..........", ".......11.", "......1221", ".....12321", "....12321.", "...12321..", "..12321...", ".12321....", "12221.....", ".111......"],
    palette: { "1": "#294529", "2": "#397247", "3": "#a7cc55" },
  },
  carrot: {
    pixels: ["...22.22..", "..222222..", "...2112...", "...1331...", "...1331...", "....33....", "....33....", "....33....", "....33....", "....11...."],
    palette: { "1": "#7a3e2b", "2": "#397247", "3": "#e97e2e" },
  },
  guava: {
    pixels: ["....11....", "...1221...", "..122221..", ".12333321.", "1234444321", "1234444321", ".12344321.", "..122221..", "...1111...", ".........."],
    palette: { "1": "#294529", "2": "#78a94b", "3": "#d9e7a4", "4": "#f4b7ad" },
  },
  banana: {
    pixels: ["..........", "..11......", ".1221.....", ".13321....", "..13321...", "...13321..", "....13321.", ".....1221.", "......11..", ".........."],
    palette: { "1": "#805b2c", "2": "#f1bd3d", "3": "#ffe26a" },
  },
  pineapple: {
    pixels: ["...2..2...", "..222222..", "...2222...", "...1111...", "..133331..", "..131131..", "..133331..", "..131131..", "..133331..", "...1111..."],
    palette: { "1": "#805b2c", "2": "#397247", "3": "#f1bd3d" },
  },
  tomato: {
    pixels: ["....22....", "...2222...", "...2112...", "..133331..", ".13333331.", ".13343331.", ".13333331.", "..133331..", "...1111...", ".........."],
    palette: { "1": "#8f3028", "2": "#397247", "3": "#d84d3e", "4": "#ff9d68" },
  },
} as const;

export type SpriteKey = keyof typeof SPRITES;

export type Product = {
  id: string;
  name: string;
  cardName: string;
  category: Category;
  grade: Grade;
  price: number;
  unit: string;
  origin: string;
  stock: number;
  maxPerOrder: number;
  conditionNote: string;
  spriteKey: SpriteKey;
};

export type OrderLine = {
  productId: string;
  name: string;
  cardName: string;
  grade: Grade;
  unit: string;
  unitPrice: number;
  quantity: number;
  conditionNote: string;
  spriteKey: SpriteKey;
};

export type Order = {
  id: string;
  userEmail?: string;
  status: OrderStatus;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  customerName: string;
  phone: string;
  destination: string;
  deliverySlot: string;
  note: string;
  verificationCode?: string;
  pointsEarned: number;
  createdAt: string;
  verifiedAt?: string;
};

export type Viewer = {
  email: string;
  displayName: string;
  role: UserRole;
  points: number;
  freeDraws: number;
};

export type MarketState = {
  products: Product[];
  weekLabel: string;
  lastUpdatedAt: string;
  viewer: Viewer | null;
  orders: Order[];
  collection: CollectionCard[];
};

export type CollectionCard = {
  cardId: string;
  productId: string;
  name: string;
  cardName: string;
  grade: Grade;
  spriteKey: SpriteKey;
  count: number;
  firstDrawnAt: string;
};

export const INITIAL_PRODUCTS: Product[] = [
  { id: "cabbage-a", name: "高麗菜", cardName: "翠玉高麗菜", category: "vegetable", grade: "A", price: 80, unit: "顆", origin: "雲林", stock: 18, maxPerOrder: 3, conditionNote: "葉球扎實，外葉有少量自然擦痕。", spriteKey: "cabbage" },
  { id: "bokchoy-s", name: "青江菜", cardName: "晨露青江菜", category: "vegetable", grade: "S", price: 45, unit: "把", origin: "彰化", stock: 12, maxPerOrder: 5, conditionNote: "清晨採收，葉片挺脆飽水。", spriteKey: "bokchoy" },
  { id: "cucumber-a", name: "小黃瓜", cardName: "咔滋小黃瓜", category: "vegetable", grade: "A", price: 65, unit: "袋（600g）", origin: "南投", stock: 14, maxPerOrder: 4, conditionNote: "爽脆清甜，部分瓜身微彎。", spriteKey: "cucumber" },
  { id: "carrot-b", name: "紅蘿蔔", cardName: "彎彎紅蘿蔔", category: "vegetable", grade: "B", price: 42, unit: "袋（3 根）", origin: "台中", stock: 20, maxPerOrder: 4, conditionNote: "大小不一、形狀彎曲，甜味與口感正常。", spriteKey: "carrot" },
  { id: "guava-s", name: "珍珠芭樂", cardName: "星光珍珠芭樂", category: "fruit", grade: "S", price: 105, unit: "斤", origin: "高雄", stock: 10, maxPerOrder: 3, conditionNote: "果型均勻、硬脆，甜度佳。", spriteKey: "guava" },
  { id: "banana-c", name: "香蕉", cardName: "甜甜惜食香蕉", category: "fruit", grade: "C", price: 45, unit: "把", origin: "屏東", stock: 8, maxPerOrder: 2, conditionNote: "已熟透且有糖斑，建議今天吃或打果汁。", spriteKey: "banana" },
  { id: "pineapple-b", name: "金鑽鳳梨", cardName: "迷你金鑽鳳梨", category: "fruit", grade: "B", price: 110, unit: "顆", origin: "嘉義", stock: 9, maxPerOrder: 2, conditionNote: "果型略小，香氣與果肉狀況正常。", spriteKey: "pineapple" },
  { id: "tomato-a", name: "玉女小番茄", cardName: "紅寶石小番茄", category: "fruit", grade: "A", price: 95, unit: "盒", origin: "嘉義", stock: 16, maxPerOrder: 4, conditionNote: "果色自然，少量大小差異，酸甜清脆。", spriteKey: "tomato" },
];

export const GACHA_COST = 50;
export const GRADE_ORDER: Grade[] = ["S", "A", "B", "C"];

export function getWeekLabel(date = new Date()) {
  const current = new Date(date);
  const day = current.getDay();
  const start = new Date(current);
  start.setDate(current.getDate() + (day === 0 ? -6 : 1 - day));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const short = (value: Date) => `${value.getMonth() + 1}/${value.getDate()}`;
  return `${short(start)}（一）— ${short(end)}（日）`;
}

export function money(value: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value);
}

export function timeText(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
