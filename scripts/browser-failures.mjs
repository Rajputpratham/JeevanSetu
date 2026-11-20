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
const card = p.locator("#hospital-card-aiims-new-delhi");
const locate = p.getByRole("button", { name: /^(Use my location|Retry location)$/ }).first();
const consent = p.locator("#finder-location-disclosure");
let osrmRequests = 0;
let manualSearches = 0;
try {
  await p.addInitScript(() => {
    window.SpeechRecognition = undefined;
    window.webkitSpeechRecognition = undefined;
  });
  await p.route("**/table/v1/driving/**", (route) => {
    osrmRequests++;
    const coordinates = new URL(route.request().url()).pathname.split("/").at(-1).split(";");
    const failure = osrmRequests === 1;
    return route.fulfill({
      status: failure ? 429 : 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      json: { code: "Ok", distances: [coordinates.map((_, i) => i ? 4200 : 0)], durations: [coordinates.map((_, i) => i ? 900 : 0)] },
    });
  });
  await p.route("**/api/geocode/finder", (route) => {
    manualSearches++;
    assert.equal(route.request().postDataJSON().query, "Gurugram");
    return route.fulfill({ json: { results: [{ label: "Gurugram, Haryana", lat: 28.4595, lng: 77.0266 }, { label: "Another match", lat: 28.61, lng: 77.21 }] } });
  });
  await go("/hospitals?q=AIIMS");
  await expect(consent).toContainText("sent to OSRM");
  await expect(card.getByText("Enable location to see distance")).toBeVisible();
  assert.equal(osrmRequests, 0);
  for (const [code, text] of [
    [1, /Location blocked/],
    [2, /determine its position/],
    [3, /timed out/],
  ]) {
    await p.evaluate((code) => Object.defineProperty(navigator, "geolocation", {
      configurable: true, value: { getCurrentPosition: (_, fail) => fail({ code }) },
    }), code);
    await locate.click();
    await expect(card.getByTestId("card-distance")).toContainText(text);
    await expect(card.getByRole("button", { name: "Retry location" })).toBeVisible();
  }
  await p.evaluate(() => Object.defineProperty(navigator, "geolocation", {
    configurable: true, value: undefined,
  }));
  await locate.click();
  await expect(card.getByTestId("card-distance")).toContainText(/does not support/);
  await p.getByLabel("Or enter a city or pincode").fill("Gurugram");
  assert.equal(manualSearches, 0);
  await p.getByLabel("Or enter a city or pincode").press("Enter");
  await expect(p.getByText("Multiple matches.", { exact: false })).toBeVisible();
  assert.equal(manualSearches, 1);
  assert.equal(osrmRequests, 0);
  await p.getByRole("button", { name: "Gurugram, Haryana" }).click();
  await expect(card.getByTestId("card-distance")).toHaveText("Calculating…");
  await expect(card.getByTestId("card-distance")).toContainText(/approx\..*straight line/);
  await card.getByRole("button", { name: "Retry route" }).click();
  await expect(card.getByText("4.2 km · 15 min drive")).toBeVisible();
  await expect(card.getByRole("link", { name: "Directions" })).toHaveAttribute("href", /origin=28.4595,77.0266/);
  assert.equal(osrmRequests, 2);
  for (const width of [320, 390, 1440]) {
    await p.setViewportSize({ width, height: 960 });
    await expect(card.getByText("Estimated driving route")).toBeVisible();
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `horizontal overflow at ${width}px`);
  }
  await p.reload();
  await expect(card.getByText("4.2 km · 15 min drive")).toBeVisible();
  await p.getByRole("button", { name: "Clear location" }).click();
  await expect(card.getByText("Enable location to see distance")).toBeVisible();
  assert(!p.url().includes("lat="));
  console.log("Finder consent, location errors, route fallback/retry, session restore and 320/390/1440px layouts verified (mocked services)");
  await p.setViewportSize({ width: 390, height: 844 });
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
    "Location failures, manual origin, email draft and constrained recommendations verified",
  );
} finally {
  await browser.close();
}
