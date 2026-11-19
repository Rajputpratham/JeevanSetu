// Run against a local, disposable no-key instance. Never submits reviews or opens calls/mail.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: JSON.parse(process.env.CHROME_ARGS || "[]"),
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  reducedMotion: "reduce",
});
const p = await ctx.newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
const go = (path) => p.goto("http://localhost:3000" + path);
const btn = (name) => p.getByRole("button", { name, exact: true });
const id = (x) => p.getByTestId(x);
const cards = p.locator('[id^="hospital-card-"]');
try {
  await go("/");
  await p.locator("#qs-q").fill("AIIMS");
  await p.locator("#qs-q").press("Enter");
  await expect(cards).toHaveCount(2);
  const input = p.locator("#hosp-search");
  for (const query of ["एम्स", "aims"]) {
    await input.fill(query);
    await p.waitForResponse(
      (r) =>
        r.url().includes("/api/hospitals?") &&
        new URL(r.url()).searchParams.get("q") === query,
    );
    await expect(cards).toHaveCount(2);
  }
  await input.fill("No hospital xyz");
  await expect(cards).toHaveCount(0);
  await expect(
    p.locator("main h2").filter({ hasText: "No hospital" }),
  ).toBeVisible();
  await input.fill("AIIMS");
  await expect(cards).toHaveCount(2);
  await p.locator("#f-type").selectOption("private");
  await expect(cards).toHaveCount(0);
  await p.reload();
  await expect(input).toHaveValue("AIIMS");
  await expect(p.locator("#f-type")).toHaveValue("private");
  await p.locator("#filter-panel button").last().click();
  await expect(cards.first()).toBeVisible();
  const aiims = p.locator("#hospital-card-aiims-new-delhi");
  await aiims.locator('button[aria-label^="Save"]').click();
  await go("/hospitals?saved=1");
  await expect(cards).toHaveCount(1);
  await p.reload();
  await expect(cards).toHaveCount(1);
  await cards.first().locator('button[aria-label^="Saved"]').click();
  await expect(p.getByText("No saved hospitals yet")).toBeVisible();
  await go("/hospitals");
  await expect(cards.first()).toBeVisible();
  for (let i = 0; i < 3; i++)
    await cards.nth(i).locator("button").last().click();
  await expect(cards.nth(3).locator("button").last()).toBeDisabled();
  await go("/compare");
  await p.reload();
  assert.equal(
    await p.evaluate(
      () => JSON.parse(localStorage.getItem("jeevansetu-compare")).length,
    ),
    3,
  );
  await id("language-selector-btn").click();
  await id("lang-option-hi").click();
  await expect(p.locator("html")).toHaveAttribute("lang", "hi");
  await expect(btn("प्रस्थान स्थान बदलें")).toBeVisible();
  await p.reload();
  await expect(p.locator("html")).toHaveAttribute("lang", "hi");
  await id("language-selector-btn").click();
  await id("lang-option-ur").click();
  await expect(p.locator("html")).toHaveAttribute("dir", "rtl");
  await id("language-selector-btn").click();
  await id("lang-option-en").click();
  await go("/cost-estimator");
  await p.locator("#treatment").selectOption("normal-delivery");
  await p.getByText(/Room charges \(1 night,/).waitFor();
  const total = () => p.locator("tbody tr").last().innerText();
  const before = await total();
  await p.locator("#stay").fill("2");
  await p.getByText(/Room charges \(2 nights,/).waitFor();
  assert.notEqual(await total(), before);
  await p.emulateMedia({ media: "print" });
  await expect(p.locator("tbody tr").last()).toBeVisible();
  await expect(id("assistant-root")).toBeHidden();
  await p.emulateMedia({ media: "screen" });
  await go("/recommendations");
  await p.locator("main button[type=submit]").click();
  await expect(p.locator("main [role=alert]").first()).toBeVisible();
  await p.locator("#problem").fill("heart attack");
  await expect(p.locator('form a[href="tel:112"]')).toBeVisible();
  await expect(p.locator("main button[type=submit]")).toBeDisabled();
  await go("/contact");
  await p.locator("#c-msg").fill("short");
  await p.locator("main button[type=submit]").click();
  assert.equal(
    await p.locator("#c-msg").evaluate((el) => el.validity.valid),
    false,
  );
  await go("/emergency");
  await expect(id("emergency-call-112-btn")).toHaveAttribute("href", "tel:112");
  await expect(p.getByText(/Built-in directory, not live/)).toBeVisible();
  await go("/hospitals/aiims-new-delhi");
  await expect(
    p.getByText("Live Google rating unavailable", { exact: true }),
  ).toBeVisible();
  assert(
    !/NEXT_PUBLIC_|GEMINI_API_KEY|GOOGLE_PLACES_API_KEY|Community Seed \(/.test(
      await p.locator("main").innerText(),
    ),
  );
  await id("assistant-open-btn").click();
  await id("assistant-input").fill("How do I compare hospitals?");
  await id("assistant-send").click();
  await expect(p.getByText(/Rule-based answer/)).toBeVisible();
  await p.keyboard.press("Escape");
  await expect(id("assistant-open-btn")).toBeFocused();
  await p.route("**/api/assistant", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await id("assistant-open-btn").click();
  await id("assistant-input").fill("Compare hospitals");
  await id("assistant-send").click();
  const retry = p
    .locator('[data-testid="assistant-panel"] button')
    .filter({ hasText: /retry|try again/i });
  await expect(retry).toBeVisible();
  await p.unroute("**/api/assistant");
  await retry.click();
  await expect(p.getByText(/Rule-based answer/)).toHaveCount(2);
  await p.keyboard.press("Escape");
  console.log("Functional journeys passed");
  const checks = [];
  for (const path of [
    "/",
    "/hospitals?q=AIIMS",
    "/hospitals/aiims-new-delhi",
    "/rankings",
    "/recommendations",
    "/cost-estimator",
    "/compare",
    "/hospitals?saved=1",
    "/emergency",
    "/about",
    "/contact",
    "/privacy",
    "/disclaimer",
  ]) {
    await go(path);
    await p.locator("main h1").first().waitFor();
    if(path === "/cost-estimator") await p.locator("tbody tr").first().waitFor();
    await p.waitForTimeout(500);
    let overflow = [];
    for (const width of [320, 390, 768, 1024, 1440]) {
      await p.setViewportSize({ width, height: 960 });
      await p.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      );
      if (
        await p.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        )
      )
        overflow.push(width);
    }
    checks.push({ route: path, overflow });
    if (path === "/") {
      await p.locator("figure img").evaluate((im) => im.decode());
      await p.screenshot({ path: "docs/qa/after.jpg", quality: 82 });
    }
  }
  writeFileSync(
    "docs/qa/layout.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  assert(
    checks.every((c) => !c.overflow.length),
    JSON.stringify(checks),
  );
  assert.deepEqual(errors, []);
  console.log("All 65 viewport checks passed");
} finally {
  await browser.close();
}
