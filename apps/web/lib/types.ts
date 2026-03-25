export type SessionRow = {
  id: string;
  user_id: string;
  name: string;
  status: string;
  upload_bucket: string;
  upload_path: string;
  raw_zip_name: string | null;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
};

export type SummaryRow = {
  session_id: string;
  peak_speed_kmh: number | null;
  best_3s_speed_kmh: number | null;
  peak_effort_score: number | null;
  best_sprint_launch_peak_accel_mps2: number | null;
  best_sprint_time_to_50pct_peak_s: number | null;
  best_sprint_time_to_90pct_peak_s: number | null;
  best_sprint_plateau_duration_s: number | null;
  best_sprint_decel_duration_s: number | null;
  distance_m: number | null;
  duration_s: number | null;
};
