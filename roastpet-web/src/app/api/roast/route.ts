import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const rateLimitStore = new Map<string, number[]>();

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'local';
}

function enforceRateLimit(key: string) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recentRequests = (rateLimitStore.get(key) || []).filter((ts) => ts > windowStart);

  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - recentRequests[0]);
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recentRequests.push(now);
  rateLimitStore.set(key, recentRequests);

  if (rateLimitStore.size > 2000) {
    for (const [storeKey, timestamps] of rateLimitStore.entries()) {
      const filtered = timestamps.filter((ts) => ts > windowStart);
      if (filtered.length === 0) {
        rateLimitStore.delete(storeKey);
      } else {
        rateLimitStore.set(storeKey, filtered);
      }
    }
  }

  return { limited: false, retryAfterSeconds: 0 };
}

function buildOpenAIClient(apiKey: string) {
  if (apiKey.startsWith('nvapi-')) {
    return {
      client: new OpenAI({
        apiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      }),
      model: process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
      supportsStructuredOutput: false,
      provider: 'nvidia',
    };
  }

  return {
    client: new OpenAI({ apiKey }),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    supportsStructuredOutput: true,
    provider: 'openai',
  };
}

function parseModelJson(content: string | null) {
  if (!content) {
    throw new Error('Model returned an empty response.');
  }

  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');

    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }

    throw new Error('Model response was not valid JSON.');
  }
}

export async function POST(request: Request) {
  try {
    const { token, code } = await request.json();

    if (!token || !code) {
      return NextResponse.json({ error: 'Missing token or code' }, { status: 400 });
    }

    const clientIp = getClientIp(request);
    const rateLimit = enforceRateLimit(`${clientIp}:${token}`);
    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: 'Too many roast requests. Give your pet a second to breathe.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const config = await prisma.petConfig.findUnique({
      where: { token },
    });

    if (!config) {
      return NextResponse.json({ error: 'Invalid token. Unrecognized pet.' }, { status: 404 });
    }

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'No API Key present for this pet.' }, { status: 400 });
    }

    const { client, model, supportsStructuredOutput, provider } = buildOpenAIClient(apiKey);
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

    const requestBody: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: String(code) },
      ],
      temperature: 0.4,
    };

    if (supportsStructuredOutput) {
      requestBody.response_format = { type: 'json_object' };
    }

    const response = await client.chat.completions.create(requestBody);
    const content = response.choices[0]?.message?.content ?? null;
    const parsed = parseModelJson(content);

    return NextResponse.json({
      ...parsed,
      provider,
      model,
    });
  } catch (error: unknown) {
    console.error('Roast error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
