import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <p className="eyebrow">Running Analysis Platform</p>
          <h1 style={{ margin: 0 }}>Sesiones y comparaciones</h1>
          <span className="muted">{user.email}</span>
        </div>
        <div className="nav-links">
          <Link href="/sessions" className="button-secondary">
            Sesiones
          </Link>
          <Link href="/compare" className="button-secondary">
            Comparar
          </Link>
          <SignOutButton />
        </div>
      </header>
      <div className="page-grid">{children}</div>
    </main>
  );
}
