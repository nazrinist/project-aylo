import OpenAI from "openai";
import { IntentSchema, type Intent } from "@/types/intent";
import { normalizeMissingFields } from "@/lib/intent/follow-up";

function cleanJson(text: string) {
  return text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function demoIntent(request: string): Intent {
  const text = request.toLocaleLowerCase("az");
  const services: string[] = [];
  if (/saç|sac|hair|fen|styling/.test(text)) services.push("hair");
  if (/makiyaj|makeup|make-up/.test(text)) services.push("makeup");
  if (/manik|pedik|nail/.test(text)) services.push("nails");
  if (/kirpik|lash/.test(text)) services.push("lashes");
  if (/qaş|qas|brow/.test(text)) services.push("brows");

  const beauty = services.length > 0 || /salon|beauty|gözəllik|gozellik/.test(text);
  const budget = text.match(/(\d{2,4})\s*(?:azn|manat)/)?.[1];
  const clockTime = text.match(/(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
  const namedHour = text.match(/(?:saat|at)\s*([01]?\d|2[0-3])(?!\d)/);
  const rawTime = clockTime ?? namedHour;
  let hour = rawTime ? Number(rawTime[1]) : null;
  const minute = clockTime?.[2] ?? "00";
  if (hour !== null && /axşam|aksam|evening|pm/.test(text) && hour < 12) hour += 12;

  let location: string | null = null;
  if (/ağ şəhər|ag seher|white city/.test(text)) location = "Ağ Şəhər, Bakı";
  else {
    const known = [
      "xətai",
      "xetai",
      "nerimanov",
      "nərimanov",
      "səbail",
      "sebail",
      "gənclik",
      "genclik",
      "28 may",
      "içərişəhər",
      "iceriseher",
    ];
    location = known.find((place) => text.includes(place)) ?? null;
  }

  const today = new Date();
  const explicitDate = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1] ?? null;
  const date = explicitDate ?? (/birigün|birigun|day after tomorrow/.test(text)
      ? addDays(today, 2)
      : /sabah|tomorrow/.test(text)
        ? addDays(today, 1)
        : /bu gün|bugun|today/.test(text)
          ? addDays(today, 0)
          : null);

  return normalizeMissingFields(IntentSchema.parse({
    category: beauty ? "beauty" : "unknown",
    services,
    location,
    date,
    time_from: hour === null ? null : `${String(hour).padStart(2, "0")}:${minute}`,
    time_to: null,
    budget_min: null,
    budget_max: budget ? Number(budget) : null,
    currency: "AZN",
    missing_fields: [],
    original_request: request,
  }));
}

export type IntentExtraction = {
  intent: Intent;
  source: "openai" | "demo";
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
};

export async function extractIntentWithTelemetry(request: string): Promise<IntentExtraction> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      intent: demoIntent(request),
      source: "demo",
      model: null,
      inputTokens: null,
      outputTokens: null,
    };
  }

  const client = new OpenAI({ apiKey });
  const today = new Date().toISOString().slice(0, 10);
  const model = "gpt-5.6-mini";

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: `You are the intent parser for Aylo, a consumer action agent.\nToday is ${today}.\nFor V1, only beauty services are supported.\nReturn ONLY valid JSON with these fields: category, services, location, date, time_from, time_to, budget_min, budget_max, currency, missing_fields, original_request.\nUse category \"beauty\" for hair, makeup, nails, lashes, brows and non-medical beauty services; otherwise \"unknown\".\nNormalize relative dates when possible. Use YYYY-MM-DD for date and HH:mm for times.\nIf a field is unknown, use null. missing_fields should include only information required to search meaningfully.\nDo not invent facts.`,
      },
      { role: "user", content: request },
    ],
  });

  const parsed = JSON.parse(cleanJson(response.output_text));
  return {
    intent: normalizeMissingFields(IntentSchema.parse(parsed)),
    source: "openai",
    model,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
  };
}

export async function extractIntent(request: string): Promise<Intent> {
  return (await extractIntentWithTelemetry(request)).intent;
}
