import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enqueueAnalysis } from "@/lib/analysis-api";
import { getServerEnv } from "@/lib/env";
import { extractSessionCapture } from "@/lib/session-capture";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const env = getServerEnv();
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const name = String(formData.get("name") ?? "").trim();
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el ZIP" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "Solo se aceptan archivos ZIP" }, { status: 400 });
  }

  const sessionId = randomUUID();
  const zipName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const storagePath = `${user.id}/${sessionId}/${zipName}`;
  const uploadBuffer = Buffer.from(await file.arrayBuffer());
  const captureMeta = extractSessionCapture(file.name);

  const { error: insertError } = await admin.from("sessions").insert({
    id: sessionId,
    user_id: user.id,
    name: name || file.name.replace(/\.zip$/i, ""),
    status: "pending",
    upload_bucket: env.SESSION_ZIPS_BUCKET,
    upload_path: storagePath,
    raw_zip_name: file.name,
    captured_at_local: captureMeta.captured_at_local,
    source_session_label: captureMeta.source_session_label
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const { error: uploadError } = await admin.storage
    .from(env.SESSION_ZIPS_BUCKET)
    .upload(storagePath, uploadBuffer, {
      contentType: "application/zip",
      upsert: true
    });

  if (uploadError) {
    await admin.from("sessions").delete().eq("id", sessionId);
    return NextResponse.json({ error: uploadError.message }, { status: 400 });
  }

  try {
    await enqueueAnalysis(sessionId);
  } catch (error) {
    await admin
      .from("sessions")
      .update({ status: "failed", error_message: error instanceof Error ? error.message : "Analysis enqueue failed" })
      .eq("id", sessionId);
    return NextResponse.json({ error: "La sesión se subió, pero no pude encolar el análisis" }, { status: 500 });
  }

  return NextResponse.json({ sessionId, status: "pending" });
}
