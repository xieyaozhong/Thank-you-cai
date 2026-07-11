import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cloud gacha uses a locked multi-stage capsule animation", async () => {
  const [page, css] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const phase of ["turning", "shaking", "waiting", "dropping", "revealing", "syncing", "error"]) {
    assert.match(page, new RegExp(`setDrawPhase\\(\"${phase}\"\\)`), `missing cloud ${phase} phase`);
  }
  assert.match(page, /drawLockRef\.current/);
  assert.match(page, /matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  assert.match(page, /data-phase=\{drawPhase\}/);
  assert.match(page, /className="gacha-capsule"/);
  assert.match(css, /\[data-phase="turning"\] \.gacha-knob__handle/);
  assert.match(css, /\[data-phase="dropping"\] \.gacha-capsule/);
  assert.match(css, /gacha-capsule-open-top/);
  assert.match(css, /gacha-card-reveal/);
});

test("GitHub Pages demo mirrors the gacha sequence and cancels stale draws", async () => {
  const [html, script, css] = await Promise.all([
    readFile(new URL("../docs/index.html", import.meta.url), "utf8"),
    readFile(new URL("../docs/app.js", import.meta.url), "utf8"),
    readFile(new URL("../docs/styles.css", import.meta.url), "utf8"),
  ]);

  assert.match(html, /id="gacha-machine"[^>]+data-phase="idle"/);
  assert.match(html, /class="gacha-capsule"/);
  assert.match(html, /class="gacha-knob__handle"/);
  for (const phase of ["turning", "shaking", "waiting", "dropping", "revealing"]) {
    assert.match(script, new RegExp(`setGachaPhase\\(\"${phase}\"\\)`), `missing static ${phase} phase`);
  }
  assert.match(script, /const sequence = \+\+drawSequence/);
  assert.match(script, /drawSequence \+= 1/);
  assert.match(script, /prefers-reduced-motion: reduce/);
  assert.match(css, /@keyframes gacha-capsule-drop/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});
