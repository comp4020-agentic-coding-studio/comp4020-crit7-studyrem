import { beforeAll, describe, expect, inject, it } from "vitest";

// Drives the running (built) app over HTTP, like the starter's guestbook
// test did, to prove the plan's core claims hold in THIS repo: a placement
// persists, adding a course auto-unfolds its missing prerequisite chain
// backward, removing it garbage-collects what nothing else needs, and other
// tabs hear about a mutation over the SSE stream.
const baseUrl = inject("baseUrl");

const post = (path: string, body: URLSearchParams) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body,
    redirect: "manual",
  });

async function courseIdFor(code: string): Promise<string> {
  const html = await (await fetch(baseUrl)).text();
  const match = new RegExp(`value="(\\d+)"[^>]*>${code} `).exec(html);
  if (!match) throw new Error(`${code} not found in the add-course picker`);
  return match[1];
}

async function entryIdFor(html: string, code: string): Promise<string> {
  const match = new RegExp(`${code}[\\s\\S]{0,800}?name="entryId" value="(\\d+)"`).exec(html);
  if (!match) throw new Error(`no plan entry (with a remove control) found for ${code}`);
  return match[1];
}

// Once more than one auto-placed entry has an Alter control on the page, the
// first "fromCourseId" in the HTML isn't necessarily the one for the course
// you care about — this anchors the search to that course's own code, the
// same way entryIdFor anchors to "entryId".
function fromCourseIdFor(html: string, code: string): string | undefined {
  return new RegExp(`${code}[\\s\\S]{0,800}?name="fromCourseId" value="(\\d+)"`).exec(html)?.[1];
}

// The course picker keeps listing every *unplanned* course by code, so a
// bare substring check can't tell "removed from the plan" apart from
// "back in the add-a-course dropdown". A course actually placed on the grid
// has its status badge right next to its code; the picker option doesn't.
function isPlanned(html: string, code: string): boolean {
  return new RegExp(`${code}</span> <span class="badge">`).test(html);
}

describe("plan", () => {
  let comp1100Id: string;
  let comp2120Id: string;

  beforeAll(async () => {
    comp1100Id = await courseIdFor("COMP1100");
    comp2120Id = await courseIdFor("COMP2120");
  });

  it("pins a course at the chosen slot and persists it across reload", async () => {
    const res = await post(
      "/api/plan/add",
      new URLSearchParams({ courseId: comp1100Id, slot: "1-S1" }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");

    const html = await (await fetch(baseUrl)).text();
    expect(html).toContain("COMP1100");
    expect(html).toMatch(/COMP1100[\s\S]{0,200}?pinned/);
  });

  it("auto-unfolds a missing prerequisite chain into the nearest earlier semesters", async () => {
    // COMP2120 -> COMP2100 -> (COMP1110 or COMP1140) -> (COMP1100 or COMP1130).
    // COMP1100 is already pinned (previous test), so that branch of the
    // chain is already satisfied and only COMP2100 and COMP1110 should
    // appear as new auto-placed entries.
    const res = await post(
      "/api/plan/add",
      new URLSearchParams({ courseId: comp2120Id, slot: "4-S2" }),
    );
    expect(res.status).toBe(303);

    const html = await (await fetch(baseUrl)).text();
    expect(html).toContain("COMP2120");
    expect(html).toMatch(/COMP2100[\s\S]{0,200}?auto/);
    expect(html).toMatch(/COMP1110[\s\S]{0,200}?auto/);
  });

  it("removing the root garbage-collects the auto-placed chain it needed", async () => {
    const before = await (await fetch(baseUrl)).text();
    const entryId = await entryIdFor(before, "COMP2120");

    const res = await post("/api/plan/remove", new URLSearchParams({ entryId }));
    expect(res.status).toBe(303);

    const after = await (await fetch(baseUrl)).text();
    expect(isPlanned(after, "COMP2120")).toBe(false);
    expect(isPlanned(after, "COMP2100")).toBe(false);
    expect(isPlanned(after, "COMP1110")).toBe(false);
    // COMP1100 was pinned directly, independent of the chain — it survives.
    expect(isPlanned(after, "COMP1100")).toBe(true);
  });

  it("alters an auto-placed prerequisite to its OR-alternative, staying auto", async () => {
    // COMP2100 -> (COMP1110 or COMP1140). COMP1100 is pinned at 1-S1
    // (earlier test), which already satisfies COMP1110's own prerequisite,
    // so adding COMP2100 at 2-S1 only auto-places COMP1110 — that's the
    // entry Alter should offer COMP1140 as an alternative for.
    const comp2100Id = await courseIdFor("COMP2100");
    await post("/api/plan/add", new URLSearchParams({ courseId: comp2100Id, slot: "2-S1" }));

    let html = await (await fetch(baseUrl)).text();
    expect(html).toMatch(/COMP1110[\s\S]{0,200}?auto/);
    const fromCourseId = fromCourseIdFor(html, "COMP1110");
    if (!fromCourseId) throw new Error("no Alter control found for the auto-placed COMP1110");
    const comp1140Id = await courseIdFor("COMP1140");

    const res = await post(
      "/api/plan/alter",
      new URLSearchParams({ fromCourseId, toCourseId: comp1140Id }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");

    html = await (await fetch(baseUrl)).text();
    // Stays an auto entry — it's still an auto-fill choice, just a
    // different one, not something the user pinned as a root. COMP1140 has
    // its own prerequisite (COMP1130, not shared with COMP1110's), so it
    // also auto-unfolds now.
    expect(html).toMatch(/COMP1140[\s\S]{0,200}?auto/);
    expect(html).toMatch(/COMP1130[\s\S]{0,200}?auto/);
    expect(isPlanned(html, "COMP1110")).toBe(false);

    // Alter records a *standing* preference for this alternative set, so it
    // would keep picking COMP1140 in later tests too — alter back to
    // COMP1110 before removing COMP2100, so later tests see the original
    // default and COMP1110 (and COMP1130 behind it) gets garbage-collected
    // with the root (all auto, so no separate removal call is needed).
    const comp1140FromCourseId = fromCourseIdFor(html, "COMP1140");
    if (!comp1140FromCourseId) throw new Error("no Alter control found for the auto-placed COMP1140");
    const comp1110Id = await courseIdFor("COMP1110");
    await post(
      "/api/plan/alter",
      new URLSearchParams({ fromCourseId: comp1140FromCourseId, toCourseId: comp1110Id }),
    );

    html = await (await fetch(baseUrl)).text();
    expect(html).toMatch(/COMP1110[\s\S]{0,200}?auto/);
    expect(isPlanned(html, "COMP1140")).toBe(false);
    expect(isPlanned(html, "COMP1130")).toBe(false);
    const comp2100EntryId = await entryIdFor(html, "COMP2100");
    await post("/api/plan/remove", new URLSearchParams({ entryId: comp2100EntryId }));
  });

  it("rejects altering to a course that isn't actually an alternative", async () => {
    const comp2100Id = await courseIdFor("COMP2100");
    await post("/api/plan/add", new URLSearchParams({ courseId: comp2100Id, slot: "2-S1" }));

    let html = await (await fetch(baseUrl)).text();
    const fromCourseId = fromCourseIdFor(html, "COMP1110");
    if (!fromCourseId) throw new Error("no Alter control found for the auto-placed COMP1110");
    const comp3600Id = await courseIdFor("COMP3600");

    const res = await post(
      "/api/plan/alter",
      new URLSearchParams({ fromCourseId, toCourseId: comp3600Id }),
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/?error=alter-failed");

    // COMP1110 is still the auto-placed choice; nothing changed.
    html = await (await fetch(baseUrl)).text();
    expect(html).toMatch(/COMP1110[\s\S]{0,200}?auto/);

    const entryId = await entryIdFor(html, "COMP2100");
    await post("/api/plan/remove", new URLSearchParams({ entryId }));
  });

  it("broadcasts a plan mutation over the SSE stream", async () => {
    const comp3600Id = await courseIdFor("COMP3600");

    const stream = await fetch(new URL("/api/events", baseUrl));
    expect(stream.headers.get("content-type")).toContain("text/event-stream");
    const reader = stream.body?.getReader();
    if (!reader) throw new Error("no response body");

    await post("/api/plan/add", new URLSearchParams({ courseId: comp3600Id, slot: "3-S2" }));

    const decoder = new TextDecoder();
    let received = "";
    while (!received.includes("data: changed")) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream ended before the event arrived");
      received += decoder.decode(value, { stream: true });
    }
    await reader.cancel();
  }, 10_000);
});
