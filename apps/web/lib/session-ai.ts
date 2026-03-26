import OpenAI from "openai";

type AIInput = {
  sessionName: string;
  summary: Record<string, unknown>;
  sprints: Array<Record<string, unknown>>;
  phases: Array<Record<string, unknown>>;
  featureStats: Record<string, unknown>;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

export function isSessionAIEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateSessionAIReport(input: AIInput) {
  const client = getOpenAIClient();
  if (!client) {
    throw new Error("OPENAI_API_KEY no está configurada");
  }

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "Eres un analista de rendimiento de sprint. Responde en español claro y técnico. " +
              "Usa solo los datos entregados, no inventes mediciones. " +
              "Si haces contexto deportivo, dilo como orientación general, no como diagnóstico. " +
              "Devuelve un informe breve con estas secciones exactas: " +
              "Lectura rápida, Qué destaca, Qué puede mejorar, Sprint principal, Calidad de la medición, Recomendación práctica."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify(input, null, 2)
          }
        ]
      }
    ]
  });

  const reportText = response.output_text?.trim();
  if (!reportText) {
    throw new Error("No pude generar texto desde el modelo");
  }

  return { model, reportText };
}
