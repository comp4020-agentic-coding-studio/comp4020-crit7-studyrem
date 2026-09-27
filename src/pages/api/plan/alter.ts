import type { APIRoute } from "astro";
import { bus } from "../../../lib/events";
import { alterPrerequisite } from "../../../lib/unfold";

// Switches an auto-placed prerequisite for one of its OR-alternatives —
// see alterPrerequisite in src/lib/unfold.ts for why this pins the chosen
// alternative rather than just re-labelling the existing entry.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const fromCourseId = Number(form.get("fromCourseId"));
  const toCourseId = Number(form.get("toCourseId"));
  if (!fromCourseId || !toCourseId) return redirect("/?error=missing-fields", 303);

  const applied = alterPrerequisite(fromCourseId, toCourseId);
  if (!applied) return redirect("/?error=alter-failed", 303);

  bus.emit("planChanged");
  return redirect("/", 303);
};
