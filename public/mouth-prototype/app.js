import {
  POSES,
  EMOTION_NAMES,
  composePose,
  actingPreview,
  mix,
  rehearsal,
  jawPoint,
  TEETH,
  createRenderer,
} from "./rig.js?rev=acting-2";
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
  demo = false,
  demoTime = 0,
  lastEmotion = "none",
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
function stopDemo() {
  demo = false;
  $("demo").textContent = "Demonstrate six emotional expressions";
}
function choose(name) {
  stopDemo();
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
  stopDemo();
  running = false;
  $("rehearse").textContent = "Rehearse three quick openings";
  $("strengthValue").textContent = Math.round($("strength").value * 100) + "%";
  paused = false;
  $("pause").textContent = "Pause motion";
};
$("rehearse").onclick = () => {
  stopDemo();
  running = !running;
  elapsed = 0;
  paused = false;
  $("pause").textContent = "Pause motion";
  $("rehearse").textContent = running
    ? "Stop rehearsal"
    : "Rehearse three quick openings";
  if (!running) choose("closed");
};
$("emotion").onchange = () => {
  stopDemo();
  paused = false;
  $("pause").textContent = "Pause motion";
};
$("affect").oninput = () => {
  stopDemo();
  $("affectValue").textContent = Math.round($("affect").value * 100) + "%";
  paused = false;
};
$("opening").oninput = () => {
  stopDemo();
  $("openingValue").textContent = Math.round($("opening").value * 100) + "%";
  paused = false;
};
$("demo").onclick = () => {
  demo = !demo;
  demoTime = 0;
  running = false;
  paused = false;
  $("rehearse").textContent = "Rehearse three quick openings";
  $("pause").textContent = "Pause motion";
  $("demo").textContent = demo
    ? "Stop emotional demonstration"
    : "Demonstrate six emotional expressions";
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
    const zoom = $("closeup").checked ? 2.6 : 1;
    const focus =
      zoom > 1 ? (412 + jawPoint([450, 497, 64], current.jaw)[1]) / 2 : 500;
    const sx = 450 + (((x - 450) * 900) / 800) * zoom,
      sy = 450 + (((y - focus) * 900) / 800) * zoom;
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
      const emotion = $("emotion").value,
        affect = Number($("affect").value),
        opening = Number($("opening").value);
      if (demo) {
        demoTime += h;
        const cue = actingPreview(demoTime);
        lastEmotion = cue.name;
        lastNote = "closed";
        target = composePose(
          "closed",
          1,
          cue.name,
          cue.weight,
          opening * cue.opening,
        );
      } else if (running) {
        elapsed += h;
        const cue = rehearsal(elapsed);
        lastEmotion = emotion;
        target = composePose(
          cue.name,
          1,
          emotion,
          affect,
          opening * cue.amount,
        );
        lastNote = cue.amount < 0.001 ? "closed" : cue.name;
      } else {
        target = composePose(
          selected,
          Number($("strength").value),
          emotion,
          affect,
          opening,
        );
        lastNote = selected;
        lastEmotion = emotion;
      }
      current = mix(current, target, 1 - Math.exp(-h / 0.032));
    }
  }
  stats = render(current, {
    wire: $("wire").checked,
    cutaway: $("cutaway").checked,
    yaw: Number($("yaw").value),
    zoom: $("closeup").checked ? 2.6 : 1,
  });
  renderCount++;
  labels();
  $("poseLabel").textContent =
    lastEmotion !== "none"
      ? EMOTION_NAMES[lastEmotion] +
        (lastNote !== "closed" ? " + " + names[lastNote] : "")
      : names[lastNote];
  $("motionLabel").textContent = paused
    ? "Motion held"
    : demo
      ? "Emotional acting demonstration"
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
    demo,
    demoTime,
    lastEmotion,
  }),
};
requestAnimationFrame(frame);
