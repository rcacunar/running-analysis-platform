import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateSessionAIReport, isSessionAIEnabled } from "@/lib/session-ai";

export const runtime = "nodejs";

function percentile(values: number[], p: number) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

function finiteValues(rows: any[], key: string) {
  return rows
    .map((row) => row[key])
    .filter((value) => typeof value === "number" && Number.isFinite(value));
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSessionAIEnabled()) {
    return NextResponse.json({ error: "OPENAI_API_KEY no está configurada" }, { status: 503 });
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const [{ data: session }, { data: summary }, { data: sprints }, { data: phases }, { data: featurePoints }, { data: profile }] =
    await Promise.all([
      admin
        .from("sessions")
        .select("id,name,user_id,status,intended_activity,added_load_kg,session_notes,captured_at_local")
        .eq("id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      admin.from("session_summaries").select("*").eq("session_id", id).maybeSingle(),
      admin.from("session_sprints").select("*").eq("session_id", id).order("t_start_s"),
      admin.from("session_phases").select("*").eq("session_id", id).order("t_start_s"),
      admin
        .from("session_feature_points")
        .select(
          "t_center,speed_kmh,effort_score,effort_raw,cadence_spm,impact_peak_mps2,jerk_rms_mps3,horizontal_rms_mps2,vertical_rms_mps2,gyro_rms_rads,orientation_rate_rads,gps_accel_mps2,gps_quality_score,horizontal_accuracy_m"
        )
        .eq("session_id", id),
      admin
        .from("profiles")
        .select(
          "full_name,age_years,sex,weight_kg,height_cm,resting_heart_rate_bpm,max_heart_rate_bpm,training_level,primary_goal,notes"
        )
        .eq("id", user.id)
        .maybeSingle()
    ]);

  if (!session) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  if (session.status !== "completed" || !summary) {
    return NextResponse.json({ error: "La sesión aún no tiene análisis final disponible" }, { status: 409 });
  }

  const featureStats = {
    points: featurePoints?.length ?? 0,
    speed_mean_kmh: percentile(finiteValues(featurePoints ?? [], "speed_kmh"), 50),
    speed_p95_kmh: percentile(finiteValues(featurePoints ?? [], "speed_kmh"), 95),
    effort_mean: percentile(finiteValues(featurePoints ?? [], "effort_score"), 50),
    effort_p95: percentile(finiteValues(featurePoints ?? [], "effort_score"), 95),
    cadence_p95_spm: percentile(finiteValues(featurePoints ?? [], "cadence_spm"), 95),
    impact_p95_mps2: percentile(finiteValues(featurePoints ?? [], "impact_peak_mps2"), 95),
    jerk_p95_mps3: percentile(finiteValues(featurePoints ?? [], "jerk_rms_mps3"), 95),
    horizontal_rms_mean_mps2: percentile(finiteValues(featurePoints ?? [], "horizontal_rms_mps2"), 50),
    vertical_rms_mean_mps2: percentile(finiteValues(featurePoints ?? [], "vertical_rms_mps2"), 50),
    gyro_p95_rads: percentile(finiteValues(featurePoints ?? [], "gyro_rms_rads"), 95),
    orientation_rate_p95_rads: percentile(finiteValues(featurePoints ?? [], "orientation_rate_rads"), 95),
    gps_quality_mean: percentile(finiteValues(featurePoints ?? [], "gps_quality_score"), 50),
    gps_accuracy_median_m: percentile(finiteValues(featurePoints ?? [], "horizontal_accuracy_m"), 50),
    gps_accel_p95_mps2: percentile(finiteValues(featurePoints ?? [], "gps_accel_mps2"), 95)
  };

  const estimatedBmi =
    profile?.weight_kg && profile?.height_cm ? profile.weight_kg / ((profile.height_cm / 100) * (profile.height_cm / 100)) : null;

  const athleteProfile = profile
    ? {
        full_name: profile.full_name,
        age_years: profile.age_years,
        sex: profile.sex,
        weight_kg: profile.weight_kg,
        height_cm: profile.height_cm,
        estimated_bmi: Number.isFinite(estimatedBmi) ? estimatedBmi : null,
        resting_heart_rate_bpm: profile.resting_heart_rate_bpm,
        max_heart_rate_bpm: profile.max_heart_rate_bpm,
        training_level: profile.training_level,
        primary_goal: profile.primary_goal,
        notes: profile.notes
      }
    : null;

  try {
    const { model, reportText } = await generateSessionAIReport({
      sessionName: session.name,
      athleteProfile,
      sessionContext: {
        intended_activity: session.intended_activity,
        added_load_kg: session.added_load_kg,
        session_notes: session.session_notes,
        captured_at_local: session.captured_at_local
      },
      summary,
      sprints: (sprints ?? []).slice(0, 5),
      phases: (phases ?? []).slice(0, 12),
      featureStats
    });

    await admin.from("session_ai_reports").upsert({
      session_id: id,
      model,
      report_text: reportText
    });

    return NextResponse.json({ session_id: id, model, report_text: reportText });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pude generar el análisis IA" },
      { status: 500 }
    );
  }
}
