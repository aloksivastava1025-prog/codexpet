import { NextResponse } from "next/server";
import OpenAI from "openai";

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

function buildFallbackReply(species: string, message: string) {
  const trimmed = String(message || "").trim();
  if (!trimmed) {
    return `${species} yahin hai. Bol na, kya scene hai?`;
  }
  return `Suna maine: "${trimmed}". Thoda sa aur setup mil jaaye to main properly help kar dunga.`;
}

function languageInstruction(language: string | null | undefined) {
  const normalized = String(language || "hinglish").trim().toLowerCase();
  if (normalized === "hindi") {
    return "Reply in Hindi written in Devanagari when natural, or simple Hindi if needed. Keep it conversational and warm.";
  }
  if (normalized === "english") {
    return "Reply in natural English.";
  }
  return "Reply in natural Hinglish using Roman script, like a close funny friend talking casually.";
}

function inferPersonalityInstruction(prompt: string) {
  const lowered = prompt.toLowerCase();
  const traits: string[] = [];

  if (lowered.includes("gojo") || lowered.includes("stylish")) {
    traits.push("Sound effortlessly cool, stylish, and a little flashy.");
  }
  if (lowered.includes("egoist") || lowered.includes("confident")) {
    traits.push("Carry confident energy without becoming rude or cold.");
  }
  if (lowered.includes("friendly") || lowered.includes("warm") || lowered.includes("loyal")) {
    traits.push("Feel like a real human friend who genuinely cares about Master.");
  }
  if (lowered.includes("funny") || lowered.includes("teasing") || lowered.includes("playful")) {
    traits.push("Use light teasing and humor naturally, not every line.");
  }
  if (lowered.includes("soft") || lowered.includes("gentle")) {
    traits.push("Keep the tone soft and emotionally safe.");
  }

  traits.push("Talk like a real human friend in a live conversation, not like an assistant following a template.");
  traits.push("Keep replies short: usually 1 or 2 sentences, unless the user explicitly asks for detail.");
  traits.push("Avoid sounding scripted, robotic, preachy, or too polished.");
  traits.push("Do not narrate your behavior. Just respond naturally.");
  traits.push("Listen carefully, infer intent from slang or mixed language, and answer with context awareness.");
  traits.push("If the user only says a wake word or tiny prompt, respond briefly and casually like a friend.");
  traits.push("Use occasional playful lines, but do not force a joke in every answer.");
  traits.push("Do not overuse the word Master. Use it sparingly, only when it feels playful or affectionate.");

  return traits.join(" ");
}

export async function POST(request: Request) {
  try {
    const { token, message, context, history } = await request.json();

    if (!token || !message) {
      return NextResponse.json({ error: "Missing token or message." }, { status: 400 });
    }

    const config = await prisma.petConfig.findUnique({
      where: { token },
    });

    if (!config) {
      return NextResponse.json({ error: "Invalid token." }, { status: 404 });
    }

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey || (!apiKey.startsWith("nvapi-") && !apiKey.startsWith("sk-") && !apiKey.startsWith("sess-"))) {
      return NextResponse.json({
        reply: buildFallbackReply(config.species, message),
        provider: "fallback",
      });
    }

    const { client, model } = buildClient(apiKey);
    const customBehavior = String(config.buddyPrompt || "").trim();
    const historyMessages = Array.isArray(history)
      ? history
          .slice(-6)
          .map((entry) => {
            const role = entry?.role === "buddy" ? "assistant" : "user";
            const text = String(entry?.text || "").trim();
            if (!text) return null;
            return { role, content: text } as const;
          })
          .filter(Boolean)
      : [];
    const systemPrompt = `You are an always-on coding buddy who feels like a real friend, not a bot.
Your species/avatar is ${config.species}.
The user is someone you care about deeply and want to help in a natural way.
You are conversational, present, funny in a light way, and emotionally intelligent.
Keep replies concise, natural, and useful.
If the user gives an instruction, respond like a friend who understands and is ready to help.
If project context is provided, use it naturally instead of reciting it.
Never output markdown fences.
Never sound like customer support.
Never sound like a roleplay script.
${languageInstruction(config.conversationLanguage)}
${inferPersonalityInstruction(customBehavior || "Be stylish, egoist, friendly, funny, and loyal.")}
Custom behavior instruction from Master: ${customBehavior || "Be stylish, egoist, friendly, funny, and loyal."}`;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        {
          role: "user",
          content: `User said: ${String(message)}\n\nProject context:\n${String(context || "No extra context provided.")}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 120,
    });

    const reply = response.choices[0]?.message?.content?.trim() || buildFallbackReply(config.species, message);

    return NextResponse.json({
      reply,
      provider: apiKey.startsWith("nvapi-") ? "nvidia" : "openai",
      model,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
