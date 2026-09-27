import type { APIRoute } from "astro";
import { getPlanEntryByCourseId, getPlanSettings } from "../../../lib/db";
import { bus } from "../../../lib/events";
import { completeCourse } from "../../../lib/unfold";

// The "pretend you have a transcript" escape hatch: marking a course
// completed takes it off the semester grid entirely and satisfies any
// prerequisite check on it regardless of slot — the way to resolve an
// overflow you know isn't real because you've already done the course.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const courseId = Number(form.get("courseId"));
  if (courseId) {
    const existing = getPlanEntryByCourseId(courseId);
    const settings = getPlanSettings();
    const year = existing?.year ?? settings.year;
    const semester = existing?.semester ?? settings.semester;
    completeCourse(courseId, year, semester as "S1" | "S2");
    bus.emit("planChanged");
  }
  return redirect("/", 303);
};
