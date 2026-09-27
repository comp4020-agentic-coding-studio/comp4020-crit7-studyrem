import type { APIRoute } from "astro";
import { removeCourse } from "../../../lib/unfold";
import { bus } from "../../../lib/events";

// Removing a course also drops any auto-placed prerequisite that nothing
// else in the plan still needs (see rebuildAutoEntries in src/lib/unfold.ts).
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const entryId = Number(form.get("entryId"));
  if (!entryId) return redirect("/?error=invalid-entry", 303);

  const applied = removeCourse(entryId);
  if (!applied) return redirect("/?error=invalid-entry", 303);

  bus.emit("planChanged");
  return redirect("/", 303);
};
