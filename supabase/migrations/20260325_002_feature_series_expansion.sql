alter table public.session_feature_points
add column if not exists horizontal_rms_mps2 double precision,
add column if not exists vertical_rms_mps2 double precision,
add column if not exists gyro_rms_rads double precision,
add column if not exists orientation_rate_rads double precision,
add column if not exists gps_accel_mps2 double precision,
add column if not exists gps_quality_score double precision,
add column if not exists horizontal_accuracy_m double precision,
add column if not exists effort_raw double precision;
