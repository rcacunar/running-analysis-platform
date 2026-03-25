import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { enqueueAnalysis } from "@/lib/analysis-api";

export const runtime = "nodejs";

async function getOwnedSession(sessionId: string) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) };
  }

  const { data: session, error: sessionError } = await admin
    .from("sessions")
    .select("id, user_id, status")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (sessionError) {
    return { error: NextResponse.json({ error: sessionError.message }, { status: 400 }) };
  }

  if (!session) {
    return { error: NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 }) };
  }

  return { admin, session };
}

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedSession(id);
  if ("error" in owned) {
    return owned.error;
  }

  const { admin, session } = owned;
  if (session.status === "pending" || session.status === "processing") {
    return NextResponse.json({ error: "La sesión ya está en análisis" }, { status: 409 });
  }

  const { data: exportsRows } = await admin
    .from("session_exports")
    .select("bucket, storage_path")
    .eq("session_id", id);

  if (exportsRows?.length) {
    const grouped = exportsRows.reduce<Record<string, string[]>>((acc, row) => {
      const bucket = String(row.bucket);
      acc[bucket] ??= [];
      acc[bucket].push(String(row.storage_path));
      return acc;
    }, {});

    await Promise.all(
      Object.entries(grouped).map(([bucket, paths]) => admin.storage.from(bucket).remove(paths))
    );
  }

  await Promise.all([
    admin.from("session_exports").delete().eq("session_id", id),
    admin.from("session_summaries").delete().eq("session_id", id),
    admin.from("session_sprints").delete().eq("session_id", id),
    admin.from("session_bouts").delete().eq("session_id", id),
    admin.from("session_phases").delete().eq("session_id", id),
    admin.from("session_playback_points").delete().eq("session_id", id),
    admin.from("session_feature_points").delete().eq("session_id", id)
  ]);

  const { error: updateError } = await admin
    .from("sessions")
    .update({
      status: "pending",
      error_message: null,
      analysis_version: null,
      started_at: null,
      finished_at: null
    })
    .eq("id", id)
    .eq("user_id", session.user_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  try {
    await enqueueAnalysis(id);
  } catch (error) {
    await admin
      .from("sessions")
      .update({
        status: "failed",
        error_message: error instanceof Error ? error.message : "Analysis enqueue failed"
      })
      .eq("id", id)
      .eq("user_id", session.user_id);
    return NextResponse.json({ error: "No pude relanzar el análisis" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "pending" });
}
