(() => {
  "use strict";

  const catalog = window.THANK_YOU_CAI_CATALOG;
  if (!catalog || !catalog.sprites || !Array.isArray(catalog.products)) return;

  const upgradedSprites = {
    cucumber: { pixels: ["......11..", "....11221.", "...123321.", "..1233321.", ".12323321.", "123323321.", ".12323321.", "..1233321.", "...12221..", "....111..."], palette: { 1: "#294529", 2: "#397247", 3: "#a7cc55" } },
    guava: { pixels: ["....11....", "...1221...", "..123321..", ".12333321.", "1233343321", "1234444321", ".12344421.", "..123321..", "...1111...", ".........."], palette: { 1: "#294529", 2: "#78a94b", 3: "#d9e7a4", 4: "#f4b7ad" } },
    tomato: { pixels: ["....22....", "...2122...", "..221122..", ".13333331.", "1333443331", "1334444331", ".13344431.", "..133331..", "...1111...", ".........."], palette: { 1: "#8f3028", 2: "#397247", 3: "#d84d3e", 4: "#ff9d68" } },
    pepper: { pixels: ["....22....", "...2222...", "..221122..", ".13313331.", "1333133331", "1333333331", ".13333331.", "..133331..", "...1111...", ".........."], palette: { 1: "#294529", 2: "#397247", 3: "#5e9b42", 4: "#9ccc5a" } },
    orange: { pixels: ["....22....", "...2112...", "..122221..", ".12333321.", "1233443321", "1234444321", ".12333321.", "..122221..", "...1111...", ".........."], palette: { 1: "#80502b", 2: "#397247", 3: "#e97e2e", 4: "#ffc75a" } },
    loofah: { pixels: [".....111..", "....12221.", "...123321.", "..1232321.", ".12323221.", "123232221.", ".12323221.", "..1233321.", "...12221..", "....111..."], palette: { 1: "#294529", 2: "#78a94b", 3: "#b8d46a" } },
    mango: { pixels: ["....22....", "...2112...", "..123321..", ".12333321.", "123344321.", "123444321.", ".12344321.", "..1233321.", "...12221..", "....111..."], palette: { 1: "#80502b", 2: "#397247", 3: "#f1bd3d", 4: "#e97e2e" } },
    watermelon: { pixels: ["..........", "...1111...", "..122221..", ".12343421.", "1234343421", "1233434321", ".12343421.", "..122221..", "...1111...", ".........."], palette: { 1: "#294529", 2: "#397247", 3: "#d84d3e", 4: "#183427" } },
    waxapple: { pixels: ["....22....", "...2122...", "..221122..", "..133331..", ".13333331.", ".13344331.", "..144443..", "...14441..", "....444...", ".........."], palette: { 1: "#8f3028", 2: "#397247", 3: "#d84d3e", 4: "#f4b7ad" } },
    greenbean: { pixels: [".11.......", "1221......", ".12321....", "..12321...", "...12321..", "....12321.", ".....12321", "......1221", ".......11.", ".........."], palette: { 1: "#294529", 2: "#397247", 3: "#78a94b" } },
    bittermelon: { pixels: [".....11...", "....1221..", "...12321..", "..1232321.", ".12332321.", "123232321.", ".12332321.", "..1232321.", "...12221..", "....111..."], palette: { 1: "#294529", 2: "#397247", 3: "#78a94b" } },
    wintermelon: { pixels: ["....22....", "...2112...", "..122221..", ".12333321.", "1233443321", "1234444321", ".12333321.", "..122221..", "...1111...", ".........."], palette: { 1: "#294529", 2: "#397247", 3: "#5e9b42", 4: "#d9e7a4" } },
    bellpepper: { pixels: ["....22....", "...2222...", "..221122..", ".13343331.", "1334444331", "1344444431", ".13344331.", "..133331..", "...1111...", ".........."], palette: { 1: "#8f3028", 2: "#397247", 3: "#e97e2e", 4: "#ffd76b" } },
  };

  const sprites = Object.freeze({ ...catalog.sprites, ...upgradedSprites });
  window.THANK_YOU_CAI_CATALOG = Object.freeze({
    sprites,
    products: catalog.products,
  });

  const productById = new Map(catalog.products.map((product) => [product.id, product]));
  const categoryNames = { vegetable: "蔬菜", fruit: "水果" };
  const categoryIcons = { vegetable: "菜", fruit: "果" };

  function escapeText(value) {
    return String(value ?? "");
  }

  function enhanceCard(card) {
    if (!(card instanceof HTMLElement) || card.dataset.visualUpgrade === "v2") return;
    const button = card.querySelector("[data-id]");
    const product = button ? productById.get(button.dataset.id) : null;
    if (!product) return;

    card.dataset.visualUpgrade = "v2";
    card.dataset.category = product.category;

    const art = card.querySelector(".product-card__art");
    if (art) {
      art.dataset.category = product.category;
      const bg = document.createElement("span");
      bg.className = `product-card__art-bg product-card__art-bg--${product.category}`;
      bg.setAttribute("aria-hidden", "true");
      art.prepend(bg);

      const chip = document.createElement("span");
      chip.className = "product-card__category-chip";
      chip.textContent = `${categoryIcons[product.category] || "品"}・${categoryNames[product.category] || "商品"}`;
      art.append(chip);

      const shadow = document.createElement("span");
      shadow.className = "product-card__shadow";
      shadow.setAttribute("aria-hidden", "true");
      art.append(shadow);
    }

    const body = card.querySelector(".product-card__body");
    const origin = body?.querySelector(".origin");
    const title = body?.querySelector("h3");
    if (body && origin && title) {
      const meta = document.createElement("div");
      meta.className = "product-card__meta-row";
      origin.textContent = escapeText(product.origin);
      const unit = document.createElement("span");
      unit.className = "product-card__unit";
      unit.textContent = escapeText(product.unit);
      origin.replaceWith(meta);
      meta.append(origin, unit);

      const nameplate = document.createElement("strong");
      nameplate.className = "product-card__nameplate";
      nameplate.textContent = escapeText(product.cardName);
      title.insertAdjacentElement("afterend", nameplate);
    }
  }

  function enhanceAll() {
    document.querySelectorAll(".product-card").forEach(enhanceCard);
  }

  function loadCardEffects() {
    if (!document.querySelector('link[href$="card-effects.css"]')) {
      const style = document.createElement("link");
      style.rel = "stylesheet";
      style.href = "./card-effects.css";
      document.head.append(style);
    }
    if (!document.querySelector('script[src$="card-effects.js"]')) {
      const script = document.createElement("script");
      script.src = "./card-effects.js";
      script.defer = true;
      document.head.append(script);
    }
  }

  function start() {
    loadCardEffects();
    enhanceAll();
    const grid = document.querySelector("#product-grid");
    if (!grid) return;
    const observer = new MutationObserver(enhanceAll);
    observer.observe(grid, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
