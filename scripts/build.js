import { rm, mkdir, cp, copyFile, readFile, writeFile } from "node:fs/promises";
const base = process.env.PAGES_BASE || "/";
if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(base))
  throw new Error("PAGES_BASE must be an absolute directory path ending in /");
await rm("dist", { recursive: true, force: true });
await mkdir("dist");
for (const file of [
  "index.html",
  "styles.css",
  "sw.js",
  "manifest.webmanifest",
  "Vintage Horror Clown Model Sheet.png",
  "clown-head.png",
])
  await copyFile(file, "dist/" + file);
await cp("src", "dist/src", { recursive: true });
await cp("public", "dist/public", { recursive: true });
// Preserve the current self-contained production upload byte for byte. The
// retained modular baseline still needs its original Pages base when restored.
const html = await readFile("dist/index.html", "utf8");
if (html.includes("src/app.js"))
  await writeFile(
    "dist/index.html",
    html.replace(
      "<head>",
      `<head><base href="${base}"><meta name="freakshow-build" content="production">`,
    ),
  );
console.log("Offline production build written to dist/");
