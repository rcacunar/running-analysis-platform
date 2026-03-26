import { ProfileForm } from "@/components/profile-form";
import { requireUser } from "@/lib/auth";
import type { ProfileRow } from "@/lib/types";

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  return (
    <section className="page-grid">
      <section className="surface card">
        <p className="eyebrow">Perfil del atleta</p>
        <h1 style={{ marginBottom: 10 }}>Contexto del participante</h1>
        <p className="muted" style={{ margin: 0 }}>
          Completa tu perfil para que el análisis IA entienda mejor quién corre, cuál es su contexto y qué tipo de mejora
          tiene más sentido.
        </p>
      </section>
      <ProfileForm profile={(profile as ProfileRow | null) ?? null} />
    </section>
  );
}
