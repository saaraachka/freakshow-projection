import { rm, mkdir, cp, copyFile, readFile, writeFile } from "node:fs/promises";
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
await writeFile(
  "dist/index.html",
  (await readFile("dist/index.html", "utf8")).replace(
    "<head>",
    '<head><meta name="freakshow-build" content="production">',
  ),
);
console.log("Offline production build written to dist/");
