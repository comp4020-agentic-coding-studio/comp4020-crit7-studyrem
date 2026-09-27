import { describe, expect, inject, it } from "vitest";

// Mechanical proxy for "the real seed data is actually wired end to end":
// every seeded course code should show up on the requirements page.
const baseUrl = inject("baseUrl");

const SEEDED_CODES = [
  "COMP1100",
  "COMP1130",
  "COMP1110",
  "COMP1140",
  "COMP2100",
  "COMP2300",
  "COMP2120",
  "COMP3310",
  "COMP3600",
];

describe("course requirements page", () => {
  it("lists every seeded course", async () => {
    const html = await (await fetch(new URL("/courses/", baseUrl))).text();
    for (const code of SEEDED_CODES) {
      expect(html).toContain(code);
    }
  });

  it("shows COMP2100's requirement as an OR of its alternative starts", async () => {
    const html = await (await fetch(new URL("/courses/", baseUrl))).text();
    expect(html).toMatch(/COMP1110 or COMP1140/);
  });
});
