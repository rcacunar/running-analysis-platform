import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    .select("id, user_id, upload_bucket, upload_path")
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

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owned = await getOwnedSession(id);
  if ("error" in owned) {
    return owned.error;
  }

  const { admin, session } = owned;

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

  await admin.storage.from(session.upload_bucket).remove([session.upload_path]);

  const { error } = await admin.from("sessions").delete().eq("id", id).eq("user_id", session.user_id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
