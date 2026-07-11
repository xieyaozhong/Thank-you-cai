import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { register } from "node:module";
import test from "node:test";

register("./cloudflare-loader.mjs", import.meta.url);

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html", host: "localhost" },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished菜攤 product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html[^>]*lang="zh-Hant"/i);
  assert.match(html, /謝謝你，菜！/);
  assert.match(html, /這週吃什麼？/);
  assert.match(html, /本週蔬果卡/);
  assert.match(html, /雲端同步/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /Codex is working|Your site is taking shape|react-loading-skeleton|codex-preview/i);
});

test("ships persistent APIs and product metadata instead of starter placeholders", async () => {
  const [page, layout, hosting, packageJson, schema] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /\/api\/market/);
  assert.match(page, /\/api\/orders/);
  assert.match(page, /\/api\/gacha/);
  assert.match(page, /\/api\/menu/);
  assert.match(layout, /謝謝你，菜！/);
  assert.match(layout, /new URL\("\/og\.png", metadataBase\)/);
  assert.match(hosting, /"d1"\s*:\s*"DB"/);
  assert.match(packageJson, /"name"\s*:\s*"thank-you-cai"/);
  assert.match(schema, /products/);
  assert.match(schema, /orders/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton|site-creator-vinext-starter/);
});
