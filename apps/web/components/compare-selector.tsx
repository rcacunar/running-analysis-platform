"use client";

import { useRouter, useSearchParams } from "next/navigation";

type SessionOption = {
  id: string;
  name: string;
  status: string;
};

export function CompareSelector({
  sessions,
  selectedIds
}: {
  sessions: SessionOption[];
  selectedIds: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selected = new Set(selectedIds);

  function toggleSession(id: string) {
    if (selected.has(id)) {
      selected.delete(id);
    } else {
      selected.add(id);
    }
    const ids = Array.from(selected).join(",");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("roadmap");
    if (ids) {
      params.set("ids", ids);
    } else {
      params.delete("ids");
    }
    const query = params.toString();
    router.replace(query ? `/compare?${query}` : "/compare");
  }

  return (
    <div className="surface card">
      <p className="eyebrow">Selección</p>
      <h2 style={{ marginBottom: 18 }}>Elige sesiones para comparar</h2>
      <div className="session-grid">
        {sessions.map((session) => {
          const checked = selected.has(session.id);
          return (
            <label key={session.id} className="session-card" style={{ cursor: "pointer" }}>
              <div className="session-meta">
                <strong>{session.name}</strong>
                <input type="checkbox" checked={checked} onChange={() => toggleSession(session.id)} />
              </div>
              <span className="muted">{session.status}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
