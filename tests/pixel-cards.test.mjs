import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const expectedNewProducts = [
  "eggplant-a",
  "corn-s",
  "pumpkin-b",
  "onion-c",
  "pepper-a",
  "strawberry-s",
  "dragonfruit-b",
  "orange-a",
];

test("defines sixteen valid 10 by 10 pixel vegetable and fruit sprites", async () => {
  const source = await readFile(new URL("../app/market-data.ts", import.meta.url), "utf8");
  const spriteSection = source.match(/export const SPRITES = \{(?<body>[\s\S]*?)\n\} as const;/)?.groups?.body ?? "";
  const blocks = [...spriteSection.matchAll(/^  (?<name>\w+): \{\r?\n    pixels: \[(?<rows>.*?)\],\r?\n    palette: \{(?<palette>.*?)\},\r?\n  \},/gms)];

  assert.equal(blocks.length, 16);
  for (const block of blocks) {
    const name = block.groups.name;
    const rows = [...block.groups.rows.matchAll(/"(?<row>[.1-4]+)"/g)].map((match) => match.groups.row);
    const paletteKeys = new Set([...block.groups.palette.matchAll(/"(?<key>[1-4])"/g)].map((match) => match.groups.key));
    assert.equal(rows.length, 10, `${name} must have ten rows`);
    for (const row of rows) {
      assert.equal(row.length, 10, `${name} rows must be ten pixels wide`);
      for (const pixel of row.replaceAll(".", "")) {
        assert.ok(paletteKeys.has(pixel), `${name} pixel ${pixel} must exist in its palette`);
      }
    }
  }
});

test("seeds sixteen products and includes the eight new cards", async () => {
  const source = await readFile(new URL("../app/market-data.ts", import.meta.url), "utf8");
  const productSection = source.match(/export const INITIAL_PRODUCTS: Product\[\] = \[(?<body>[\s\S]*?)\n\];/)?.groups?.body ?? "";
  const products = [...productSection.matchAll(/^  \{ id: "(?<id>[^"]+)".*spriteKey: "(?<sprite>\w+)" \},$/gm)]
    .map((match) => ({ id: match.groups.id, sprite: match.groups.sprite }));

  assert.equal(products.length, 16);
  assert.equal(new Set(products.map((product) => product.id)).size, 16);
  for (const productId of expectedNewProducts) {
    assert.ok(products.some((product) => product.id === productId), `missing ${productId}`);
  }
});

test("keeps the GitHub Pages pixel catalog in sync", async () => {
  const [cloudSource, staticSource] = await Promise.all([
    readFile(new URL("../app/market-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../docs/app.js", import.meta.url), "utf8"),
  ]);
  const cloudNames = new Set([...cloudSource.matchAll(/^  (?<name>\w+): \{\r?\n    pixels:/gm)].map((match) => match.groups.name));
  const staticSpriteSection = staticSource.match(/const sprites = \{(?<body>[\s\S]*?)\n  \};\r?\n\r?\n  const products/)?.groups?.body ?? "";
  const staticBlocks = [...staticSpriteSection.matchAll(/^    (?<name>\w+): \{ pixels: \[(?<rows>.*?)\], palette: \{(?<palette>.*?)\} \},$/gm)];
  const staticNames = new Set(staticBlocks.map((match) => match.groups.name));

  assert.equal(staticBlocks.length, 16);
  assert.deepEqual(staticNames, cloudNames);
  for (const block of staticBlocks) {
    const rows = [...block.groups.rows.matchAll(/"(?<row>[.1-4]+)"/g)].map((match) => match.groups.row);
    assert.equal(rows.length, 10);
    assert.ok(rows.every((row) => row.length === 10));
  }

  const staticProducts = [...staticSource.matchAll(/^    \{ id: "(?<id>[^"]+)".*sprite: "(?<sprite>\w+)" \},$/gm)]
    .map((match) => ({ id: match.groups.id, sprite: match.groups.sprite }));
  assert.equal(staticProducts.length, 16);
  assert.ok(staticProducts.every((product) => staticNames.has(product.sprite)));
  for (const productId of expectedNewProducts) {
    assert.ok(staticProducts.some((product) => product.id === productId), `static catalog missing ${productId}`);
  }
});
