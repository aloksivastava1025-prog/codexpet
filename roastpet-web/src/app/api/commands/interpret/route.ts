import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

function buildClient(apiKey: string) {
  if (apiKey.startsWith("nvapi-")) {
    return {
      client: new OpenAI({
        apiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
      }),
      model: process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
      structured: false,
    };
  }

  return {
    client: new OpenAI({ apiKey }),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    structured: true,
  };
}

function parseJson(content: string | null) {
  if (!content) throw new Error("Empty model response.");
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    throw new Error("Interpretation response was not valid JSON.");
  }
}

export async function POST(request: Request) {
  try {
    const { token, transcript } = await request.json();
    if (!token || !transcript) {
      return NextResponse.json({ error: "Missing token or transcript." }, { status: 400 });
    }

    const config = await prisma.petConfig.findUnique({
      where: { token },
    });
    if (!config) {
      return NextResponse.json({ error: "Invalid token." }, { status: 404 });
    }

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        cleanedCommand: String(transcript),
        detectedLanguage: "unknown",
        confidence: 0.5,
      });
    }

    const { client, model, structured } = buildClient(apiKey);
    const prompt = `You clean up speech-to-text transcripts for a coding assistant pet.
The user may speak in simple Hindi, Hinglish, or broken English.
Return strict JSON:
{
  "cleanedCommand": "clear command in English or simple Hinglish",
  "detectedLanguage": "en" | "hi" | "hinglish",
  "confidence": 0.0
}

Rules:
- Preserve the user's intent.
- Fix obvious speech-to-text mistakes.
- If the transcript is nonsense, still output the best likely command.
- Keep it short and actionable for a coding agent.`;

    const requestBody: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: String(transcript) },
      ],
      temperature: 0.2,
    };
    if (structured) {
      requestBody.response_format = { type: "json_object" };
    }
    const response = await client.chat.completions.create(requestBody);
    return NextResponse.json(parseJson(response.choices[0]?.message?.content ?? null));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
