import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Running Analysis",
  description: "Sprint and running session analysis with Supabase and Python workers"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
