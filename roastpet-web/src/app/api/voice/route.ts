import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { prisma } from '@/lib/prisma';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const rateLimitStore = new Map<string, number[]>();

const SPECIES_VOICES: Record<string, { voice: string; style: string }> = {
  duck: { voice: 'alloy', style: 'bouncy, mischievous, tiny battle companion' },
  rabbit: { voice: 'nova', style: 'fast, playful, excitable sidekick' },
  snail: { voice: 'echo', style: 'slow, dry, wise, cozy' },
  blob: { voice: 'shimmer', style: 'squishy, wholesome, chaotic-cute' },
  cat: { voice: 'ash', style: 'dry, smug, judgmental but secretly supportive' },
  penguin: { voice: 'fable', style: 'cool, composed, low-drama, stylish' },
  ghost: { voice: 'ballad', style: 'softly haunted, teasing, theatrical' },
  mushroom: { voice: 'sage', style: 'gentle forest guide with strange confidence' },
  owl: { voice: 'echo', style: 'observant, strategic, midnight mentor' },
  turtle: { voice: 'onyx', style: 'steady, grounded, patient veteran' },
  axolotl: { voice: 'nova', style: 'adorable, bright, restorative hype friend' },
  robot: { voice: 'onyx', style: 'clean, precise, warm machine champion' },
  dragon: { voice: 'alloy', style: 'grand, fiery, champion-tier menace' },
  octopus: { voice: 'shimmer', style: 'quick, clever, multitasking trickster' },
  capybara: { voice: 'sage', style: 'unbothered, reassuring, effortlessly cool' },
  chonk: { voice: 'ballad', style: 'large-hearted, bold, plush tank energy' },
};

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
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
  return { limited: false, retryAfterSeconds: 0 };
}

function resolveSpeechKey(apiKey: string | null) {
  if (apiKey && !apiKey.startsWith('nvapi-')) {
    return apiKey;
  }
  return process.env.OPENAI_TTS_API_KEY || process.env.OPENAI_API_KEY || null;
}

export async function POST(request: Request) {
  try {
    const { token, text, species, mode } = await request.json();

    if (!token || !text) {
      return NextResponse.json({ error: 'Missing token or text' }, { status: 400 });
    }

    const rateLimit = enforceRateLimit(`${getClientIp(request)}:${token}:voice`);
    if (rateLimit.limited) {
      return NextResponse.json(
        {
          error: 'Voice rate limit hit. Your pet needs a breath.',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        {
          status: 429,
          headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const config = await prisma.petConfig.findUnique({
      where: { token },
    });

    if (!config) {
      return NextResponse.json({ error: 'Invalid token. Unrecognized pet.' }, { status: 404 });
    }

    const speechKey = resolveSpeechKey(config.apiKey);
    if (!speechKey) {
      return NextResponse.json(
        { error: 'AI voice is unavailable. Add an OpenAI TTS key on the server or use an OpenAI key for this pet.' },
        { status: 400 }
      );
    }

    const profile = SPECIES_VOICES[species || config.species] || SPECIES_VOICES[config.species] || SPECIES_VOICES.duck;
    const openai = new OpenAI({ apiKey: speechKey });
    const instructions = [
      `You are the voice of a ${config.species} coding companion.`,
      `Perform with this style: ${profile.style}.`,
      `Keep the delivery short, expressive, and game-like.`,
      mode === 'meme' ? 'Lean into meme timing and comedic punch.' : 'Sound like a loyal starter pet talking to its trainer.',
    ].join(' ');

    const response = await openai.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: profile.voice as 'alloy',
      input: String(text).slice(0, 240),
      instructions,
      response_format: 'wav',
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    console.error('Voice error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
