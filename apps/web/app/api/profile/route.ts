import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profilePayloadSchema } from "@/lib/profile";

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = profilePayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Perfil inválido", details: parsed.error.flatten() }, { status: 400 });
  }

  const payload = {
    id: user.id,
    email: user.email ?? null,
    ...parsed.data
  };

  const { data, error } = await admin.from("profiles").upsert(payload).select("*").single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
