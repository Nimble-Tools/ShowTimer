import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultStyles, newCustomStyle, resolveStyle, styleTimeline } from "../../public/styles-core.js";

const MINUTE = 60 * 1000;
const DURATION = 5; // minutes

const custom = (id, minutes, extra = {}) => ({ ...newCustomStyle(id, minutes), name: id, ...extra });
const sections = (styles, duration = DURATION) => styleTimeline(styles, duration);
const summary = (styles, duration = DURATION) =>
  sections(styles, duration).map((s) => [s.style?.id ?? null, s.fromMs / MINUTE, s.toMs / MINUTE]);
const without = (styles, ...ids) => styles.map((s) => (ids.includes(s.id) ? { ...s, enabled: false } : s));
// The built-ins with Wrap it up! at a fixed start, as configs saved before it
// became $duration / 10 still have it: the case for starts that ignore the duration.
const fixedWrapStyles = () =>
  defaultStyles().map((s) => (s.id === "wrap-it-up" ? { ...s, start: { minutes: 2, plusDuration: false }, effects: [] } : s));
const fallback = () => defaultStyles().filter((s) => s.id === "inactive");

describe("styleTimeline", () => {
  it("runs the defaults through Wrap it up! at a tenth of the time, fading into Overtime", () => {
    assert.deepEqual(summary(defaultStyles(), 60), [
      ["inactive", Infinity, 65],
      ["starting-soon", 65, 60],
      ["active", 60, 6],
      ["wrap-it-up", 6, 0],
      ["overtime", 0, -60],
    ]);
    const { fade } = sections(defaultStyles(), 60).find((s) => s.style?.id === "wrap-it-up");
    assert.equal(fade.next.id, "overtime");
    assert.equal(fade.startFraction, 0);
    assert.equal(fade.endBackground, fade.next.background);
  });

  it("orders the defaults by time, with Overtime changing at 0 rather than its stored -60", () => {
    assert.deepEqual(summary(fixedWrapStyles()), [
      ["inactive", Infinity, 10],
      ["starting-soon", 10, 5],
      ["active", 5, 2],
      ["wrap-it-up", 2, 0],
      ["overtime", 0, -60],
    ]);
  });

  it("leaves Wrap it up! out of a talk no longer than its start", () => {
    for (const duration of [1, 2]) {
      assert.deepEqual(summary(fixedWrapStyles(), duration), [
        ["inactive", Infinity, duration + 5],
        ["starting-soon", duration + 5, duration],
        ["active", duration, 0],
        ["overtime", 0, -60],
      ]);
    }
  });

  it("starts a style that takes over at the talk's start, not its stored start", () => {
    assert.deepEqual(summary(without(fixedWrapStyles(), "active"), 1), [
      ["inactive", Infinity, 6],
      ["starting-soon", 6, 1],
      ["wrap-it-up", 1, 0],
      ["overtime", 0, -60],
    ]);
  });

  it("agrees with resolveStyle at both ends of every section", () => {
    const styles = [...fixedWrapStyles(), custom("fixed", -5), custom("tenth", 0, { start: { expression: "$duration / 10" } })];
    for (const { style, fromMs, toMs } of sections(styles)) {
      if (Number.isFinite(fromMs)) {
        // Counting down a style applies from its start; over time, from just after it.
        assert.equal(resolveStyle(styles, fromMs > 0 ? fromMs : fromMs - 1, DURATION).style, style);
      }
      // And until just before its end; over time, until its end.
      assert.equal(resolveStyle(styles, fromMs > 0 ? toMs + 1 : toMs, DURATION).style, style);
    }
  });

  it("has no gaps, and ends where the timer stops", () => {
    const list = sections([...fixedWrapStyles(), custom("a", -10), custom("b", 3)]);
    for (let i = 1; i < list.length; i++) assert.equal(list[i].fromMs, list[i - 1].toMs);
    assert.equal(list.at(-1).toMs, -60 * MINUTE);
  });

  it("agrees with resolveStyle throughout, across many configurations", () => {
    let seed = 37;
    const random = (n) => (seed = (seed * 1664525 + 1013904223) >>> 0) % n;
    for (let run = 0; run < 300; run++) {
      const duration = 1 + random(90);
      const styles = fixedWrapStyles().map((s) => ({ ...s, enabled: random(4) > 0 }));
      for (let i = random(6); i > 0; i--) {
        const start = [
          { minutes: random(200) - 100, plusDuration: false },
          { minutes: random(20) - 10, plusDuration: true },
          { expression: "$duration / 2" },
          { expression: "1 / ($duration - 5)" },
        ][random(4)];
        styles.push(custom(`c${i}`, 0, { start, enabled: random(4) > 0 }));
      }
      const list = sections(styles, duration);
      for (let i = 1; i < list.length; i++) assert.equal(list[i].fromMs, list[i - 1].toMs);
      assert.equal(list.at(-1).toMs, -60 * MINUTE);
      for (const { style, fromMs, toMs } of list) {
        const middle = fromMs === Infinity ? toMs + MINUTE : (fromMs + toMs) / 2;
        // A section can't cross zero, except the fallback when nothing else is enabled.
        if (middle !== 0) assert.equal(resolveStyle(styles, middle, duration).style ?? null, style);
      }
    }
  });

  it("moves relative starts with the duration", () => {
    assert.deepEqual(summary(fixedWrapStyles(), 20), [
      ["inactive", Infinity, 25],
      ["starting-soon", 25, 20],
      ["active", 20, 2],
      ["wrap-it-up", 2, 0],
      ["overtime", 0, -60],
    ]);
  });

  it("leaves out disabled styles", () => {
    assert.deepEqual(summary(without(fixedWrapStyles(), "wrap-it-up", "starting-soon")), [
      ["inactive", Infinity, 5],
      ["active", 5, 0],
      ["overtime", 0, -60],
    ]);
  });

  it("places an expression start at its value", () => {
    const styles = [...fixedWrapStyles(), custom("tenth", 0, { start: { expression: "$duration / 10" } })];
    assert.deepEqual(summary(styles).slice(3), [
      ["wrap-it-up", 2, 0.5],
      ["tenth", 0.5, 0],
      ["overtime", 0, -60],
    ]);
  });

  it("ignores an expression with no value at this duration, and shows it at others", () => {
    const styles = [...fixedWrapStyles(), custom("odd", 0, { start: { expression: "1 / ($duration - 5)" } })];
    assert.ok(!sections(styles, 5).some((s) => s.style?.id === "odd"));
    assert.ok(sections(styles, 6).some((s) => s.style?.id === "odd"));
  });

  it("leaves out a style that never shows because another has the same start", () => {
    const styles = [...fallback(), custom("first", 2), custom("second", 2), custom("late", -5), custom("late-too", -5)];
    assert.deepEqual(summary(styles), [
      ["inactive", Infinity, 2],
      ["first", 2, 0],
      ["late", 0, -5],
      ["inactive", -5, -60],
    ]);
  });

  it("leaves out a style that starts exactly at zero, which covers no time", () => {
    const styles = [...fallback(), custom("zero", 0), custom("over", -5)];
    assert.deepEqual(summary(styles), [
      ["inactive", Infinity, 0],
      ["over", 0, -5],
      ["inactive", -5, -60],
    ]);
  });

  it("shows Inactive after the last over-time style only if the timer gets there", () => {
    const early = fixedWrapStyles().map((s) => (s.id === "overtime" ? { ...s, start: { minutes: -5, plusDuration: false } } : s));
    assert.deepEqual(summary(early).slice(-2), [
      ["overtime", 0, -5],
      ["inactive", -5, -60],
    ]);
    assert.equal(sections(fixedWrapStyles()).at(-1).style.id, "overtime");
  });

  it("stops at the end of the timer, whatever an over-time style's start", () => {
    const styles = [...fallback(), custom("over", -30), custom("far", -90), custom("farther", -120)];
    assert.deepEqual(summary(styles), [
      ["inactive", Infinity, 0],
      ["over", 0, -30],
      ["far", -30, -60],
    ]);
  });

  it("shows no style where nothing applies", () => {
    assert.deepEqual(summary(without(fixedWrapStyles(), "inactive", "overtime")), [
      [null, Infinity, 10],
      ["starting-soon", 10, 5],
      ["active", 5, 2],
      ["wrap-it-up", 2, 0],
      [null, 0, -60],
    ]);
  });

  it("is one section with only the fallback, or with nothing enabled", () => {
    assert.deepEqual(summary(fallback()), [["inactive", Infinity, -60]]);
    assert.deepEqual(summary(without(fallback(), "inactive")), [[null, Infinity, -60]]);
    assert.deepEqual(summary([]), [[null, Infinity, -60]]);
  });

  it("cuts the lead-in and long sections short, and widens longer sections less than to scale", () => {
    const list = sections(fixedWrapStyles());
    assert.deepEqual(list.map((s) => s.cut), [true, false, false, false, true]);
    const [, soon, active, wrap, over] = list;
    assert.ok(soon.weight > active.weight && active.weight > wrap.weight);
    assert.equal(wrap.weight, Math.sqrt(2));
    assert.equal(over.weight, Math.sqrt(10));
  });

  it("doesn't cut a section of exactly the limit", () => {
    const [, ten] = sections([...fallback(), custom("ten", 10)], 10);
    assert.equal(ten.cut, false);
    assert.equal(ten.weight, Math.sqrt(10));
  });
});

describe("styleTimeline fades", () => {
  const fade = (startSeconds = 0, enabled = true, id = "f") => ({ id, type: "fade", enabled, startSeconds, durationSeconds: 0 });
  const withEffects = (id, ...effects) => fixedWrapStyles().map((s) => (s.id === id ? { ...s, effects } : s));
  const fadeOf = (styles, id) => sections(styles).find((s) => s.style?.id === id).fade;

  it("has none without an enabled fade", () => {
    assert.equal(fadeOf(withEffects("active"), "active"), null);
    assert.equal(fadeOf(withEffects("active", fade(0, false)), "active"), null);
    // Overtime's default strobe isn't a fade.
    assert.equal(fadeOf(fixedWrapStyles(), "overtime"), null);
  });

  it("blends fully into the next style", () => {
    const { next, startFraction, endBackground } = fadeOf(withEffects("active", fade()), "active");
    assert.equal(next.id, "wrap-it-up");
    assert.equal(startFraction, 0);
    assert.equal(endBackground, next.background);
  });

  it("starts partway along when the fade starts late, using the earliest of several", () => {
    assert.equal(fadeOf(withEffects("active", fade(90)), "active").startFraction, 0.5);
    assert.equal(fadeOf(withEffects("active", fade(90), fade(45, true, "g")), "active").startFraction, 0.25);
  });

  it("ignores an enabled fade that starts after the section ends, and a disabled earlier one", () => {
    assert.equal(fadeOf(withEffects("active", fade(180)), "active"), null);
    assert.equal(fadeOf(withEffects("active", fade(45, false), fade(90, true, "g")), "active").startFraction, 0.5);
  });

  it("has none if no style follows", () => {
    assert.equal(fadeOf([custom("only", -5, { effects: [fade()] })], "only"), null);
  });

  it("reaches only as far as the timer does when it stops first", () => {
    const styles = [...fallback(), custom("far", -120, { background: "#000000", effects: [fade()] })];
    const { next, endBackground } = fadeOf(styles, "far");
    assert.equal(next.id, "inactive");
    // Halfway through two hours when the timer stops: halfway from black to #2b2f36.
    assert.equal(endBackground, "#16181b");
  });

  it("places a late fade along the part of the section the timer reaches", () => {
    const far = (...effects) => [...fallback(), custom("far", -120, { effects })];
    assert.equal(fadeOf(far(fade(1800)), "far").startFraction, 0.5);
    // Starts after the timer stops, though before the style would end.
    assert.equal(fadeOf(far(fade(4000)), "far"), null);
  });
});
