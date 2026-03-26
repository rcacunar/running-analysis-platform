import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateRoadmapAIReport, isRoadmapAIEnabled } from "@/lib/roadmap-ai";
import { estimateBmi } from "@/lib/profile";

export const runtime = "nodejs";

function formatTimelineDate(value: string | null | undefined, fallback: string | null | undefined) {
  return (value ?? fallback ?? "").replace("T", " ").slice(0, 16) || null;
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isRoadmapAIEnabled()) {
    return NextResponse.json({ error: "OPENAI_API_KEY no está configurada" }, { status: 503 });
  }

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const [{ data: roadmap }, { data: roadmapSessions }, { data: profile }] = await Promise.all([
    admin.from("training_roadmaps").select("*").eq("id", id).eq("user_id", user.id).maybeSingle(),
    admin.from("roadmap_sessions").select("*").eq("roadmap_id", id).order("position").order("added_at"),
    admin
      .from("profiles")
      .select(
        "full_name,age_years,sex,weight_kg,height_cm,resting_heart_rate_bpm,max_heart_rate_bpm,training_level,primary_goal,notes"
      )
      .eq("id", user.id)
      .maybeSingle()
  ]);

  if (!roadmap) {
    return NextResponse.json({ error: "Roadmap no encontrado" }, { status: 404 });
  }

  const sessionIds = (roadmapSessions ?? []).map((row) => row.session_id);
  if (sessionIds.length < 2) {
    return NextResponse.json({ error: "El roadmap necesita al menos dos entrenamientos para comparar" }, { status: 409 });
  }

  const [{ data: sessions }, { data: summaries }] = await Promise.all([
    admin
      .from("sessions")
      .select("id,name,status,captured_at_local,created_at,raw_zip_name")
      .eq("user_id", user.id)
      .in("id", sessionIds),
    admin.from("session_summaries").select("*").in("session_id", sessionIds)
  ]);

  const sessionsById = new Map((sessions ?? []).map((row) => [row.id, row]));
  const summaryById = new Map((summaries ?? []).map((row) => [row.session_id, row]));
  const timeline = sessionIds
    .map((sessionId, index) => {
      const session = sessionsById.get(sessionId);
      const summary = summaryById.get(sessionId);
      if (!session || !summary) {
        return null;
      }
      return {
        training_number: index + 1,
        session_name: session.name,
        captured_at: formatTimelineDate(session.captured_at_local, session.created_at),
        peak_speed_kmh: summary.peak_speed_kmh,
        best_3s_speed_kmh: summary.best_3s_speed_kmh,
        best_5s_speed_kmh: summary.best_5s_speed_kmh,
        launch_peak_accel_mps2: summary.best_sprint_launch_peak_accel_mps2,
        time_to_50pct_peak_s: summary.best_sprint_time_to_50pct_peak_s,
        plateau_duration_s: summary.best_sprint_plateau_duration_s,
        decel_duration_s: summary.best_sprint_decel_duration_s,
        peak_effort_score: summary.peak_effort_score,
        peak_cadence_spm: summary.peak_cadence_spm,
        peak_impact_mps2: summary.peak_impact_mps2,
        gps_quality_pct: summary.gps_quality_pct
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  if (timeline.length < 2) {
    return NextResponse.json({ error: "El roadmap no tiene suficientes sesiones procesadas" }, { status: 409 });
  }

  const first = timeline[0] as any;
  const last = timeline[timeline.length - 1] as any;
  const progression = {
    completed_training_count: timeline.length,
    target_training_count: roadmap.target_training_count,
    completion_ratio:
      roadmap.target_training_count && roadmap.target_training_count > 0
        ? timeline.length / roadmap.target_training_count
        : null,
    first_training_at: first.captured_at,
    last_training_at: last.captured_at,
    deltas: {
      peak_speed_kmh: first.peak_speed_kmh != null && last.peak_speed_kmh != null ? last.peak_speed_kmh - first.peak_speed_kmh : null,
      best_3s_speed_kmh:
        first.best_3s_speed_kmh != null && last.best_3s_speed_kmh != null ? last.best_3s_speed_kmh - first.best_3s_speed_kmh : null,
      launch_peak_accel_mps2:
        first.launch_peak_accel_mps2 != null && last.launch_peak_accel_mps2 != null
          ? last.launch_peak_accel_mps2 - first.launch_peak_accel_mps2
          : null,
      plateau_duration_s:
        first.plateau_duration_s != null && last.plateau_duration_s != null ? last.plateau_duration_s - first.plateau_duration_s : null,
      decel_duration_s:
        first.decel_duration_s != null && last.decel_duration_s != null ? last.decel_duration_s - first.decel_duration_s : null
    }
  };

  const athleteProfile = profile
    ? {
        ...profile,
        estimated_bmi: estimateBmi(profile.weight_kg, profile.height_cm)
      }
    : null;

  try {
    const { model, reportText } = await generateRoadmapAIReport({
      roadmap: {
        name: roadmap.name,
        description: roadmap.description,
        target_training_count: roadmap.target_training_count
      },
      athleteProfile,
      timeline,
      progression
    });

    await admin.from("roadmap_ai_reports").upsert({
      roadmap_id: id,
      model,
      report_text: reportText
    });

    return NextResponse.json({ roadmap_id: id, model, report_text: reportText });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No pude generar el análisis IA del roadmap" },
      { status: 500 }
    );
  }
}
