import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BUILT_IN_IDS,
  FONTS,
  MAX_START_MINUTES,
  defaultStyles,
  describeStart,
  evaluateStartExpression,
  isHexColor,
  isStartExpression,
  newCustomStyle,
  normalizeStyle,
  normalizeStyles,
  parseStartExpression,
  parseStartMinutes,
  parseStyleName,
  resolveStyle,
  sortStylesForDisplay,
  styleAfter,
  startMinutes,
  styleToCss,
  styleWarnings,
} from "../../public/styles-core.js";

const MINUTE = 60 * 1000;
const SECOND = 1000;
const DURATION = 5; // minutes

const custom = (id, minutes, extra = {}) => ({ ...newCustomStyle(id, minutes), name: id, ...extra });
const resolvedId = (styles, remainingMs, duration = DURATION) => resolveStyle(styles, remainingMs, duration).style?.id ?? null;

describe("defaultStyles", () => {
  const styles = defaultStyles();

  it("has the five built-in styles in order", () => {
    assert.deepEqual(styles.map((s) => s.id), BUILT_IN_IDS);
    assert.deepEqual(styles.map((s) => s.name), ["Inactive", "Starting Soon", "Active", "Overtime", "Wrap it up!"]);
    assert.ok(styles.every((s) => s.builtIn && s.enabled));
  });

  it("starts Starting Soon at duration + 5, Active at the duration, Wrap it up! at 2, and Overtime at -60", () => {
    assert.equal(startMinutes(styles[0], DURATION), null);
    assert.equal(startMinutes(styles[1], DURATION), 10);
    assert.equal(startMinutes(styles[2], DURATION), 5);
    assert.equal(startMinutes(styles[3], DURATION), -60);
    assert.equal(startMinutes(styles[1], 30), 35);
    assert.equal(startMinutes(styles[2], 30), 30);
    assert.equal(startMinutes(styles[3], 30), -60);
    assert.equal(startMinutes(styles[4], DURATION), 2);
    assert.equal(startMinutes(styles[4], 30), 2);
  });

  it("uses the specified looks", () => {
    const [inactive, soon, active, overtime, wrapUp] = styles;
    // Muted grey.
    assert.equal(inactive.background, "#2b2f36");
    // Blue with white handwritten text.
    assert.equal(soon.color, "#ffffff");
    assert.equal(soon.font, "handwritten");
    // Bright green with white bold sans serif.
    assert.equal(active.background, "#12b829");
    assert.equal(active.font, "sans");
    assert.equal(active.weight, 900);
    // Bright red with white Bangers.
    assert.equal(overtime.background, "#e5141b");
    assert.equal(overtime.font, "bangers");
    // Orange-yellow with dark text, which stays readable on it.
    assert.equal(wrapUp.background, "#ffb000");
    assert.equal(wrapUp.color, "#1a1a1a");
  });

  it("returns fresh copies", () => {
    defaultStyles()[0].name = "Changed";
    assert.equal(defaultStyles()[0].name, "Inactive");
  });
});

describe("resolveStyle with the default styles", () => {
  const styles = defaultStyles();
  const cases = [
    ["idle", Infinity, "inactive"],
    ["far from the start", 2 * 60 * MINUTE, "inactive"],
    ["just over duration + 5", 10 * MINUTE + 1, "inactive"],
    ["exactly duration + 5", 10 * MINUTE, "starting-soon"],
    ["waiting, a minute before the start", 6 * MINUTE, "starting-soon"],
    ["just before the timer starts", 5 * MINUTE + 1, "starting-soon"],
    ["the moment the timer starts", 5 * MINUTE, "active"],
    ["counting down", 3 * MINUTE, "active"],
    ["just over two minutes left", 2 * MINUTE + 1, "active"],
    ["two minutes left", 2 * MINUTE, "wrap-it-up"],
    ["the last millisecond", 1, "wrap-it-up"],
    ["zero", 0, "overtime"],
    ["over time", -5 * MINUTE, "overtime"],
    ["an hour over", -60 * MINUTE, "overtime"],
    ["past every style", -61 * MINUTE, "inactive"],
  ];
  for (const [label, remaining, expected] of cases) {
    it(`${label} -> ${expected}`, () => assert.equal(resolvedId(styles, remaining), expected));
  }

  it("reports the span each style covers", () => {
    assert.deepEqual(resolveStyle(styles, Infinity, DURATION), { style: styles[0], from: Infinity, to: 10 * MINUTE });
    assert.deepEqual(resolveStyle(styles, 7 * MINUTE, DURATION), { style: styles[1], from: 10 * MINUTE, to: 5 * MINUTE });
    assert.deepEqual(resolveStyle(styles, 3 * MINUTE, DURATION), { style: styles[2], from: 5 * MINUTE, to: 2 * MINUTE });
    assert.deepEqual(resolveStyle(styles, MINUTE, DURATION), { style: styles[4], from: 2 * MINUTE, to: 0 });
    assert.deepEqual(resolveStyle(styles, -3 * MINUTE, DURATION), { style: styles[3], from: 0, to: -60 * MINUTE });
    assert.deepEqual(resolveStyle(styles, -61 * MINUTE, DURATION), { style: styles[0], from: -60 * MINUTE, to: -Infinity });
  });

  it("finds the style that takes over when each span ends", () => {
    const after = (to) => styleAfter(styles, to, DURATION)?.id;
    assert.equal(after(10 * MINUTE), "starting-soon");
    assert.equal(after(5 * MINUTE), "active");
    assert.equal(after(2 * MINUTE), "wrap-it-up");
    assert.equal(after(0), "overtime");
    assert.equal(after(-60 * MINUTE), "inactive");
  });

  it("steps through styles over time, skipping disabled ones and one starting at zero", () => {
    const late = custom("late", -5);
    const after = (list, to) => styleAfter(list, to, DURATION)?.id;
    assert.equal(after([...styles, late], 0), "late");
    assert.equal(after([...styles, late], -5 * MINUTE), "overtime");
    assert.equal(after([...styles, { ...late, enabled: false }], 0), "overtime");
    assert.equal(after([...styles, custom("zero", 0)], 0), "overtime");
  });

  it("has no style to take over past the last one if the fallback is disabled", () => {
    const noFallback = styles.map((style) => (style.id === "inactive" ? { ...style, enabled: false } : style));
    assert.equal(styleAfter(noFallback, -60 * MINUTE, DURATION), null);
  });

  it("leaves Active showing when the talk is no longer than Wrap it up!'s start", () => {
    assert.equal(resolvedId(styles, 2 * MINUTE, 2), "active");
    assert.equal(resolvedId(styles, MINUTE, 2), "active");
    assert.equal(resolvedId(styles, MINUTE, 1), "active");
    assert.equal(resolvedId(styles, 1.5 * MINUTE, 1.5), "active");
  });

  it("never shows Wrap it up! before a talk shorter than its start", () => {
    for (const duration of [1, 1.5, 2]) {
      for (const remaining of [duration + 0.01, 2, 2.5, duration + 5]) {
        if (remaining > duration) assert.equal(resolvedId(styles, remaining * MINUTE, duration), "starting-soon", `${remaining} of ${duration}`);
      }
      assert.equal(resolvedId(styles, (duration + 5.01) * MINUTE, duration), "inactive");
    }
  });

  it("hands from Starting Soon straight to Active in a short talk", () => {
    assert.deepEqual(
      [resolveStyle(styles, 2 * MINUTE, 1).from, resolveStyle(styles, 2 * MINUTE, 1).to],
      [6 * MINUTE, MINUTE]
    );
    assert.equal(styleAfter(styles, MINUTE, 1).id, "active");
    assert.deepEqual([resolveStyle(styles, MINUTE, 1).from, resolveStyle(styles, MINUTE, 1).to], [MINUTE, 0]);
  });

  it("keeps Wrap it up! at 2:00 in a longer talk", () => {
    assert.equal(resolvedId(styles, 2 * MINUTE + 1, 5), "active");
    assert.equal(resolvedId(styles, 2 * MINUTE, 5), "wrap-it-up");
  });

  describe("a start past the duration", () => {
    const withoutActive = styles.map((style) => (style.id === "active" ? { ...style, enabled: false } : style));

    it("takes over from the first second when it's the closest to zero", () => {
      assert.equal(resolvedId(withoutActive, MINUTE, 1), "wrap-it-up");
      assert.equal(resolvedId(withoutActive, SECOND, 1), "wrap-it-up");
    });

    it("still doesn't show before the talk when it takes over", () => {
      assert.equal(resolvedId(withoutActive, MINUTE + 1, 1), "starting-soon");
      assert.equal(resolvedId(withoutActive, 2 * MINUTE, 1), "starting-soon");
      assert.equal(styleAfter(withoutActive, MINUTE, 1).id, "wrap-it-up");
    });

    it("spans from the talk's start, so effects time from when it really begins", () => {
      const { from, to } = resolveStyle(withoutActive, 30 * SECOND, 1);
      assert.deepEqual([from, to], [MINUTE, 0]);
    });

    it("is passed over when a relative start is closer to zero", () => {
      const list = [...withoutActive, custom("late", 1, { start: { minutes: -1, plusDuration: true } })];
      // Duration 3: "late" starts at 2, tied with Wrap it up! and after it in the list.
      assert.equal(resolvedId(list, MINUTE, 3), "wrap-it-up");
      // Duration 1.5: "late" starts at 0.5, so it's closer once it begins, and Wrap it up! covers until then.
      assert.equal(resolvedId(list, MINUTE, 1.5), "wrap-it-up");
      assert.equal(resolvedId(list, 0.5 * MINUTE, 1.5), "late");
    });

    it("picks the closest to zero when several are past the duration, whatever the list order", () => {
      const far = custom("far", 4);
      const near = custom("near", 3);
      const base = defaultStyles().filter((style) => style.id === "inactive");
      assert.equal(resolvedId([...base, far, near], MINUTE, 1), "near");
      assert.equal(resolvedId([...base, near, far], MINUTE, 1), "near");
    });

    it("loses to a style starting at the duration, whatever the list order", () => {
      const reversed = [...styles].reverse();
      assert.equal(resolvedId(reversed, MINUTE, 1), "active");
    });

    it("uses list order between equal starts", () => {
      const base = defaultStyles().filter((style) => style.id === "inactive");
      const [a, b] = [custom("a", 3), custom("b", 3)];
      assert.equal(resolvedId([...base, a, b], MINUTE, 1), "a");
      assert.equal(resolvedId([...base, b, a], MINUTE, 1), "b");
    });

    it("uses list order when a start equals the duration", () => {
      assert.equal(resolvedId(styles, MINUTE, 2), "active");
      assert.equal(resolvedId([...styles].reverse(), MINUTE, 2), "wrap-it-up");
    });

    it("applies to custom styles and to expressions that aren't the duration plus minutes", () => {
      const list = [...defaultStyles(), custom("fixed", 30)];
      assert.equal(resolvedId(list, 20 * MINUTE), "inactive");
      assert.equal(resolvedId(list, 8 * MINUTE), "starting-soon");
      for (const expression of ["$duration * 2", "$duration / 10 + 2"]) {
        const withExpression = [defaultStyles()[0], custom("x", 1, { start: { expression } })];
        assert.equal(resolvedId(withExpression, 1.5 * MINUTE, 1), "inactive", expression);
        assert.equal(resolvedId(withExpression, MINUTE, 1), "x", expression);
      }
    });
  });

  it("lets the duration plus some minutes show before the start, however it's written", () => {
    const starts = [{ minutes: 25, plusDuration: true }, { expression: "$duration + 25" }, { expression: "25 + duration" }, { expression: "$duration * 1 + 75 / 3" }];
    for (const start of starts) {
      const list = [...defaultStyles(), custom("doors", 1, { start })];
      assert.equal(resolvedId(list, 20 * MINUTE), "doors", JSON.stringify(start));
      assert.equal(resolvedId(list, 31 * MINUTE), "inactive", JSON.stringify(start));
    }
  });

  it("treats a fractional offset from the duration as relative", () => {
    const list = [defaultStyles()[0], custom("x", 1, { start: { expression: "$duration + 1 / 3" } })];
    assert.equal(resolvedId(list, 5.2 * MINUTE), "x");
  });

  it("moves relative starts with the duration", () => {
    assert.equal(resolvedId(styles, 25 * MINUTE, 30), "active");
    assert.equal(resolvedId(styles, 33 * MINUTE, 30), "starting-soon");
    assert.equal(resolvedId(styles, 36 * MINUTE, 30), "inactive");
  });
});

describe("resolveStyle precedence", () => {
  it("lets the start closest to zero win before zero", () => {
    const styles = [...defaultStyles(), custom("last-call", 1)];
    assert.equal(resolvedId(styles, MINUTE + 1), "wrap-it-up");
    assert.equal(resolvedId(styles, MINUTE), "last-call");
    assert.equal(resolvedId(styles, SECOND), "last-call");
    assert.deepEqual(resolveStyle(styles, 30 * SECOND, DURATION).from, MINUTE);
    assert.deepEqual(resolveStyle(styles, 90 * SECOND, DURATION).to, MINUTE);
  });

  it("lets the start closest to zero win over time", () => {
    const styles = [...defaultStyles(), custom("just-over", -2)];
    assert.equal(resolvedId(styles, -MINUTE), "just-over");
    assert.equal(resolvedId(styles, -2 * MINUTE), "just-over");
    assert.equal(resolvedId(styles, -2 * MINUTE - 1), "overtime");
    assert.deepEqual(resolveStyle(styles, -10 * MINUTE, DURATION), {
      style: defaultStyles()[3],
      from: -2 * MINUTE,
      to: -60 * MINUTE,
    });
  });

  it("skips disabled styles", () => {
    const styles = defaultStyles().map((s) => (s.id === "active" ? { ...s, enabled: false } : s));
    // Starting Soon now covers the countdown until Wrap it up!.
    assert.equal(resolvedId(styles, 3 * MINUTE), "starting-soon");
    assert.deepEqual(resolveStyle(styles, 3 * MINUTE, DURATION).to, 2 * MINUTE);
  });

  it("falls back to Inactive where nothing else applies", () => {
    const styles = defaultStyles().map((s) => (s.id === "overtime" ? { ...s, enabled: false } : s));
    assert.equal(resolvedId(styles, -MINUTE), "inactive");
    assert.deepEqual(resolveStyle(styles, -MINUTE, DURATION), { style: styles[0], from: 0, to: -Infinity });
  });

  it("returns no style when nothing applies and Inactive is disabled", () => {
    const styles = defaultStyles().map((s) => ({ ...s, enabled: s.id !== "inactive" }));
    assert.equal(resolvedId(styles, Infinity), null);
    assert.equal(resolvedId(styles, 3 * MINUTE), "active");
    assert.equal(resolvedId([], 3 * MINUTE), null);
    assert.deepEqual(resolveStyle([], 3 * MINUTE, DURATION), { style: null, from: Infinity, to: 0 });
    assert.deepEqual(resolveStyle([], -3 * MINUTE, DURATION), { style: null, from: 0, to: -Infinity });
  });

  it("breaks ties by list order", () => {
    const styles = [custom("first", 2), custom("second", 2)];
    assert.equal(resolvedId(styles, MINUTE), "first");
  });

  it("treats a start of exactly zero as over time", () => {
    const styles = [custom("zero", 0)];
    assert.equal(resolvedId(styles, 0), "zero");
    assert.equal(resolvedId(styles, -SECOND), null);
    assert.equal(resolvedId(styles, SECOND), null);
  });

  it("can start a style relative to the duration past the duration, before a scheduled start", () => {
    const styles = [...defaultStyles(), custom("doors-open", 1, { start: { minutes: 25, plusDuration: true } })];
    assert.equal(resolvedId(styles, 20 * MINUTE), "doors-open");
    assert.equal(resolvedId(styles, 31 * MINUTE), "inactive");
  });
});

describe("styleWarnings", () => {
  const warningFor = (styles, id, duration = DURATION) => styleWarnings(styles, duration).get(id);

  it("has nothing to say about the defaults at a usual duration", () => {
    for (const duration of [2.5, 5, 60]) assert.equal(styleWarnings(defaultStyles(), duration).size, 0, String(duration));
  });

  it("warns that Wrap it up! won't show in a talk no longer than its start", () => {
    assert.match(warningFor(defaultStyles(), "wrap-it-up", 1), /^Won't show: another style is closer/);
    assert.match(warningFor(defaultStyles(), "wrap-it-up", 1.5), /^Won't show: another style is closer/);
    assert.match(warningFor(defaultStyles(), "wrap-it-up", 2), /^Won't show: other styles cover/);
    assert.deepEqual([...styleWarnings(defaultStyles(), 1).keys()], ["wrap-it-up"]);
  });

  it("warns about the style that loses a tie, by list order", () => {
    assert.deepEqual([...styleWarnings([...defaultStyles()].reverse(), 2).keys()], ["active"]);
  });

  it("warns that a style taking over starts with the talk", () => {
    const styles = defaultStyles().map((style) => (style.id === "active" ? { ...style, enabled: false } : style));
    assert.match(warningFor(styles, "wrap-it-up", 1), /^Starts with the talk/);
    assert.equal(styleWarnings(styles, 2).size, 0);
  });

  it("tells a fixed start past the duration how to show before the talk", () => {
    const styles = [...defaultStyles(), custom("doors", 30)];
    assert.match(warningFor(styles, "doors"), /duration plus some minutes/);
    const relative = [...defaultStyles(), custom("doors", 1, { start: { minutes: 25, plusDuration: true } })];
    assert.equal(warningFor(relative, "doors"), undefined);
  });

  it("warns about a start with no value at this duration", () => {
    const styles = [...defaultStyles(), custom("bad", 1, { start: { expression: "1 / ($duration - 5)" } })];
    assert.match(warningFor(styles, "bad"), /no value/);
    assert.equal(warningFor(styles, "bad", 6), undefined);
  });

  it("warns about a style another covers, or the timer never reaches", () => {
    const styles = [...defaultStyles(), custom("twin", 2), custom("too-late", -70)];
    assert.match(warningFor(styles, "twin"), /^Won't show: other styles cover/);
    assert.match(warningFor(styles, "too-late"), /^Won't show: other styles cover/);
  });

  it("ignores disabled styles, and the fallback", () => {
    const styles = defaultStyles().map((style) => (style.id === "wrap-it-up" ? { ...style, enabled: false } : style));
    assert.equal(styleWarnings(styles, 1).size, 0);
    assert.equal(styleWarnings([defaultStyles()[0]], 1).size, 0);
  });
});

describe("normalizeStyle", () => {
  const base = defaultStyles()[2];

  it("keeps valid values", () => {
    const style = normalizeStyle(
      { name: " Go ", enabled: false, start: { minutes: 1.5, plusDuration: false }, background: "#ABCDEF", color: "#000000", font: "mono", weight: 400, sizePercent: 60, shadow: true },
      base
    );
    assert.deepEqual(style, {
      ...base,
      name: "Go",
      enabled: false,
      start: { minutes: 1.5, plusDuration: false },
      background: "#abcdef",
      color: "#000000",
      font: "mono",
      weight: 400,
      sizePercent: 60,
      shadow: true,
    });
  });

  it("replaces invalid values with the base's", () => {
    const style = normalizeStyle(
      { name: "", enabled: "yes", start: { minutes: "x" }, background: "red", color: "#12345", font: "comic", weight: 500, sizePercent: "big", shadow: 1 },
      base
    );
    assert.deepEqual(style, base);
  });

  it("clamps the size", () => {
    assert.equal(normalizeStyle({ sizePercent: 5 }, base).sizePercent, 40);
    assert.equal(normalizeStyle({ sizePercent: 500 }, base).sizePercent, 100);
    assert.equal(normalizeStyle({ sizePercent: 72.4 }, base).sizePercent, 72);
  });

  it("keeps the fallback style without a start", () => {
    const inactive = defaultStyles()[0];
    assert.equal(normalizeStyle({ start: { minutes: 3 } }, inactive).start, null);
  });

  it("never removes a start from a timed style", () => {
    assert.deepEqual(normalizeStyle({ start: null }, base).start, base.start);
    assert.deepEqual(normalizeStyle({ start: "soon" }, base).start, base.start);
  });

  it("rejects non-objects", () => {
    assert.equal(normalizeStyle(null, base), null);
    assert.equal(normalizeStyle("x", base), null);
    assert.equal(normalizeStyle({}, null), null);
  });
});

describe("normalizeStyles", () => {
  it("returns the defaults for missing or invalid input", () => {
    assert.deepEqual(normalizeStyles(undefined), defaultStyles());
    assert.deepEqual(normalizeStyles("nope"), defaultStyles());
    assert.deepEqual(normalizeStyles([]), defaultStyles());
  });

  it("keeps edits to built-ins and keeps them built in", () => {
    const styles = normalizeStyles([{ id: "overtime", name: "Over!", builtIn: false, background: "#000000" }]);
    const overtime = styles.find((s) => s.id === "overtime");
    assert.equal(overtime.name, "Over!");
    assert.equal(overtime.builtIn, true);
    assert.equal(overtime.background, "#000000");
  });

  it("keeps custom styles in their stored order", () => {
    const styles = normalizeStyles([...defaultStyles(), custom("b", 2), custom("a", 1)]);
    assert.deepEqual(styles.map((s) => s.id), [...BUILT_IN_IDS, "b", "a"]);
    assert.equal(styles[5].builtIn, false);
  });

  it("can't make a custom style built in", () => {
    const [style] = normalizeStyles([{ ...custom("sneaky", 2), builtIn: true }]);
    assert.equal(style.builtIn, false);
  });

  it("drops entries without an id, duplicates, and non-objects", () => {
    const styles = normalizeStyles([null, 5, { name: "no id" }, custom("x", 2), custom("x", 3), { id: 7 }]);
    assert.deepEqual(styles.map((s) => s.id), ["x", ...BUILT_IN_IDS]);
    assert.equal(startMinutes(styles[0], DURATION), 2);
  });
});

describe("parseStyleName / parseStartMinutes / isHexColor", () => {
  it("validates names", () => {
    assert.equal(parseStyleName("  Wrap it up "), "Wrap it up");
    assert.equal(parseStyleName("x".repeat(40)), "x".repeat(40));
    for (const value of ["", "   ", "x".repeat(41), null, 3]) assert.equal(parseStyleName(value), null, String(value));
  });

  it("validates starts", () => {
    assert.equal(parseStartMinutes("5"), 5);
    assert.equal(parseStartMinutes(-60), -60);
    assert.equal(parseStartMinutes("0"), 0);
    assert.equal(parseStartMinutes(1.0001), 1);
    assert.equal(parseStartMinutes(MAX_START_MINUTES), MAX_START_MINUTES);
    for (const value of ["", " ", null, undefined, "abc", NaN, Infinity, MAX_START_MINUTES + 1, -MAX_START_MINUTES - 1]) {
      assert.equal(parseStartMinutes(value), null, String(value));
    }
  });

  it("validates colors", () => {
    assert.equal(isHexColor("#a1B2c3"), true);
    for (const value of ["#abc", "a1b2c3", "#a1b2c3d4", "red", null]) assert.equal(isHexColor(value), false, String(value));
  });
});

describe("sortStylesForDisplay", () => {
  it("lists Inactive first, then largest to smallest start", () => {
    const styles = [...defaultStyles(), custom("wrap-up", 1), custom("way-over", -10), custom("doors", 20)];
    assert.deepEqual(sortStylesForDisplay(styles, DURATION).map((s) => s.id), [
      "inactive",
      "doors",
      "starting-soon",
      "active",
      "wrap-it-up",
      "wrap-up",
      "way-over",
      "overtime",
    ]);
  });

  it("re-sorts when the duration moves relative starts", () => {
    const styles = [...defaultStyles(), custom("doors", 20)];
    assert.deepEqual(sortStylesForDisplay(styles, 30).map((s) => s.id), ["inactive", "starting-soon", "active", "doors", "wrap-it-up", "overtime"]);
  });

  it("keeps list order for equal starts and does not mutate the input", () => {
    const styles = [custom("b", 2), custom("a", 2), defaultStyles()[0]];
    const copy = structuredClone(styles);
    assert.deepEqual(sortStylesForDisplay(styles, DURATION).map((s) => s.id), ["inactive", "b", "a"]);
    assert.deepEqual(styles, copy);
  });

  it("keeps list order between several fallback styles", () => {
    const [inactive] = defaultStyles();
    const styles = [custom("a", 2), { ...inactive, id: "x" }, inactive];
    assert.deepEqual(sortStylesForDisplay(styles, DURATION).map((s) => s.id), ["x", "inactive", "a"]);
  });
});

describe("describeStart", () => {
  const [inactive, soon, active, overtime, wrapUp] = defaultStyles();
  it("describes each kind of start", () => {
    assert.equal(describeStart(inactive, DURATION), "Otherwise");
    assert.equal(describeStart(soon, DURATION), "10 min (duration + 5)");
    assert.equal(describeStart(active, DURATION), "5 min (duration)");
    assert.equal(describeStart(overtime, DURATION), "-60 min");
    assert.equal(describeStart(wrapUp, DURATION), "2 min");
    assert.equal(describeStart(custom("x", 1.5), DURATION), "1.5 min");
    assert.equal(describeStart({ ...active, start: { minutes: -2, plusDuration: true } }, 7.5), "5.5 min (duration − 2)");
  });
});

describe("styleToCss", () => {
  it("maps a style to custom properties", () => {
    const css = styleToCss(defaultStyles()[3]);
    assert.equal(css["--style-bg"], "#e5141b");
    assert.equal(css["--style-fg"], "#ffffff");
    assert.equal(css["--style-font"], FONTS.bangers.family);
    assert.equal(css["--style-weight"], "400");
    assert.equal(css["--style-scale"], "1");
    assert.notEqual(css["--style-shadow"], "none");
    assert.equal(styleToCss({ ...defaultStyles()[2], sizePercent: 50 })["--style-scale"], "0.5");
    assert.equal(styleToCss(defaultStyles()[2])["--style-shadow"], "none");
  });
});

describe("start expressions", () => {
  const expr = (id, expression, extra = {}) => ({ ...custom(id, 1), start: { expression }, ...extra });

  it("recognizes text that mentions the duration", () => {
    assert.equal(isStartExpression("$duration / 10"), true);
    assert.equal(isStartExpression("Duration-1"), true);
    assert.equal(isStartExpression("5"), false);
    assert.equal(isStartExpression(null), false);
  });

  it("parses and tidies valid expressions", () => {
    assert.equal(parseStartExpression("  $duration   /  10 "), "$duration / 10");
    for (const value of ["$duration", "duration-5", "($duration - 5) * 2", "-$duration / 4", "$duration*.5", "+$duration"]) {
      assert.equal(typeof parseStartExpression(value), "string", value);
    }
  });

  it("rejects invalid expressions", () => {
    const invalid = ["", "5", "$duration +", "$duration $duration", "($duration", "$duration)", "$durationx", "$time", "alert(1)",
      "$duration ** 2", "$duration % 2", `$duration + ${"1".repeat(60)}`, null, 3];
    for (const value of invalid) assert.equal(parseStartExpression(value), null, String(value));
  });

  it("evaluates with operator precedence, rounded to the second", () => {
    assert.equal(evaluateStartExpression("$duration / 10", 30), 3);
    assert.equal(evaluateStartExpression("$duration - 5", 30), 25);
    assert.equal(evaluateStartExpression("$duration - 2 * 3", 30), 24);
    assert.equal(evaluateStartExpression("($duration - 2) * 3", 30), 84);
    assert.equal(evaluateStartExpression("-$duration / 4", 20), -5);
    assert.equal(evaluateStartExpression("$duration / 7", 1), Math.round((60 / 7)) / 60);
    assert.ok(Number.isNaN(evaluateStartExpression("$duration / ($duration - 5)", 5)));
    assert.ok(Number.isNaN(evaluateStartExpression("nonsense", 5)));
  });

  it("keeps a valid expression when normalizing, and falls back otherwise", () => {
    const base = newCustomStyle("x", 2);
    assert.deepEqual(normalizeStyle({ start: { expression: " $duration/2 " } }, base).start, { expression: "$duration/2" });
    assert.deepEqual(normalizeStyle({ start: { expression: "5" } }, base).start, base.start);
    assert.deepEqual(normalizeStyle({ start: { expression: 5 } }, base).start, base.start);
  });

  it("starts styles relative to the duration", () => {
    const styles = [...defaultStyles(), expr("wrap-up", "$duration / 10")];
    // A 30 minute talk wraps up 3 minutes from the end; a 10 minute talk, 1 minute.
    assert.equal(resolvedId(styles, 3 * MINUTE, 30), "wrap-up");
    assert.equal(resolvedId(styles, 3 * MINUTE + SECOND, 30), "active");
    assert.equal(resolvedId(styles, 1 * MINUTE, 10), "wrap-up");
    assert.equal(resolvedId(styles, 2 * MINUTE + SECOND, 10), "active");
  });

  it("ignores a style whose expression has no value", () => {
    const styles = [...defaultStyles(), expr("broken", "$duration / ($duration - 5)")];
    assert.equal(resolvedId(styles, 3 * MINUTE, 5), "active");
    assert.deepEqual(sortStylesForDisplay(styles, 5).map((s) => s.id).at(-1), "broken");
  });

  it("describes an expression start", () => {
    assert.equal(describeStart(expr("x", "$duration / 10"), 30), "3 min ($duration / 10)");
    assert.equal(describeStart(expr("x", "$duration / ($duration - 5)"), 5), "Undefined ($duration / ($duration - 5))");
  });
});
