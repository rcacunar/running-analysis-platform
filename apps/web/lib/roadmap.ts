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

function nullableInteger(min: number, max: number) {
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
      return Number.isInteger(numeric) ? numeric : value;
    }
    return value;
  }, z.number().int().min(min).max(max).nullable());
}

export const createRoadmapSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: nullableString(1000),
  target_training_count: nullableInteger(1, 200),
  session_ids: z.array(z.string().uuid()).max(200).default([])
});

export const updateRoadmapSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: nullableString(1000),
  target_training_count: nullableInteger(1, 200)
});

export const roadmapSessionSchema = z.object({
  session_id: z.string().uuid()
});

export function formatCapturedAt(value: string | null | undefined) {
  if (!value) {
    return "Sin fecha fuente";
  }
  return value.replace("T", " ").slice(0, 16);
}
