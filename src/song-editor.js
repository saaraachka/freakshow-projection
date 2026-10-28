const $ = (id) => document.getElementById(id);
export const SOUND_NAMES = {
  kick: "Low thumps / kicks",
  lead: "Tonal notes / melody",
  bright: "Bright ticks / hi-hats",
};
export function validRules(rules) {
  return (
    Array.isArray(rules) &&
    rules.length <= 3 &&
    rules.every((r) => r && typeof r === "object") &&
    new Set(rules.map((r) => r.source)).size === rules.length &&
    rules.every(
      (r) =>
        r &&
        Object.hasOwn(SOUND_NAMES, r.source) &&
        ["ignore", "eye", "mouth"].includes(r.target) &&
        ["smooth", "snap", "spring"].includes(r.reaction) &&
        ["subtle", "dramatic", "extreme"].includes(r.drama),
    )
  );
}
export class SongEditor {
  constructor(canvas, getData, seek, apply) {
    this.canvas = canvas;
    this.data = getData;
    this.seek = seek;
    this.apply = apply;
    this.zoom = 1;
    this.start = 0;
    this.selected = null;
    this.cache = document.createElement("canvas");
    this.cache.width = canvas.width;
    this.cache.height = canvas.height;
    this.dirty = true;
    $("zoom").onchange = () => {
      this.zoom = Number($("zoom").value);
      this.start = Math.max(
        0,
        Math.min(
          this.data().duration - this.span(),
          this.data().time - this.span() / 2,
        ),
      );
      this.invalidate();
      this.draw();
    };
    $("viewOffset").oninput = () => {
      this.start = Number($("viewOffset").value);
      this.invalidate();
    };
    $("advanced").onchange = () => {
      document
        .querySelectorAll("[data-advanced]")
        .forEach((el) => (el.hidden = !$("advanced").checked));
      this.invalidate();
    };
    const timeAt = (e) =>
      this.start +
      ((e.clientX - canvas.getBoundingClientRect().left) /
        canvas.getBoundingClientRect().width) *
        this.span();
    canvas.onpointerdown = (e) => {
      if (!this.data().duration) return;
      this.drag = timeAt(e);
      canvas.setPointerCapture(e.pointerId);
    };
    canvas.onpointerup = (e) => {
      if (this.drag === undefined) return;
      const end = timeAt(e),
        start = this.drag;
      this.drag = undefined;
      this.select(
        (start + end) / 2,
        Math.min(start, end),
        Math.max(start, end),
      );
      this.seek((start + end) / 2);
    };
    $("applySound").onclick = () => {
      if (!this.selected) return;
      apply({
        source: $("soundFamily").value,
        target: $("ignoreSound").checked ? "ignore" : $("whatMoves").value,
        reaction: $("howReacts").value,
        drama: $("howDramatic").value,
      });
      this.invalidate();
      this.select(this.selected.time, this.selected.start, this.selected.end);
    };
    $("ignoreSound").onchange = () => {
      for (const id of ["whatMoves", "howReacts", "howDramatic"])
        $(id).disabled = $("ignoreSound").checked;
    };
    $("resetRules").onclick = () => {
      apply(null);
      if (this.selected)
        this.select(this.selected.time, this.selected.start, this.selected.end);
      this.invalidate();
    };
  }
  span() {
    return this.data().duration / this.zoom || 1;
  }
  invalidate() {
    this.dirty = true;
  }
  select(time, start = time, end = time) {
    const data = this.data();
    time = Math.max(0, Math.min(data.duration, time));
    const candidates = data.frames
      .flatMap((f) => f.detections || [])
      .filter(
        (d) => Math.abs(d.time - time) < Math.max(0.15, (end - start) / 2),
      );
    const selected = candidates.sort(
      (a, b) => Math.abs(a.time - time) - Math.abs(b.time - time),
    )[0];
    const feature =
      data.features[
        Math.min(data.features.length - 1, Math.floor(time * 60))
      ] || {};
    const source =
      selected?.source ||
      (feature.high > feature.mid && feature.high > feature.bass
        ? "bright"
        : feature.bass > feature.mid
          ? "kick"
          : "lead");
    this.selected = { time, start, end };
    $("soundFamily").value = source;
    const rule = data.rules.find((r) => r.source === source);
    $("ignoreSound").checked =
      (rule?.target ||
        (source === "bright"
          ? "ignore"
          : source === "kick"
            ? "eye"
            : "mouth")) === "ignore";
    $("whatMoves").value =
      rule?.target === "ignore"
        ? "mouth"
        : rule?.target || (source === "kick" ? "eye" : "mouth");
    $("howReacts").value = rule?.reaction || "smooth";
    $("howDramatic").value = rule?.drama || "extreme";
    $("ignoreSound").dispatchEvent(new Event("change"));
    $("applySound").disabled = false;
    $("selectedSound").textContent =
      `${time.toFixed(2)}s · ${SOUND_NAMES[source]}${selected ? " · detected" : " · manually marked; no nearby onset"}`;
  }
  draw() {
    const data = this.data(),
      { frames, pcm, duration, notes, time } = data,
      c = this.canvas.getContext("2d"),
      w = this.canvas.width,
      h = this.canvas.height,
      advanced = $("advanced").checked,
      rows = advanced ? 5 : 3,
      row = h / rows,
      span = this.span(),
      x = (t) => ((t - this.start) / span) * w;
    if (time < this.start || time > this.start + span) {
      if (data.playing) {
        this.start = Math.max(0, Math.min(duration - span, time));
        this.dirty = true;
      }
    }
    $("viewOffset").max = Math.max(0, duration - span);
    $("viewOffset").value = this.start;
    $("viewRange").textContent =
      `${this.start.toFixed(1)}–${Math.min(duration, this.start + span).toFixed(1)}s`;
    if (this.dirty) {
      c.fillStyle = "#17151a";
      c.fillRect(0, 0, w, h);
      for (let i = 1; i < rows; i++) {
        c.strokeStyle = "#38313a";
        c.beginPath();
        c.moveTo(0, i * row);
        c.lineTo(w, i * row);
        c.stroke();
      }
      if (pcm && duration) {
        c.strokeStyle = "#b8a990";
        c.beginPath();
        for (let px = 0; px < w; px++) {
          const a = Math.floor((this.start + (px / w) * span) * 44100),
            b = Math.min(
              pcm.length,
              Math.max(
                a + 1,
                Math.floor((this.start + ((px + 1) / w) * span) * 44100),
              ),
            );
          let peak = 0;
          for (let j = a; j < b; j++) peak = Math.max(peak, Math.abs(pcm[j]));
          c.moveTo(px, row / 2 - peak * (row / 2 - 5));
          c.lineTo(px, row / 2 + peak * (row / 2 - 5));
        }
        c.stroke();
        const trace = (field, lane, color) => {
          c.strokeStyle = color;
          c.beginPath();
          for (let px = 0; px < w; px++) {
            const frame =
              frames[
                Math.min(
                  frames.length - 1,
                  Math.floor((this.start + (px / w) * span) * 60),
                )
              ];
            const value = frame ? field(frame) : 0,
              y = (lane + 1) * row - 6 - Math.min(1, value) * (row - 12);
            if (px) c.lineTo(px, y);
            else c.moveTo(px, y);
          }
          c.stroke();
        };
        if (advanced) {
          trace((f) => f.levels.bass, 1, "#dfbc76");
          trace((f) => f.levels.mid, 2, "#ce7b6f");
        }
        trace((f) => f.eyeAccent, rows - 1, "#dfbc76");
        trace((f) => f.mouthAccent, rows - 1, "#ce7b6f");
        const visible = frames
            .flatMap((f) => f.detections || [])
            .filter((d) => d.time >= this.start && d.time <= this.start + span),
          eventRow = rows - 2;
        for (const d of visible) {
          c.fillStyle = d.ignored
            ? "#77717f"
            : d.kind === "eye"
              ? "#dfbc76"
              : "#ce7b6f";
          c.beginPath();
          c.arc(
            x(d.time),
            eventRow * row +
              (d.source === "kick" ? 0.28 : d.source === "lead" ? 0.55 : 0.8) *
                row,
            4,
            0,
            Math.PI * 2,
          );
          c.fill();
        }
        for (const note of notes) {
          c.strokeStyle = "#b9b1c0";
          c.setLineDash([3, 5]);
          c.beginPath();
          c.moveTo(x(note.time), 0);
          c.lineTo(x(note.time), h);
          c.stroke();
          c.setLineDash([]);
        }
        const list = $("soundEvents");
        list.replaceChildren();
        visible.slice(0, 150).forEach((d) => {
          const b = document.createElement("button");
          b.className = "event-chip " + (d.ignored ? "ignored" : "");
          b.textContent = `${d.time.toFixed(2)}s · ${SOUND_NAMES[d.source].split(" / ")[0]} → ${d.ignored ? "Ignored" : d.kind === "eye" ? "Eyes" : "Mouth"}`;
          b.onclick = () => {
            this.select(d.time);
            this.seek(d.time);
          };
          list.append(b);
        });
        const all = frames.flatMap((f) => f.detections || []);
        $("eventSummary").textContent =
          `${all.length} sounds heard · ${all.filter((d) => !d.ignored).length} animation triggers · ${all.filter((d) => d.ignored).length} ignored. Showing ${Math.min(150, visible.length)} in view.`;
      } else {
        c.fillStyle = "#9d92a1";
        c.font = "18px Arial";
        c.fillText("Choose or drop an MP3/WAV to begin.", 25, 45);
      }
      this.cache.getContext("2d").drawImage(this.canvas, 0, 0);
      this.dirty = false;
    } else c.drawImage(this.cache, 0, 0);
    if (this.selected) {
      c.fillStyle = "#e7c78c22";
      const left = x(this.selected.start),
        right = x(this.selected.end);
      c.fillRect(left, 0, Math.max(3, right - left), h);
    }
    if (duration) {
      c.strokeStyle = "#f5eee4";
      c.beginPath();
      c.moveTo(x(time), 0);
      c.lineTo(x(time), h);
      c.stroke();
    }
    $("activeRules").textContent = data.rules.length
      ? data.rules
          .map(
            (r) =>
              `${SOUND_NAMES[r.source]} → ${r.target === "ignore" ? "Ignore" : r.target === "eye" ? "Eyes" : "Mouth"}`,
          )
          .join(" · ")
      : "Default: bright ticks ignored · kicks → eyes · tonal notes → mouth";
  }
}
