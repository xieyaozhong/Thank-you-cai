import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

test("ships a self-contained GitHub Pages vegetable stall", async () => {
  const [html, css, script, manifest, socialImage] = await Promise.all([
    readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
    readFile(new URL("../docs/styles.css", import.meta.url), "utf8"),
    readFile(new URL("../docs/app.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/manifest.webmanifest", import.meta.url), "utf8"),
    stat(new URL("../docs/og.png", import.meta.url)),
  ]);

  assert.match(html, /<html[^>]*lang="zh-Hant"/i);
  assert.match(html, /GitHub 展示版/);
  assert.match(html, /這週吃什麼？/);
  assert.match(html, /\.\/styles\.css/);
  assert.match(html, /\.\/app\.js/);
  assert.match(html, /xieyaozhong\.github\.io\/Thank-you-cai/);
  assert.doesNotMatch(html, /<script[^>]+src="(?!\.\/)/i);
  assert.doesNotMatch(html, /<link[^>]+href="(?!\.\/)/i);

  assert.match(css, /--green:\s*#24583a/);
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(script, /localStorage/);
  assert.match(script, /thank-you-cai-github-pages-v1/);
  assert.match(script, /sanitizeStoredOrder/);
  assert.match(script, /escapeHtml\(line\.emoji\)/);
  assert.equal((script.match(/\{ id: "[^"]+"/g) ?? []).length, 8);
  assert.doesNotMatch(script, /fetch\s*\(|\/api\//);

  const parsedManifest = JSON.parse(manifest);
  assert.equal(parsedManifest.start_url, "./");
  assert.equal(parsedManifest.scope, "./");
  assert.ok(socialImage.size > 100_000);
});

test("labels local-only behavior instead of pretending to place cloud orders", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
    readFile(new URL("../docs/app.js", import.meta.url), "utf8"),
  ]);

  assert.match(html, /只保存在這台裝置/);
  assert.match(html, /不會送出真實訂單/);
  assert.match(html, /請勿填寫真實電話或地址/);
  assert.match(html, /正式雲端版/);
  assert.doesNotMatch(html, /name="phone"|name="address"|signin-with-chatgpt/i);
  assert.match(script, /LOCAL ORDER PREVIEW|DEMO-/i);
});
