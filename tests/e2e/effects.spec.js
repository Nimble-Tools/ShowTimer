import { test, expect, MINUTE, SECOND } from "./fixtures.js";

const strobing = (timer) => expect(timer.page.locator("body")).toHaveClass(/effect-strobe/);
const notStrobing = (timer) => expect(timer.page.locator("body")).not.toHaveClass(/effect-strobe/);

test.describe("effects", () => {
  test("strobes for 5 seconds when time runs out", async ({ timer }) => {
    await timer.open();
    await timer.setMinutes(1);
    await timer.click(timer.startPause);
    await timer.jump(MINUTE - SECOND);
    await notStrobing(timer);

    await timer.advance(SECOND);
    await expect(timer.display).toHaveText("00:00");
    await strobing(timer);
    // The overlay inverts the colors beneath it.
    const overlay = await timer.page.evaluate(() => getComputedStyle(document.body, "::after").mixBlendMode);
    expect(overlay).toBe("difference");

    await timer.advance(4 * SECOND);
    await strobing(timer);
    await timer.advance(SECOND);
    await expect(timer.display).toHaveText("-00:05");
    await notStrobing(timer);
  });

  test("stops strobing while paused", async ({ timer }) => {
    await timer.open();
    await timer.setMinutes(0.1);
    await timer.click(timer.startPause);
    await timer.advance(7 * SECOND);
    await strobing(timer);
    await timer.click(timer.startPause);
    await timer.expectState("paused");
    await notStrobing(timer);
  });

  test("can be disabled", async ({ timer }) => {
    await timer.open();
    await timer.openConfig();
    await timer.editStyle("Overtime");
    await expect(timer.effectList.locator(".effect-name")).toHaveText(["Strobe for 5 s"]);
    await timer.styleDialog.getByLabel("Enable Strobe").uncheck();
    await timer.styleDone.click();
    await timer.configDuration.fill("0.1");
    await timer.saveConfig();
    expect((await timer.storedConfig()).styles.find((s) => s.id === "overtime").effects[0].enabled).toBe(false);

    await timer.click(timer.startPause);
    await timer.advance(7 * SECOND);
    await expect(timer.display).toHaveText("-00:01");
    await notStrobing(timer);
  });

  test("can be removed, and changed timing is saved", async ({ timer }) => {
    await timer.open();
    await timer.openConfig();
    await timer.editStyle("Overtime");
    await timer.styleDialog.getByLabel("Strobe lasts (seconds, 0 until the style ends)").fill("10");
    await timer.styleDialog.getByLabel("Strobe starts after (seconds)").fill("2");
    await expect(timer.effectList.locator(".effect-name")).toHaveText(["Strobe for 10 s after 2 s"]);
    await timer.styleDone.click();
    await timer.saveConfig();
    expect((await timer.storedConfig()).styles.find((s) => s.id === "overtime").effects).toEqual([
      { id: "strobe", type: "strobe", enabled: true, startSeconds: 2, durationSeconds: 10 },
    ]);

    await timer.openConfig();
    await timer.editStyle("Overtime");
    await timer.styleDialog.getByRole("button", { name: "Remove Strobe" }).click();
    await expect(timer.effectList.locator(".effect-item")).toHaveCount(0);
    await timer.styleDone.click();
    await timer.saveConfig();
    expect((await timer.storedConfig()).styles.find((s) => s.id === "overtime").effects).toEqual([]);
  });

  test("rejects invalid timing", async ({ timer }) => {
    await timer.open();
    await timer.openConfig();
    await timer.editStyle("Overtime");
    const lasts = timer.styleDialog.getByLabel("Strobe lasts (seconds, 0 until the style ends)");
    await lasts.fill("-4");
    await timer.styleDone.click();
    await expect(timer.styleDialog).toBeVisible();
    await expect(timer.styleDialog.locator("#effect-error")).toHaveText("Enter whole seconds from 0 to 86400.");
    await expect(lasts).toHaveAttribute("aria-invalid", "true");
    await expect(lasts).toBeFocused();

    await lasts.fill("3");
    await expect(timer.styleDialog.locator("#effect-error")).toBeHidden();
  });

  test("adds a strobe to another style", async ({ timer }) => {
    await timer.open();
    await timer.openConfig();
    await timer.editStyle("Starting Soon");
    await timer.styleDialog.getByLabel("Effect type").selectOption("strobe");
    await timer.styleDialog.getByRole("button", { name: "Add effect" }).click();
    await expect(timer.styleDialog.getByLabel("Strobe starts after (seconds)")).toBeFocused();
    await timer.styleDone.click();
    await timer.saveConfig();

    // Starting Soon begins 5 minutes before the start.
    await timer.scheduleAt("10:06");
    await notStrobing(timer);
    await timer.jump(MINUTE);
    await strobing(timer);
    await timer.jump(5 * SECOND);
    await notStrobing(timer);
  });

  test("Inactive has no effects", async ({ timer }) => {
    await timer.open();
    await timer.openConfig();
    await timer.editStyle("Inactive");
    await expect(timer.styleDialog.locator("#style-effects-field")).toBeHidden();
  });

  test("fades into the next style", async ({ timer }) => {
    await timer.open();
    await timer.storeConfig({
      durationMinutes: 1,
      styles: [{ id: "active", effects: [{ id: "f", type: "fade", startSeconds: 20 }] }],
    });
    await timer.page.reload();
    await timer.click(timer.startPause);

    // Active is #12b829; Overtime is #e5141b.
    await timer.jump(19 * SECOND);
    expect(await timer.background()).toBe("rgb(18, 184, 41)");
    await timer.jump(21 * SECOND);
    // Halfway through the 40 second fade.
    expect(await timer.background()).toBe("rgb(124, 102, 34)");
    await timer.jump(20 * SECOND);
    await timer.expectStyle("overtime");
    expect(await timer.background()).toBe("rgb(229, 20, 27)");
  });

  test("fades evenly across the whole style, not just at its end", async ({ timer }) => {
    await timer.open();
    await timer.storeConfig({
      durationMinutes: 5,
      styles: [
        { id: "active", effects: [{ id: "f", type: "fade" }] },
        { id: "wrap-it-up", start: { minutes: 1, plusDuration: false } },
      ],
    });
    await timer.page.reload();
    await timer.click(timer.startPause);
    const textColor = () => timer.page.evaluate(() => document.body.style.getPropertyValue("--style-fg"));

    // Active is #12b829 with white text; Wrap it up is #ffb000 with #1a1a1a text.
    await timer.jump(MINUTE);
    expect(await timer.background()).toBe("rgb(77, 182, 31)");
    await timer.jump(MINUTE);
    expect(await timer.background()).toBe("rgb(137, 180, 21)");
    expect(await textColor()).toBe("#8d8d8d");
    await timer.jump(MINUTE);
    expect(await timer.background()).toBe("rgb(196, 178, 10)");
    await timer.jump(MINUTE);
    await timer.expectStyle("wrap-it-up");
    expect(await timer.background()).toBe("rgb(255, 176, 0)");
  });

  test("holds a fade while paused, though a strobe on the same style stops", async ({ timer }) => {
    await timer.open();
    await timer.storeConfig({
      durationMinutes: 5,
      styles: [
        {
          id: "active",
          effects: [
            { id: "f", type: "fade" },
            { id: "s", type: "strobe", durationSeconds: 0 },
          ],
        },
        { id: "wrap-it-up", start: { minutes: 1, plusDuration: false } },
      ],
    });
    await timer.page.reload();
    await timer.click(timer.startPause);
    await timer.jump(2 * MINUTE);
    expect(await timer.background()).toBe("rgb(137, 180, 21)");
    await strobing(timer);

    await timer.click(timer.startPause);
    await timer.expectState("paused");
    await timer.jump(10 * MINUTE);
    expect(await timer.background()).toBe("rgb(137, 180, 21)");
    await notStrobing(timer);

    await timer.click(timer.startPause);
    await timer.expectState("running");
    await timer.jump(MINUTE);
    expect(await timer.background()).toBe("rgb(196, 178, 10)");
    await strobing(timer);
  });

  test("holds a fade while paused over time", async ({ timer }) => {
    await timer.open();
    await timer.storeConfig({
      durationMinutes: 1,
      styles: [{ id: "overtime", start: { minutes: -2, plusDuration: false }, effects: [{ id: "f", type: "fade" }] }],
    });
    await timer.page.reload();
    await timer.click(timer.startPause);
    await timer.jump(2 * MINUTE);
    expect(await timer.background()).toBe("rgb(136, 34, 41)");

    await timer.click(timer.startPause);
    await timer.expectState("paused");
    await timer.jump(MINUTE);
    expect(await timer.background()).toBe("rgb(136, 34, 41)");
  });

  test("keeps a fade finished when the timer stops", async ({ timer }) => {
    await timer.open();
    // Overtime lasts the hour until the timer stops; it is #e5141b, and Inactive is #2b2f36.
    await timer.storeConfig({ durationMinutes: 1, styles: [{ id: "overtime", effects: [{ id: "f", type: "fade" }] }] });
    await timer.page.reload();
    await timer.click(timer.startPause);
    await timer.jump(MINUTE + 30 * MINUTE);
    expect(await timer.background()).toBe("rgb(136, 34, 41)");

    await timer.jump(30 * MINUTE);
    await timer.expectState("stopped");
    expect(await timer.background()).toBe("rgb(43, 47, 54)");
  });

  test("fades a style over time into what follows it", async ({ timer }) => {
    await timer.open();
    await timer.storeConfig({
      durationMinutes: 1,
      styles: [{ id: "overtime", start: { minutes: -2, plusDuration: false }, effects: [{ id: "f", type: "fade" }] }],
    });
    await timer.page.reload();
    await timer.click(timer.startPause);

    // Overtime is #e5141b; past its end, Inactive is #2b2f36.
    await timer.jump(2 * MINUTE);
    await timer.expectStyle("overtime");
    expect(await timer.background()).toBe("rgb(136, 34, 41)");
    // Fully blended as it ends, so nothing jumps when Inactive takes over.
    await timer.jump(MINUTE);
    await timer.expectStyle("overtime");
    expect(await timer.background()).toBe("rgb(43, 47, 54)");
    await timer.jump(SECOND);
    await timer.expectStyle("inactive");
    expect(await timer.background()).toBe("rgb(43, 47, 54)");
  });

  test("adds a fade in the editor", async ({ timer }) => {
    await timer.open();
    await timer.openConfig();
    await timer.editStyle("Active");
    await timer.styleDialog.getByLabel("Effect type").selectOption("fade");
    await timer.styleDialog.getByRole("button", { name: "Add effect" }).click();
    await expect(timer.effectList.locator(".effect-name")).toHaveText(["Fade to next style"]);
    // A fade always runs to the end of the style.
    await expect(timer.styleDialog.getByLabel(/Fade to next style lasts/)).toHaveCount(0);
    await timer.styleDone.click();
    await timer.saveConfig();
    const active = (await timer.storedConfig()).styles.find((s) => s.id === "active");
    expect(active.effects).toEqual([expect.objectContaining({ type: "fade", startSeconds: 0, enabled: true })]);
  });
});
