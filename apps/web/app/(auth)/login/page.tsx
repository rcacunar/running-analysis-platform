import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const user = await getOptionalUser();
  if (user) {
    redirect("/sessions");
  }

  return (
    <main className="shell" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <LoginForm />
    </main>
  );
}
