(() => {
  "use strict";

  const catalog = window.THANK_YOU_CAI_CATALOG;
  if (!catalog?.products) return;

  const effects = {
    "cabbage-a": ["leaf-orbit", "葉影環繞", "#78a94b", "#d9e7a4"],
    "bokchoy-s": ["dew-rise", "晨露上升", "#78a94b", "#f1efc8"],
    "cucumber-a": ["water-sheen", "水光掠影", "#5e9b42", "#b8e6d2"],
    "carrot-b": ["sun-pulse", "橙陽脈動", "#e97e2e", "#f1bd3d"],
    "guava-s": ["star-twinkle", "星光閃爍", "#78a94b", "#f4b7ad"],
    "banana-c": ["sugar-drift", "糖斑飄散", "#f1bd3d", "#805b2c"],
    "pineapple-b": ["crown-ray", "金冠放射", "#f1bd3d", "#78a94b"],
    "tomato-a": ["juice-bubble", "果汁氣泡", "#d84d3e", "#ff9d68"],
    "eggplant-a": ["magic-ring", "紫晶光環", "#70408f", "#a56cc1"],
    "corn-s": ["kernel-spark", "玉米粒閃光", "#f1bd3d", "#ffe26a"],
    "pumpkin-b": ["harvest-breath", "豐收呼吸", "#cf6328", "#f29a3a"],
    "onion-c": ["layer-wave", "洋蔥層波", "#c78d55", "#f2d2a1"],
    "pepper-a": ["crisp-pop", "爽脆彈跳", "#5e9b42", "#9ccc5a"],
    "strawberry-s": ["heart-spark", "莓果心閃", "#d84d3e", "#ffd76b"],
    "dragonfruit-b": ["cosmic-ring", "星點宇宙", "#e85d98", "#fff0dc"],
    "orange-a": ["citrus-ray", "柑橘日光", "#e97e2e", "#ffc75a"],
    "sweetpotatoleaf-a": ["leaf-dance", "嫩葉舞動", "#397247", "#b8d46a"],
    "broccoli-s": ["forest-pulse", "森林脈衝", "#397247", "#78a94b"],
    "radish-b": ["snow-glow", "雪白柔光", "#d9d3c3", "#fff0dc"],
    "potato-a": ["earth-dust", "暖土微塵", "#c78d55", "#805b2c"],
    "sweetpotato-s": ["honey-swirl", "蜜香漩光", "#8d315f", "#d98a6a"],
    "loofah-b": ["vine-sway", "藤蔓搖曳", "#78a94b", "#b8d46a"],
    "spinach-a": ["leaf-wind", "深綠風痕", "#183427", "#78a94b"],
    "mushroom-a": ["spore-float", "白玉孢子", "#f2d2a1", "#fff0dc"],
    "mango-s": ["summer-glow", "盛夏暖芒", "#f1bd3d", "#e97e2e"],
    "watermelon-b": ["moon-ripple", "月光漣漪", "#397247", "#d84d3e"],
    "passionfruit-a": ["seed-orbit", "籽粒環繞", "#70408f", "#ffd76b"],
    "waxapple-s": ["ruby-flare", "紅寶石耀光", "#d84d3e", "#f4b7ad"],
    "napacabbage-a": ["frost-leaf", "霜葉閃光", "#b8d46a", "#f1efc8"],
    "waterspinach-s": ["stream-wave", "水岸波紋", "#397247", "#a7cc55"],
    "rapeseed-a": ["golden-petal", "金芽花瓣", "#f1bd3d", "#5e9b42"],
    "gailan-a": ["jade-streak", "青翠流線", "#397247", "#78a94b"],
    "celery-b": ["aroma-wave", "清香波動", "#78a94b", "#d9e7a4"],
    "chive-a": ["blade-sway", "翠葉擺動", "#183427", "#5e9b42"],
    "greenbean-a": ["bean-bounce", "豆莢彈動", "#397247", "#78a94b"],
    "snowpea-s": ["pea-spark", "甜豆星點", "#78a94b", "#f1efc8"],
    "bittermelon-b": ["ridge-wave", "瓜紋波動", "#397247", "#78a94b"],
    "wintermelon-a": ["cool-mist", "月白冷霧", "#5e9b42", "#d9e7a4"],
    "bellpepper-s": ["sunset-flare", "夕陽彩焰", "#e97e2e", "#ffd76b"],
    "cauliflower-a": ["cloud-puff", "雲朵浮光", "#d9d3c3", "#fff0dc"],
  };

  const productById = new Map(catalog.products.map((product) => [product.id, product]));
  const productByName = new Map();
  catalog.products.forEach((product) => {
    productByName.set(product.name, product);
    productByName.set(product.cardName, product);
  });

  function getEffect(product) {
    return effects[product?.id] || [product?.category === "fruit" ? "star-twinkle" : "leaf-orbit", "專屬光效", "#78a94b", "#f1bd3d"];
  }

  function setEffect(target, product, { showTag = false } = {}) {
    if (!(target instanceof HTMLElement) || !product) return;
    const [effect, label, color, color2] = getEffect(product);
    target.dataset.cardEffect = effect;
    target.dataset.productId = product.id;
    target.style.setProperty("--effect-color", color);
    target.style.setProperty("--effect-color-2", color2);

    let layer = target.querySelector(":scope > .card-effect-layer");
    if (!layer) {
      layer = document.createElement("span");
      layer.className = "card-effect-layer";
      layer.setAttribute("aria-hidden", "true");
      layer.innerHTML = '<i></i><i></i><i></i><i></i>';
      target.prepend(layer);
    }

    if (showTag && !target.querySelector(":scope > .card-effect-tag")) {
      const tag = document.createElement("span");
      tag.className = "card-effect-tag";
      tag.textContent = label;
      target.append(tag);
    }
  }

  function enhanceProductCard(card) {
    if (!(card instanceof HTMLElement)) return;
    const button = card.querySelector("[data-id]");
    const product = button ? productById.get(button.dataset.id) : null;
    if (!product) return;
    const art = card.querySelector(".product-card__art");
    if (art) setEffect(art, product, { showTag: true });
  }

  function enhanceCollectionCard(card) {
    if (!(card instanceof HTMLElement) || card.classList.contains("is-locked")) return;
    const sprite = card.querySelector('.pixel-sprite[aria-label]');
    const product = sprite ? productByName.get(sprite.getAttribute("aria-label")) : null;
    if (product) setEffect(card, product);
  }

  function enhanceGacha() {
    const machine = document.querySelector("#gacha-machine");
    const art = document.querySelector("#gacha-screen-art");
    const sprite = art?.querySelector('.pixel-sprite[aria-label]');
    const product = sprite ? productByName.get(sprite.getAttribute("aria-label")) : null;
    if (!machine || !product) return;
    const [effect, , color, color2] = getEffect(product);
    machine.dataset.revealEffect = effect;
    machine.style.setProperty("--effect-color", color);
    machine.style.setProperty("--effect-color-2", color2);
  }

  function enhanceAll(root = document) {
    root.querySelectorAll?.(".product-card").forEach(enhanceProductCard);
    root.querySelectorAll?.(".collection-card").forEach(enhanceCollectionCard);
    enhanceGacha();
  }

  enhanceAll();

  const observer = new MutationObserver((mutations) => {
    let changed = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length || mutation.type === "childList") {
        changed = true;
        break;
      }
    }
    if (changed) requestAnimationFrame(() => enhanceAll());
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
