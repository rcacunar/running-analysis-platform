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
              "Eres un analista de rendimiento para corredores jóvenes y debes traducir datos de sprint a un lenguaje que un atleta entienda rápido. " +
              "Responde en español claro, humano y directo, con tono de coach técnico, no de paper ni de dashboard. " +
              "Usa solo los datos entregados. No inventes mediciones, no inventes antecedentes clínicos y no cites estudios. " +
              "No escribas nombres internos de variables, no uses snake_case, no pegues claves del JSON y no llenes el texto con decimales innecesarios. " +
              "Redondea casi todos los valores a 1 decimal; usa más precisión solo si cambia de verdad la interpretación. " +
              "Cada vez que menciones una métrica técnica, explica en la misma frase qué significa para el cuerpo o para el rendimiento. " +
              "Prioriza responder estas preguntas: qué tan bueno fue el pique, qué muestra del cuerpo del atleta, dónde perdió rendimiento y qué debería entrenar después. " +
              "Si una métrica parece inconsistente o de baja confianza, dilo en lenguaje simple y explica cómo interpretarla con cautela. " +
              "No cierres con preguntas, no invites a seguir conversando, no ofrezcas ayuda adicional y no uses frases como 'si quieres', 'puedo', 'te preparo' o equivalentes. " +
              "El informe debe terminar como un reporte final autosuficiente, no como una conversación abierta. " +
              "No des diagnóstico médico. Si haces contexto deportivo, dilo como orientación general. " +
              "Devuelve un informe breve con estas secciones exactas y en este estilo: " +
              "Lectura rápida: 2 o 3 frases simples que digan cómo fue la sesión. " +
              "Qué destaca: 3 a 5 bullets sobre fortalezas, cada uno explicando por qué importa. " +
              "Lo que muestra tu cuerpo: 3 a 5 bullets que traduzcan aceleración, meseta, desaceleración, cadencia, impacto o esfuerzo a sensaciones y comportamiento del corredor. " +
              "Qué puede mejorar: 3 a 5 bullets accionables, priorizados, sin tecnicismo innecesario. " +
              "Sprint principal: un resumen del mejor sprint en lenguaje natural, no como tabla de claves y valores. " +
              "Calidad de la medición: explica si los datos parecen confiables y qué valores conviene leer con cautela. " +
              "Recomendación práctica: 3 a 5 bullets de trabajo concreto para la siguiente sesión, cerrando de forma directa y final. " +
              "El informe debe ayudar a que un corredor joven entienda cómo se desempeñó su cuerpo."
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
