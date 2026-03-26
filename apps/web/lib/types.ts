export type SessionRow = {
  id: string;
  user_id: string;
  name: string;
  status: string;
  upload_bucket: string;
  upload_path: string;
  raw_zip_name: string | null;
  intended_activity: string | null;
  added_load_kg: number | null;
  session_notes: string | null;
  captured_at_local: string | null;
  source_session_label: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
};

export type RoadmapRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  target_training_count: number | null;
  created_at: string;
  updated_at: string;
};

export type RoadmapSessionRow = {
  id: number;
  roadmap_id: string;
  session_id: string;
  position: number;
  added_at: string;
};

export type RoadmapAIReportRow = {
  roadmap_id: string;
  model: string;
  report_text: string;
  created_at: string;
  updated_at: string;
};

export type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  age_years: number | null;
  sex: "male" | "female" | "other" | "prefer_not_to_say" | null;
  weight_kg: number | null;
  height_cm: number | null;
  resting_heart_rate_bpm: number | null;
  max_heart_rate_bpm: number | null;
  training_level: string | null;
  primary_goal: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SummaryRow = {
  session_id: string;
  peak_speed_kmh: number | null;
  best_3s_speed_kmh: number | null;
  peak_effort_score: number | null;
  detected_activity: string | null;
  dominant_activity: string | null;
  intense_walk_time_s: number | null;
  jog_time_s: number | null;
  run_time_s: number | null;
  sprint_time_s: number | null;
  intense_walk_share: number | null;
  jog_share: number | null;
  run_share: number | null;
  sprint_share: number | null;
  best_sprint_launch_peak_accel_mps2: number | null;
  best_sprint_time_to_50pct_peak_s: number | null;
  best_sprint_time_to_90pct_peak_s: number | null;
  best_sprint_plateau_duration_s: number | null;
  best_sprint_decel_duration_s: number | null;
  distance_m: number | null;
  duration_s: number | null;
};
