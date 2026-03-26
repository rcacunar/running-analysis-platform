import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { roadmapSessionSchema } from "@/lib/roadmap";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const { data: roadmap } = await admin.from("training_roadmaps").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!roadmap) {
    return NextResponse.json({ error: "Roadmap no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = roadmapSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Sesión inválida", details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: session } = await admin
    .from("sessions")
    .select("id")
    .eq("id", parsed.data.session_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "Sesión no encontrada" }, { status: 404 });
  }

  const { data: lastRow } = await admin
    .from("roadmap_sessions")
    .select("position")
    .eq("roadmap_id", id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await admin.from("roadmap_sessions").upsert({
    roadmap_id: id,
    session_id: parsed.data.session_id,
    position: (lastRow?.position ?? 0) + 1
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
