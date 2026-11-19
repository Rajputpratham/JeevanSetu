import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const b = await chromium.launch({
  args: JSON.parse(process.env.CHROME_ARGS || "[]"),
  executablePath: process.env.CHROME_PATH,
});
const p = await b.newPage({ viewport: { width: 1440, height: 960 } });
await p.goto("http://localhost:3000/hospitals?q=AIIMS");
await p.locator("#f-sort").selectOption("name");
await p.locator("#hospital-card-aiims-new-delhi h3 a").click();
await p.waitForURL("**/hospitals/aiims-new-delhi");
await p.goBack();
await p.locator("#hospital-card-aiims-new-delhi").waitFor();
assert.equal(await p.locator("#hosp-search").inputValue(), "AIIMS");
assert.equal(await p.locator("#f-sort").inputValue(), "name");
await p.goForward();
await p.locator("[data-testid=ratings-section]").waitFor();
await p.goto("http://localhost:3000/compare");
for (const q of ["AIIMS New Delhi", "Safdarjung", "Sir Ganga Ram"]) {
  await p.locator("#compare-add").fill(q);
  await p.locator("#compare-suggestions button").first().click();
  assert.equal(await p.locator("#compare-add").inputValue(), "");
}
await p.locator("#compare-add").fill("AIIMS New Delhi");
assert.equal(await p.locator("#compare-suggestions button").count(), 0);
await p.locator("#compare-add").fill("Max");
await p.locator("#compare-suggestions button").first().click();
await p.locator("main [role=alert]").waitFor();
await p.emulateMedia({ media: "print" });
console.log(
  "Print grid",
  await p
    .locator(".comparison-sheet")
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns),
);
console.log("back, forward, compare add/duplicate/fourth/print checked");
await b.close();
