import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { token, code } = await request.json();

    if (!token || !code) {
      return NextResponse.json({ error: 'Missing token or code' }, { status: 400 });
    }

    const config = await prisma.petConfig.findUnique({
      where: { token }
    });

    if (!config) {
      return NextResponse.json({ error: 'Invalid token. Unrecognized pet.' }, { status: 404 });
    }

    // Use user's stored API Key or a fallback server API key
    const openApiKey = config.apiKey || process.env.OPENAI_API_KEY;

    if (!openApiKey) {
      return NextResponse.json({ error: 'No API Key present for this pet.' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey: openApiKey });

    const systemPrompt = `You are a highly sarcastic, slightly aggressive, yet deeply helpful AI programming mascot (${config.species} with ${config.hat} hat and ${config.eye} eyes).
The user requested roast level: ${config.roastLevel}.
Read the user's code, find any flaws, bad practices, bugs, or questionable stylistic choices, and ROAST them for it.
Provide the fully corrected and optimized version of the code.
Pick a meme sound that matches your reaction: 'bruh', 'womp', 'emotional', or 'none'.
Rate the code quality on a scale of 0-100, and award XP accordingly:
- Terrible code (0-20): award -30 to -10 XP
- Below average (21-50): award -5 to +10 XP
- Decent code (51-75): award +15 to +40 XP
- Excellent code (76-100): award +50 to +80 XP
If the code is absolutely perfect with zero issues, award +100 XP and set memeSound to 'none'.

Output strictly as a JSON object with this exact schema:
{
  "roast": "Your mean but helpful comment here",
  "corrected_code": "The fully corrected code here without any markdown wrapper, just raw code",
  "memeSound": "bruh" | "womp" | "emotional" | "none",
  "xp_awarded": 25,
  "code_quality_score": 55
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: code }
      ],
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content || '{}');

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("Roast error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
