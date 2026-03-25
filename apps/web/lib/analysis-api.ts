import { env } from "@/lib/env";

export async function enqueueAnalysis(sessionId: string) {
  const response = await fetch(`${env.ANALYSIS_API_URL}/v1/jobs/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.ANALYSIS_API_TOKEN}`
    },
    body: JSON.stringify({ session_id: sessionId }),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to enqueue analysis: ${text}`);
  }

  return response.json();
}
