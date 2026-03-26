import OpenAI from "openai";

type RoadmapAIInput = {
  roadmap: Record<string, unknown>;
  athleteProfile: Record<string, unknown> | null;
  timeline: Array<Record<string, unknown>>;
  progression: Record<string, unknown>;
};

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new OpenAI({ apiKey });
}

export function isRoadmapAIEnabled() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateRoadmapAIReport(input: RoadmapAIInput) {
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
              "Eres un analista de progreso para sprints y piques, orientado a corredores jóvenes. " +
              "Debes leer un roadmap de entrenamientos y explicar si hay progreso, estancamiento o retroceso. " +
              "Responde en español claro, directo y útil para atleta y entrenador. " +
              "Usa solo los datos entregados. No inventes entrenamientos, no inventes fisiología y no hagas diagnóstico médico. " +
              "Si existe perfil del atleta, úsalo como contexto general, sin volverlo el centro del análisis. " +
              "Presta atención a la cantidad de entrenamientos completados dentro del roadmap, al objetivo de cantidad total y a la secuencia temporal de las sesiones. " +
              "No uses nombres internos de variables, no pegues claves JSON, no cierres con preguntas ni invitaciones a seguir conversando. " +
              "Devuelve un informe breve con estas secciones exactas: Estado del roadmap, Cómo va progresando, Qué mejoró, Qué se estancó o empeoró, Lectura del bloque, Próximo foco. " +
              "En 'Estado del roadmap' explica cuántos entrenamientos van versus los planificados y el rango de fechas del bloque. " +
              "En 'Cómo va progresando' usa la evolución entre primeras y últimas sesiones. " +
              "En 'Próximo foco' da 3 a 5 bullets concretos para el siguiente bloque de trabajo."
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
