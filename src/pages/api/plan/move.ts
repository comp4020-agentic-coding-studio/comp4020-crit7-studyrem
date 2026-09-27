import type { APIRoute } from "astro";
import { bus } from "../../../lib/events";
import { moveCourse, parseSlotValue } from "../../../lib/unfold";

// Pinning or moving a course to a slot the user picked: it becomes a
// "pinned" root, safe from garbage collection, and everything else
// re-unfolds around it.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const courseId = Number(form.get("courseId"));
  const slot = parseSlotValue(String(form.get("slot") ?? ""));
  if (courseId && slot) {
    moveCourse(courseId, slot.year, slot.semester);
    bus.emit("planChanged");
  }
  return redirect("/", 303);
};
