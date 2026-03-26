import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string; sessionId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id, sessionId } = await params;
  const { data: roadmap } = await admin.from("training_roadmaps").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!roadmap) {
    return NextResponse.json({ error: "Roadmap no encontrado" }, { status: 404 });
  }

  const { error } = await admin.from("roadmap_sessions").delete().eq("roadmap_id", id).eq("session_id", sessionId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
