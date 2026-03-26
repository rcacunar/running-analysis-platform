import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createRoadmapSchema } from "@/lib/roadmap";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createRoadmapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Roadmap inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const { session_ids, ...roadmapPayload } = parsed.data;
  const { data: roadmap, error } = await admin
    .from("training_roadmaps")
    .insert({ ...roadmapPayload, user_id: user.id })
    .select("*")
    .single();

  if (error || !roadmap) {
    return NextResponse.json({ error: error?.message ?? "No pude crear el roadmap" }, { status: 400 });
  }

  if (session_ids.length) {
    const { data: ownedSessions, error: sessionsError } = await admin
      .from("sessions")
      .select("id")
      .eq("user_id", user.id)
      .in("id", session_ids);

    if (sessionsError) {
      return NextResponse.json({ error: sessionsError.message }, { status: 400 });
    }

    const ownedIds = new Set((ownedSessions ?? []).map((row) => row.id));
    const rows = session_ids
      .filter((sessionId) => ownedIds.has(sessionId))
      .map((sessionId, index) => ({
        roadmap_id: roadmap.id,
        session_id: sessionId,
        position: index + 1
      }));

    if (rows.length) {
      const { error: linkError } = await admin.from("roadmap_sessions").insert(rows);
      if (linkError) {
        return NextResponse.json({ error: linkError.message }, { status: 400 });
      }
    }
  }

  return NextResponse.json({ roadmap });
}
