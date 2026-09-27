import type { APIRoute } from "astro";
import { bus } from "../../../lib/events";
import { parseSlotValue, setCurrentPosition } from "../../../lib/unfold";

// Moves the "current position" floor — the stand-in for a real transcript
// check — that auto-unfold won't schedule anything earlier than.
export const POST: APIRoute = async ({ request, redirect }) => {
  const form = await request.formData();
  const slot = parseSlotValue(String(form.get("slot") ?? ""));
  if (!slot) return redirect("/?error=invalid-slot", 303);

  setCurrentPosition(slot.year, slot.semester);
  bus.emit("planChanged");
  return redirect("/", 303);
};
