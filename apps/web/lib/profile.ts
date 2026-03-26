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

export const profilePayloadSchema = z.object({
  full_name: nullableString(120),
  age_years: nullableInteger(10, 100),
  sex: z.preprocess((value) => {
    if (typeof value !== "string") {
      return value ?? null;
    }
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }, z.enum(["male", "female", "other", "prefer_not_to_say"]).nullable()),
  weight_kg: nullableNumber(20, 300),
  height_cm: nullableNumber(100, 260),
  resting_heart_rate_bpm: nullableInteger(25, 220),
  max_heart_rate_bpm: nullableInteger(60, 260),
  training_level: nullableString(80),
  primary_goal: nullableString(160),
  notes: nullableString(1200)
});

export type ProfilePayload = z.infer<typeof profilePayloadSchema>;

export function estimateBmi(weightKg: number | null | undefined, heightCm: number | null | undefined) {
  if (!weightKg || !heightCm) {
    return null;
  }
  const heightM = heightCm / 100;
  if (!Number.isFinite(heightM) || heightM <= 0) {
    return null;
  }
  return weightKg / (heightM * heightM);
}
