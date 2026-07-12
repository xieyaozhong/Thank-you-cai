(() => {
  "use strict";

  const base = window.THANK_YOU_CAI_CATALOG;
  if (!base) throw new Error("Base catalog is unavailable.");

  const extraSprites = {
    napacabbage: { pixels: ["...11.11..", "..1221221.", ".122222221", "1223333321", ".12333321.", "..133331..", "..144441..", ".14444441.", "..444444..", "...4444..."], palette: { 1: "#294529", 2: "#78a94b", 3: "#b8d46a", 4: "#f1efc8" } },
    waterspinach: { pixels: [".11....11.", "1221..1221", ".12211221.", "..122221..", "...1331...", "...1331...", "..143341..", ".14433441.", "..444444..", "...4444..."], palette: { 1: "#183427", 2: "#397247", 3: "#78a94b", 4: "#a7cc55" } },
    rapeseed: { pixels: ["..11..11..", ".12211221.", "1222222221", ".12233221.", "..133331..", "...1441...", "...1441...", "..144441..", ".14444441.", "..111111.."], palette: { 1: "#294529", 2: "#5e9b42", 3: "#f1bd3d", 4: "#78a94b" } },
    gaiLan: { pixels: ["..11..11..", ".12211221.", "1222222221", ".12222221.", "..133331..", "...1331...", "...1331...", "..144441..", ".14444441.", "..111111.."], palette: { 1: "#183427", 2: "#397247", 3: "#5e9b42", 4: "#78a94b" } },
    celery: { pixels: [".22....22.", "1221..1221", ".12211221.", "..133331..", "...1331...", "...1331...", "...1441...", "...1441...", "..144441..", ".11111111."], palette: { 1: "#294529", 2: "#78a94b", 3: "#a7cc55", 4: "#d9e7a4" } },
    chive: { pixels: [".1.1..1.1.", ".1.1..1.1.", ".1.1221.1.", ".12222221.", "..133331..", "...1331...", "...1331...", "...1441...", "..144441..", ".11111111."], palette: { 1: "#183427", 2: "#397247", 3: "#5e9b42", 4: "#a7cc55" } },
    greenbean: { pixels: ["..........", ".11.......", "1221......", ".12321....", "..12321...", "...12321..", "....12321.", ".....1221.", "......11..", ".........."], palette: { 1: "#294529", 2: "#397247", 3: "#78a94b" } },
    snowpea: { pixels: ["..........", "...1111...", "..122221..", ".12333321.", "1234344321", ".12344321.", "..122221..", "...1111...", "..........", ".........."], palette: { 1: "#294529", 2: "#78a94b", 3: "#b8d46a", 4: "#f1efc8" } },
    bittermelon: { pixels: ["..........", "......11..", ".....1221.", "....12321.", "...123321.", "..1232321.", ".12332321.", "12323221..", ".122211...", "..111....."], palette: { 1: "#294529", 2: "#397247", 3: "#78a94b" } },
    wintermelon: { pixels: ["....22....", "...2112...", "..111111..", ".13333331.", "1334444331", "1334444331", ".13333331.", "..133331..", "...1111...", ".........."], palette: { 1: "#294529", 2: "#397247", 3: "#5e9b42", 4: "#d9e7a4" } },
    bellpepper: { pixels: ["....22....", "...2222...", "...2112...", "..133331..", ".13344331.", ".13444431.", ".13344331.", "..133331..", "...1111...", ".........."], palette: { 1: "#8f3028", 2: "#397247", 3: "#e97e2e", 4: "#ffd76b" } },
    cauliflower: { pixels: ["..222222..", ".223232322.", "2233333322", ".23333332.", "..222222..", "...1441...", "...1441...", "..144441..", ".14444441.", "..111111.."], palette: { 1: "#294529", 2: "#d9d3c3", 3: "#fff0dc", 4: "#78a94b" } },
  };

  const extraProducts = [
    { id: "napacabbage-a", name: "大白菜", cardName: "霜甜大白菜", category: "vegetable", grade: "A", price: 72, unit: "顆", origin: "雲林", stock: 15, max: 3, note: "葉片柔嫩、菜心清甜，適合火鍋與燉煮。", sprite: "napacabbage" },
    { id: "waterspinach-s", name: "空心菜", cardName: "晨露空心菜", category: "vegetable", grade: "S", price: 46, unit: "把", origin: "彰化", stock: 20, max: 5, note: "清晨採收，莖葉爽脆，適合大火快炒。", sprite: "waterspinach" },
    { id: "rapeseed-a", name: "油菜", cardName: "金芽油菜", category: "vegetable", grade: "A", price: 44, unit: "把", origin: "桃園", stock: 18, max: 5, note: "嫩葉帶自然清香，汆燙或炒食都合適。", sprite: "rapeseed" },
    { id: "gailan-a", name: "芥藍", cardName: "青翠芥藍", category: "vegetable", grade: "A", price: 56, unit: "把", origin: "彰化", stock: 14, max: 4, note: "菜梗爽脆、葉片厚實，帶淡淡甘味。", sprite: "gaiLan" },
    { id: "celery-b", name: "芹菜", cardName: "清香芹菜", category: "vegetable", grade: "B", price: 50, unit: "把", origin: "雲林", stock: 16, max: 4, note: "莖長略有差異，香氣濃郁，適合炒肉或煮湯。", sprite: "celery" },
    { id: "chive-a", name: "韭菜", cardName: "翠香韭菜", category: "vegetable", grade: "A", price: 48, unit: "把", origin: "彰化", stock: 17, max: 5, note: "葉片柔韌、香氣鮮明，適合水餃與煎蛋。", sprite: "chive" },
    { id: "greenbean-a", name: "四季豆", cardName: "咔滋四季豆", category: "vegetable", grade: "A", price: 78, unit: "袋（300g）", origin: "南投", stock: 13, max: 4, note: "豆莢翠綠飽滿，充分加熱後口感爽脆。", sprite: "greenbean" },
    { id: "snowpea-s", name: "甜豆莢", cardName: "翡翠甜豆莢", category: "vegetable", grade: "S", price: 98, unit: "盒（250g）", origin: "台中", stock: 10, max: 3, note: "豆莢幼嫩清甜，簡單快炒即可上桌。", sprite: "snowpea" },
    { id: "bittermelon-b", name: "苦瓜", cardName: "翠玉苦瓜", category: "vegetable", grade: "B", price: 62, unit: "條", origin: "屏東", stock: 12, max: 3, note: "瓜身略彎、紋路自然，適合鹹蛋苦瓜或煮湯。", sprite: "bittermelon" },
    { id: "wintermelon-a", name: "冬瓜", cardName: "月白冬瓜", category: "vegetable", grade: "A", price: 68, unit: "切片（約1斤）", origin: "嘉義", stock: 14, max: 3, note: "果肉厚實清爽，煮湯後吸附湯汁、口感柔嫩。", sprite: "wintermelon" },
    { id: "bellpepper-s", name: "彩椒", cardName: "夕陽彩椒", category: "vegetable", grade: "S", price: 105, unit: "袋（3顆）", origin: "南投", stock: 11, max: 3, note: "紅黃果色鮮亮，甜脆多汁，適合生食或拌炒。", sprite: "bellpepper" },
    { id: "cauliflower-a", name: "白花椰菜", cardName: "雲朵白花椰菜", category: "vegetable", grade: "A", price: 92, unit: "顆", origin: "彰化", stock: 9, max: 3, note: "花球潔白緊實，川燙、烘烤或做濃湯都適合。", sprite: "cauliflower" },
  ];

  window.THANK_YOU_CAI_CATALOG = Object.freeze({
    sprites: Object.freeze({ ...base.sprites, ...extraSprites }),
    products: Object.freeze([...base.products, ...extraProducts].map((product) => Object.freeze({ ...product }))),
  });
})();
