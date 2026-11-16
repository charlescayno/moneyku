import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(root, f), "utf8");

test("manifest has local icons (192, 512, maskable) that exist on disk", () => {
  const m = JSON.parse(read("manifest.json"));
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"));
  assert.ok(m.icons.some((i) => i.purpose === "maskable"));
  for (const icon of m.icons) {
    assert.ok(!/^https?:/.test(icon.src), "icons must not depend on a remote URL");
    assert.ok(fs.existsSync(path.join(root, icon.src)), `${icon.src} exists`);
  }
  assert.equal(m.display, "standalone");
});

test("every local file in the service worker's precache list exists", () => {
  const sw = read("sw.js");
  const list = [...sw.matchAll(/'(\.\/[^']*)'/g)].map((x) => x[1]).filter((u) => u !== "./");
  assert.ok(list.length > 20);
  for (const u of list) assert.ok(fs.existsSync(path.join(root, u)), `${u} exists`);
});

test("every JS module is precached so the app starts offline", () => {
  const sw = read("sw.js");
  const walk = (dir) =>
    fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(`${dir}/${e.name}`) : e.name.endsWith(".js") ? [`./${dir}/${e.name}`] : []
    );
  for (const f of walk("js")) assert.ok(sw.includes(`'${f}'`), `${f} missing from sw.js urlsToCache`);
});

test("service worker never caches error responses and has an offline page fallback", () => {
  const sw = read("sw.js");
  assert.match(sw, /response\.ok/);
  assert.match(sw, /ignoreSearch/);
  assert.match(sw, /mode === 'navigate'/);
});

test("viewport allows pinch-zoom", () => {
  const html = read("index.html");
  assert.ok(!/user-scalable\s*=\s*no/.test(html));
  assert.ok(!/maximum-scale/.test(html));
});
