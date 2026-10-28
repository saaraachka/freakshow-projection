import { readFile } from "node:fs/promises";
import { simulate, evaluateAnnotations } from "../src/engine.js";
try {
  if (!process.argv[2])
    throw Error("Usage: npm run check-session -- path/to/song.freakshow.json");
  const session = JSON.parse(await readFile(process.argv[2], "utf8"));
  if (
    session.version !== 1 ||
    !session.features?.length ||
    !session.annotations?.length
  )
    throw Error("Export a song session with annotations from Song Lab first.");
  if (
    session.features.some((f) =>
      ["bass", "mid", "high"].some(
        (k) => !Number.isFinite(f[k]) || f[k] < 0 || f[k] > 1,
      ),
    )
  )
    throw Error("Invalid saved features.");
  const frames = simulate(session.features, session.options),
    results = evaluateAnnotations(
      frames.flatMap((f) => f.events),
      session.annotations,
    );
  for (const r of results)
    console.log(
      `${r.pass ? "PASS" : "FAIL"} ${r.time.toFixed(2)}s ${r.kind}: ${r.text || ""}`,
    );
  console.log(
    `${results.filter((r) => r.pass).length}/${results.length} annotations matched`,
  );
  if (results.some((r) => !r.pass)) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
