import { expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET as hospitals } from "@/app/api/hospitals/route";
import { GET as recommendations } from "@/app/api/recommendations/route";
import { POST as estimate } from "@/app/api/estimate/route";
import { getAllReviews } from "@/lib/ratings";
const req = (url: string) => new NextRequest("http://localhost" + url);
it.each(["lat=28", "lng=77", "lat=100&lng=12", "lat=&lng=77"])(
  "rejects a partial or invalid supplied origin: %s",
  async (q) => {
    expect((await hospitals(req("/api/hospitals?" + q))).status).toBe(400);
  },
);
it("prioritises emergency guidance over browsing", async () => {
  const data = await (
    await recommendations(req("/api/recommendations?problem=heart+attack"))
  ).json();
  expect(data).toMatchObject({ call: "112", emergency: true, results: [] });
});
it.each([-1, 91, 1.5, "", null])(
  "rejects rather than silently pricing invalid nights: %s",
  async (stayDays) => {
    const res = await estimate(
      new NextRequest("http://localhost/api/estimate", {
        method: "POST",
        body: JSON.stringify({ treatmentId: "normal-delivery", stayDays }),
      }),
    );
    expect(res.status).toBe(400);
  },
);
it("never initialises a public review store with demo patients", () =>
  expect(getAllReviews().some((r) => r.isDemoSeed)).toBe(false));
