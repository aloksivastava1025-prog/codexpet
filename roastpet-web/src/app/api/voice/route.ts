import { NextResponse } from 'next/server';
import OpenAI from 'openai';

import { prisma } from '@/lib/prisma';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;
const rateLimitStore = new Map<string, number[]>();
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const ELEVENLABS_DEFAULT_VOICE_ID = 'cgSgspJ2msm6clMCkdW9';
const ELEVENLABS_DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const CARTESIA_API_URL = 'https://api.cartesia.ai/tts/bytes';
const CARTESIA_DEFAULT_VOICE_ID = process.env.CARTESIA_VOICE_ID || '779cb79a-59b0-45c6-b33b-ae46a39809be';
const CARTESIA_DEFAULT_MODEL_ID = 'sonic-2';

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

const SPECIES_ELEVENLABS_VOICES: Record<string, { voiceId: string; style: string }> = {
  duck: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'cute, playful, girlish, mascot-like' },
  rabbit: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'soft, bright, excitable anime sidekick' },
  snail: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'soft, sleepy, teasing, gentle mascot' },
  blob: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'cute, squishy, bubbly, affectionate' },
  cat: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'soft, girlish, smug, teasing companion' },
  penguin: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'cool, cute, neat, polished mascot' },
  ghost: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'whispery, cute, haunted, playful' },
  mushroom: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'soft, cozy, magical anime helper' },
  owl: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'gentle, observant, clever, cute' },
  turtle: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'calm, patient, soft-spoken mascot' },
  axolotl: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'adorable, bright, bubbly, girlish' },
  robot: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'soft synthetic anime assistant, cute but crisp' },
  dragon: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'cute dragon mascot, dramatic but soft' },
  octopus: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'quick, playful, girlish trickster' },
  capybara: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'relaxed, soft, warm, unbothered' },
  chonk: { voiceId: ELEVENLABS_DEFAULT_VOICE_ID, style: 'plush, sweet, clingy, affectionate' },
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

function normalizeApiKey(rawKey: string | null) {
  if (!rawKey) return null;
  const trimmed = rawKey.trim();
  const extracted = trimmed.match(/"xi-api-key"\s*:\s*"([^"]+)"/i);
  if (extracted?.[1]) return extracted[1];
  return trimmed;
}

function isElevenLabsKey(apiKey: string | null) {
  if (!apiKey) return false;
  return /^xi-api-key$/i.test(apiKey) || /^[a-f0-9]{32}$/i.test(apiKey);
}

function isOpenAiKey(apiKey: string | null) {
  if (!apiKey) return false;
  return apiKey.startsWith('sk-') || apiKey.startsWith('sess-');
}

function isCartesiaKey(apiKey: string | null) {
  if (!apiKey) return false;
  return apiKey.startsWith('sk_car_');
}

function resolveSpeechConfig(apiKey: string | null, preferredProvider: string | null | undefined) {
  const cartesiaKey = process.env.CARTESIA_API_KEY || null;
  const normalizedKey = normalizeApiKey(apiKey);
  const preferred = String(preferredProvider || "").trim().toLowerCase();

  if (preferred === 'cartesia' && cartesiaKey) {
    return {
      provider: 'cartesia' as const,
      apiKey: cartesiaKey,
    };
  }

  if (isElevenLabsKey(normalizedKey)) {
    return {
      provider: 'elevenlabs' as const,
      apiKey: normalizedKey,
    };
  }

  if (isCartesiaKey(normalizedKey)) {
    return {
      provider: 'cartesia' as const,
      apiKey: normalizedKey,
    };
  }

  if (cartesiaKey) {
    return {
      provider: 'cartesia' as const,
      apiKey: cartesiaKey,
    };
  }

  if (isOpenAiKey(normalizedKey)) {
    return {
      provider: 'openai' as const,
      apiKey: normalizedKey,
    };
  }

  const openAiKey = process.env.OPENAI_TTS_API_KEY || process.env.OPENAI_API_KEY || null;
  if (openAiKey) {
    return {
      provider: 'openai' as const,
      apiKey: openAiKey,
    };
  }

  return null;
}

function buildSpokenText(text: string, mode: string | null | undefined) {
  const trimmed = String(text || '').trim().slice(0, 240);
  if (!trimmed) return '';
  if (/master/i.test(trimmed)) return trimmed;
  if (mode === 'meme') return `Master, ${trimmed}`;
  return `Master, ${trimmed}`;
}

function inferPerformanceProfile(prompt: string | null | undefined, language: string | null | undefined) {
  const source = `${String(prompt || "")} ${String(language || "")}`.toLowerCase();
  let speed: "slow" | "normal" | "fast" = "normal";
  let personality = "warm, playful, stylish, conversational";

  if (source.includes("gojo") || source.includes("egoist") || source.includes("stylish")) {
    speed = "fast";
    personality = "stylish, confident, teasing, cool, effortlessly funny";
  } else if (source.includes("soft") || source.includes("gentle") || source.includes("calm")) {
    speed = "slow";
    personality = "soft, warm, gentle, affectionate";
  }

  if (source.includes("hinglish")) {
    personality += ", speaks in natural Hinglish";
  } else if (source.includes("hindi")) {
    personality += ", speaks in natural Hindi";
  }

  return { speed, personality };
}

async function createElevenLabsSpeech(params: {
  apiKey: string;
  species: string;
  text: string;
  mode?: string | null;
}) {
  const profile = SPECIES_ELEVENLABS_VOICES[params.species] || SPECIES_ELEVENLABS_VOICES.duck;
  const response = await fetch(
    `${ELEVENLABS_API_URL}/${profile.voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': params.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: buildSpokenText(params.text, params.mode),
        model_id: ELEVENLABS_DEFAULT_MODEL_ID,
        voice_settings: {
          stability: 0.32,
          similarity_boost: 0.82,
          style: 0.7,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`ElevenLabs voice error: ${message}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    contentType: 'audio/mpeg',
  };
}

async function createCartesiaSpeech(params: {
  apiKey: string;
  text: string;
  voiceId?: string | null;
  speed?: "slow" | "normal" | "fast";
}) {
  const response = await fetch(CARTESIA_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Cartesia-Version': '2024-11-13',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model_id: CARTESIA_DEFAULT_MODEL_ID,
      transcript: buildSpokenText(params.text, 'ambient'),
      voice: {
        mode: 'id',
        id: params.voiceId || CARTESIA_DEFAULT_VOICE_ID,
      },
      output_format: {
        container: 'wav',
        encoding: 'pcm_f32le',
        sample_rate: 44100,
      },
      language: 'en',
      speed: params.speed || 'normal',
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Cartesia voice error: ${message}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    contentType: 'audio/wav',
  };
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

    const speechConfig = resolveSpeechConfig(config.apiKey, config.voiceProvider);
    if (!speechConfig) {
      return NextResponse.json(
        { error: 'AI voice is unavailable. Add an OpenAI sk- key or an ElevenLabs key for this pet.' },
        { status: 400 }
      );
    }

    const activeSpecies = species || config.species;
    let buffer: Buffer;
    let contentType = 'audio/wav';

    if (speechConfig.provider === 'elevenlabs') {
      const elevenlabsSpeech = await createElevenLabsSpeech({
        apiKey: speechConfig.apiKey,
        species: activeSpecies,
        text: String(text),
        mode,
      });
      buffer = elevenlabsSpeech.buffer;
      contentType = elevenlabsSpeech.contentType;
    } else if (speechConfig.provider === 'cartesia') {
      const cartesiaSpeech = await createCartesiaSpeech({
        apiKey: speechConfig.apiKey,
        text: String(text),
        voiceId: config.voiceId,
        speed: inferPerformanceProfile(config.buddyPrompt, config.conversationLanguage).speed,
      });
      buffer = cartesiaSpeech.buffer;
      contentType = cartesiaSpeech.contentType;
    } else {
      const profile = SPECIES_VOICES[activeSpecies] || SPECIES_VOICES[config.species] || SPECIES_VOICES.duck;
      const performance = inferPerformanceProfile(config.buddyPrompt, config.conversationLanguage);
      const openai = new OpenAI({ apiKey: speechConfig.apiKey });
      const instructions = [
        `You are the voice of a ${config.species} coding companion.`,
        `Perform with this style: ${profile.style}.`,
        `Adopt this personality: ${performance.personality}.`,
        `Reply language preference: ${String(config.conversationLanguage || 'hinglish')}.`,
        'Address the user as Master occasionally in a soft, loyal anime mascot way.',
        'Keep the delivery short, expressive, and game-like.',
        mode === 'meme'
          ? 'Lean into meme timing and comedic punch.'
          : 'Sound like a loyal starter pet talking to its trainer.',
      ].join(' ');

      const response = await openai.audio.speech.create({
        model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
        voice: profile.voice as 'alloy',
        input: buildSpokenText(String(text), mode),
        instructions,
        response_format: 'wav',
      });

      buffer = Buffer.from(await response.arrayBuffer());
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: unknown) {
    console.error('Voice error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
