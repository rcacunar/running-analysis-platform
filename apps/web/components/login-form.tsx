"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    setError(null);
    setMessage(null);

    startTransition(async () => {
      if (mode === "login") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        router.replace("/sessions");
        router.refresh();
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      setMessage("Cuenta creada. Si tu instancia exige confirmación, revisa tu email.");
      setMode("login");
    });
  }

  return (
    <div className="surface hero">
      <p className="eyebrow">Acceso</p>
      <h1>{mode === "login" ? "Entra a tu panel" : "Crea tu cuenta"}</h1>
      <p className="muted">
        Cada usuario ve solo sus sesiones, análisis y comparaciones gracias a Supabase Auth y RLS.
      </p>

      <form
        className="form-grid"
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit(new FormData(event.currentTarget));
        }}
      >
        <label className="field">
          <span>Email</span>
          <input name="email" type="email" placeholder="atleta@club.cl" required />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input name="password" type="password" placeholder="••••••••" required minLength={8} />
        </label>

        {error ? <div className="notice notice-error">{error}</div> : null}
        {message ? <div className="notice notice-ok">{message}</div> : null}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Procesando..." : mode === "login" ? "Ingresar" : "Registrarme"}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={() => {
              setError(null);
              setMessage(null);
              setMode(mode === "login" ? "register" : "login");
            }}
          >
            {mode === "login" ? "Crear cuenta" : "Ya tengo cuenta"}
          </button>
        </div>
      </form>
    </div>
  );
}
