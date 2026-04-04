import { NextResponse } from "next/server";
import OpenAI from "openai";

import { parseMemoryNotes } from "@/lib/companion-memory";
import { prisma } from "@/lib/prisma";

function buildClient(apiKey: string) {
  if (apiKey.startsWith("nvapi-")) {
    return {
      client: new OpenAI({
        apiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
      }),
      model: process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
    };
  }

  return {
    client: new OpenAI({ apiKey }),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  };
}

function languageInstruction(language: string | null | undefined) {
  const normalized = String(language || "hinglish").trim().toLowerCase();
  if (normalized === "hindi") return "Reply in natural Hindi.";
  if (normalized === "english") return "Reply in natural English.";
  return "Reply in natural Hinglish using Roman script.";
}

export async function POST(request: Request) {
  try {
    const { token, context, recentConversation } = await request.json();
    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    const config = await prisma.petConfig.findUnique({ where: { token } });
    if (!config) {
      return NextResponse.json({ error: "Invalid token." }, { status: 404 });
    }

    if (!config.autonomousMode) {
      return NextResponse.json({ nudge: "", skipped: true, reason: "autonomous-mode-off" });
    }

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey || (!apiKey.startsWith("nvapi-") && !apiKey.startsWith("sk-") && !apiKey.startsWith("sess-"))) {
      return NextResponse.json({ nudge: "", skipped: true, reason: "missing-brain-key" });
    }

    const { client, model } = buildClient(apiKey);
    const memoryNotes = parseMemoryNotes(config.memoryNotes);
    const convo = Array.isArray(recentConversation) ? recentConversation.slice(-5) : [];

    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: `You are an autonomous coding buddy who starts conversations naturally like a close friend.
Keep the nudge very short: 1 sentence, max 18 words.
Do not sound robotic, salesy, or repetitive.
Do not ask more than one question.
Initiate only if you have a meaningful reason from the repo context, life memory, or recent conversation.
${languageInstruction(config.conversationLanguage)}
Buddy behavior: ${String(config.buddyPrompt || "")}
Things you remember: ${memoryNotes.length ? memoryNotes.join(" | ") : "Nothing personal remembered yet."}`,
        },
        {
          role: "user",
          content: `Repo / situation context:\n${String(context || "No extra context.")}\n\nRecent conversation:\n${JSON.stringify(convo)}`,
        },
      ],
      temperature: 0.85,
      max_tokens: 70,
    });

    const nudge = response.choices[0]?.message?.content?.trim() || "";
    return NextResponse.json({
      nudge,
      provider: apiKey.startsWith("nvapi-") ? "nvidia" : "openai",
      model,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
