import {
  POSES,
  mix,
  rehearsal,
  jawPoint,
  TEETH,
  createRenderer,
} from "./rig.js";
const $ = (id) => document.getElementById(id),
  canvas = $("anatomy");
let render;
try {
  render = createRenderer(canvas);
} catch (error) {
  $("motionLabel").textContent = error.message;
  throw error;
}
let selected = "closed",
  current = { ...POSES.closed },
  running = false,
  paused = false,
  elapsed = 0,
  last = 0,
  stats = {},
  lastNote = "closed",
  renderCount = 0;
const names = {
  closed: "Closed",
  o: "Rounded O",
  a: "Wide A",
  e: "Stretched E",
};
function choose(name) {
  selected = name;
  running = false;
  paused = false;
  $("rehearse").textContent = "Rehearse three quick openings";
  $("pause").textContent = "Pause motion";
  $("strength").value = "1";
  $("strengthValue").textContent = "100%";
  for (const b of document.querySelectorAll("[data-pose]"))
    b.setAttribute("aria-pressed", String(b.dataset.pose === name));
}
for (const b of document.querySelectorAll("[data-pose]"))
  b.onclick = () => choose(b.dataset.pose);
$("strength").oninput = () => {
  running = false;
  $("rehearse").textContent = "Rehearse three quick openings";
  $("strengthValue").textContent = Math.round($("strength").value * 100) + "%";
  paused = false;
  $("pause").textContent = "Pause motion";
};
$("rehearse").onclick = () => {
  running = !running;
  elapsed = 0;
  paused = false;
  $("pause").textContent = "Pause motion";
  $("rehearse").textContent = running
    ? "Stop rehearsal"
    : "Rehearse three quick openings";
  if (!running) choose("closed");
};
$("pause").onclick = () => {
  paused = !paused;
  $("pause").textContent = paused ? "Resume motion" : "Pause motion";
};
$("yaw").oninput = () => {
  $("yawValue").textContent = $("yaw").value + "°";
};
function labels() {
  if (!$("ids").checked) {
    $("labels").replaceChildren();
    return;
  }
  const yaw = (Number($("yaw").value) * Math.PI) / 180;
  $("labels").innerHTML = TEETH.map((t, i) => {
    const v = t.upper ? t.root : jawPoint(t.root, current.jaw);
    const x = 450 + (v[0] - 450) * Math.cos(yaw) + v[2] * Math.sin(yaw),
      y = v[1];
    const sx = 450 + ((x - 450) * 900) / 800,
      sy = ((y - 100) * 900) / 800;
    const lx = 450 + (sx - 450) * 1.5,
      ly = sy + (t.upper ? -90 : 80) + (i % 2) * 14;
    return `<line x1="${sx}" y1="${sy}" x2="${lx}" y2="${ly}"/><text x="${lx}" y="${ly - 3}" text-anchor="middle">${t.id}</text>`;
  }).join("");
}
function frame(now) {
  requestAnimationFrame(frame);
  if (now - last < 1000 / 45) return;
  const dt = Math.min(0.25, (now - (last || now)) / 1000);
  last = now;
  if (!paused) {
    // Substep the articulation so a slower display does not change closure timing.
    for (let remaining = dt; remaining > 1e-8; ) {
      const h = Math.min(1 / 120, remaining);
      remaining -= h;
      let target;
      if (running) {
        elapsed += h;
        const cue = rehearsal(elapsed);
        target = mix(POSES.closed, POSES[cue.name], cue.amount);
        lastNote = cue.amount < 0.001 ? "closed" : cue.name;
      } else {
        target = mix(
          POSES.closed,
          POSES[selected],
          Number($("strength").value),
        );
        lastNote = selected;
      }
      current = mix(current, target, 1 - Math.exp(-h / 0.032));
    }
  }
  stats = render(current, {
    wire: $("wire").checked,
    cutaway: $("cutaway").checked,
    yaw: Number($("yaw").value),
  });
  renderCount++;
  labels();
  $("poseLabel").textContent = names[lastNote];
  $("motionLabel").textContent = paused
    ? "Motion held"
    : running
      ? "Three quick gestures · O / A / E"
      : "Manual inspection";
  $("stats").textContent =
    stats.triangles.toLocaleString() + " triangles · depth tested";
}
window.mouthStudy = {
  snapshot: () => ({
    selected,
    current: { ...current },
    running,
    paused,
    elapsed,
    lastNote,
    stats,
    renderCount,
  }),
};
requestAnimationFrame(frame);
