// Local test doubles for denied permissions; no real coordinates, calls or messages.
import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: JSON.parse(process.env.CHROME_ARGS || "[]"),
});
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const go = (path) => p.goto("http://localhost:3000" + path);
const id = (x) => p.getByTestId(x);
const label = id("origin-label");
try {
  await p.addInitScript(() => {
    window.SpeechRecognition = undefined;
    window.webkitSpeechRecognition = undefined;
  });
  await go("/hospitals?q=AIIMS");
  await p.locator("main details summary").first().click();
  for (const [code, text] of [
    [1, /denied/i],
    [2, /GPS fix/i],
    [3, /timed out/i],
  ]) {
    await p.evaluate(
      (code) =>
        Object.defineProperty(navigator, "geolocation", {
          configurable: true,
          value: {
            getCurrentPosition: (_, fail) =>
              fail({
                code,
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
              }),
          },
        }),
      code,
    );
    await id("use-precise-location").click();
    await expect(id("location-controls").getByRole("alert")).toContainText(
      text,
    );
    await expect(label).toContainText("Location not set");
  }
  await p.evaluate(() =>
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    }),
  );
  await id("use-precise-location").click();
  await expect(id("location-controls").getByRole("alert")).toContainText(
    /does not support/,
  );
  await p
    .getByRole("button", { name: "Search by PIN Code", exact: true })
    .click();
  await p.locator("#loc-pincode").fill("12");
  await p.locator("#loc-pincode").press("Enter");
  await expect(p.getByText(/Enter a valid 6-digit/)).toBeVisible();
  await p
    .getByRole("button", { name: "Search by Address", exact: true })
    .click();
  await expect(p.getByText(/Enter a valid 6-digit/)).toHaveCount(0);
  await p.locator("#loc-address").fill("Pusa Road");
  await p.locator("#loc-address").press("Enter");
  await p.getByRole("button", { name: /Pusa Road, Karol Bagh/ }).click();
  await expect(label).toContainText(/Pusa Road/, { timeout: 12000 });
  await p.route("**/api/geocode/reverse?**", (r) =>
    r.fulfill({ json: { label: "Test locality" } }),
  );
  await ctx.grantPermissions(["geolocation"]);
  await ctx.setGeolocation({ latitude: 28.61, longitude: 77.21, accuracy: 15 });
  await p.evaluate(() => delete navigator.geolocation);
  await id("use-precise-location").click();
  await expect(id("location-controls")).toContainText("15 m");
  await id("toggle-live-follow").click();
  await expect(id("toggle-live-follow")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await id("toggle-live-follow").click();
  await expect(id("toggle-live-follow")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  assert(!p.url().includes("lat="));
  await go("/contact");
  await p.locator("#c-msg").fill("Local test draft, not for delivery");
  await p.locator("main button[type=submit]").click();
  await expect(
    p.getByRole("status").filter({ hasText: /draft requested, not sent/ }),
  ).toBeVisible();
  await id("assistant-open-btn").click();
  await expect(id("assistant-input")).toBeVisible();
  await expect(id("assistant-mic")).toBeDisabled();
  await p.keyboard.press("Escape");
  await go("/recommendations");
  await p.locator("form select").first().selectOption("Oncology");
  await p
    .getByRole("button", { name: "Maternity & Delivery", exact: true })
    .click();
  await p
    .getByRole("button", { name: "Cashless / Insurance Desk", exact: true })
    .click();
  await p.locator("form button[type=submit]").click();
  await expect(p.locator("main [aria-live]")).toContainText(
    /no listed hospital|listed facility/i,
  );
  // No physical microphone: exercise the browser permission callback explicitly.
  await p.evaluate(() => {
    window.SpeechRecognition = class {
      start() {
        this.onerror?.({ error: "not-allowed" });
        this.onend?.();
      }
      stop() {}
      abort() {}
    };
  });
  await id("assistant-open-btn").click();
  await id("assistant-mic").click();
  await expect(p.getByText(/microphone permission was denied/i)).toBeVisible();
  await p.keyboard.press("Escape");
  await id("assistant-open-btn").click();
  await p.route("**/api/assistant", () => {});
  await id("assistant-input").fill("Compare hospitals");
  await id("assistant-send").click();
  await expect(
    id("assistant-panel").getByRole("button", { name: /retry|try again/i }),
  ).toBeVisible({ timeout: 30000 });
  await p.keyboard.press("Escape");
  await p.unrouteAll();
  // Open every advertised language on an existing route; this only tests switching, not translation quality.
  for (const code of [
    "hi",
    "bn",
    "te",
    "mr",
    "ta",
    "gu",
    "ur",
    "kn",
    "or",
    "ml",
    "en",
  ]) {
    await id("language-selector-btn").click();
    await id("lang-option-" + code).click();
    await expect(p.locator("html")).toHaveAttribute("lang", code);
    assert(p.url().endsWith("/recommendations"));
  }
  await p.setViewportSize({ width: 320, height: 640 });
  await p.locator('button[aria-controls="mobile-nav"]').click();
  await p.locator('#mobile-nav a[href="/cost-estimator"]').click();
  await expect(p.locator("#treatment")).toBeVisible();
  console.log(
    "Location failure/permission, manual origin, live-follow stop, email draft and constrained recommendations verified",
  );
} finally {
  await browser.close();
}
