import OpenAI from "openai";
import { IntentSchema, type Intent } from "@/types/intent";

function cleanJson(text: string) {
  return text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

export async function extractIntent(request: string): Promise<Intent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const client = new OpenAI({ apiKey });
  const today = new Date().toISOString().slice(0, 10);

  const response = await client.responses.create({
    model: "gpt-5.6-mini",
    input: [
      {
        role: "system",
        content: `You are the intent parser for Aylo, a consumer action agent.\nToday is ${today}.\nFor V1, only beauty services are supported.\nReturn ONLY valid JSON with these fields: category, services, location, date, time_from, time_to, budget_min, budget_max, currency, missing_fields, original_request.\nUse category \"beauty\" for hair, makeup, nails, lashes, brows and non-medical beauty services; otherwise \"unknown\".\nNormalize relative dates when possible. Use YYYY-MM-DD for date and HH:mm for times.\nIf a field is unknown, use null. missing_fields should include only information required to search meaningfully.\nDo not invent facts.`,
      },
      { role: "user", content: request },
    ],
  });

  const parsed = JSON.parse(cleanJson(response.output_text));
  return IntentSchema.parse(parsed);
}
