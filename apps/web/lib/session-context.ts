import { z } from "zod";

function nullableString(max: number) {
  return z.preprocess((value) => {
    if (typeof value !== "string") {
      return value ?? null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }, z.string().max(max).nullable());
}

function nullableNumber(min: number, max: number) {
  return z.preprocess((value) => {
    if (value == null) {
      return null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : value;
    }
    return value;
  }, z.number().min(min).max(max).nullable());
}

export const sessionContextSchema = z.object({
  intended_activity: nullableString(80),
  added_load_kg: nullableNumber(0, 500),
  session_notes: nullableString(1200)
});

export type SessionContextPayload = z.infer<typeof sessionContextSchema>;
