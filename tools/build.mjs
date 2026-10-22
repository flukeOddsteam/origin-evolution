// Build a static website into dist/:
//   dist/index.html, game.js, styles.css, three.min.js  — upload the folder to any static host
//   dist/origin-single.html                               — everything in one file, opens by double-click
// Usage: npm install && npm run build
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const read = (p) => readFileSync(join(root, p), "utf8");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const result = await build({
  entryPoints: [join(root, "src/main.js")], bundle: true, format: "esm", minify: true,
  target: ["es2020"], write: false, legalComments: "none",
});
const game = result.outputFiles[0].text;
const css = read("src/styles.css");
const three = read("vendor/three.min.js");
const html = read("index.html");

const CDN_THREE = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>';
const CSS_LINK = '<link rel="stylesheet" href="src/styles.css">';
const MAIN = '<script type="module" src="src/main.js"></script>';
for (const tag of [CDN_THREE, CSS_LINK, MAIN]) if (!html.includes(tag)) throw new Error("index.html is missing: " + tag);

// multi-file site
writeFileSync(join(dist, "game.js"), game);
writeFileSync(join(dist, "styles.css"), css);
copyFileSync(join(root, "vendor/three.min.js"), join(dist, "three.min.js"));
writeFileSync(join(dist, "index.html"), html
  .replace(CDN_THREE, '<script src="three.min.js"></script>')
  .replace(CSS_LINK, '<link rel="stylesheet" href="styles.css">')
  .replace(MAIN, '<script type="module" src="game.js"></script>'));
writeFileSync(join(dist, ".nojekyll"), "");

// single self-contained file (inline scripts must not contain a closing script tag)
const safe = (js) => js.replace(/<\/script/gi, "<\\/script");
writeFileSync(join(dist, "origin-single.html"), html
  .replace(CDN_THREE, () => `<script>${safe(three)}</script>`)
  .replace(CSS_LINK, () => `<style>${css}</style>`)
  .replace(MAIN, () => `<script type="module">${safe(game)}</script>`));

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + " KB";
console.log(`dist/ ready — game.js ${kb(game)}, single file ${kb(readFileSync(join(dist, "origin-single.html"), "utf8"))}`);
