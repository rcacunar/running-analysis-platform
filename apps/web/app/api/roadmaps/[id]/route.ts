import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateRoadmapSchema } from "@/lib/roadmap";

async function getOwnedRoadmap(id: string, userId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("training_roadmaps").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  return data;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const roadmap = await getOwnedRoadmap(id, user.id);
  if (!roadmap) {
    return NextResponse.json({ error: "Roadmap no encontrado" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateRoadmapSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Roadmap inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await admin
    .from("training_roadmaps")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ roadmap: data });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const roadmap = await getOwnedRoadmap(id, user.id);
  if (!roadmap) {
    return NextResponse.json({ error: "Roadmap no encontrado" }, { status: 404 });
  }

  const { error } = await admin.from("training_roadmaps").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
