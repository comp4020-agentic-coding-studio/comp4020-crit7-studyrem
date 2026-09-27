import type { APIRoute } from "astro";
import { bus } from "../../../lib/events";
import { parseSlotValue, placeCourse } from "../../../lib/unfold";

// Adding a course pins it at the chosen slot and triggers auto-unfold: any
// missing prerequisite chain is back-filled into the nearest earlier
// semester it's offered in (see src/lib/unfold.ts).
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const courseId = Number(form.get("courseId"));
  const slot = parseSlotValue(String(form.get("slot") ?? ""));
  if (courseId && slot) {
    placeCourse(courseId, slot.year, slot.semester);
    bus.emit("planChanged");
  }
  return redirect("/", 303);
};
