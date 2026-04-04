import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const pet = await prisma.petConfig.findUnique({
      where: { token },
    });

    if (!pet) {
      return NextResponse.json({ error: 'Pet not found' }, { status: 404 });
    }

    return NextResponse.json({
      token: pet.token,
      species: pet.species,
      hat: pet.hat,
      eye: pet.eye,
      roastLevel: pet.roastLevel,
      buddyPrompt: pet.buddyPrompt,
      voiceProvider: pet.voiceProvider,
      voiceId: pet.voiceId,
      conversationLanguage: pet.conversationLanguage,
      memoryNotes: pet.memoryNotes,
      autonomousMode: pet.autonomousMode,
      hasApiKey: Boolean(pet.apiKey),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.conversationLanguage === "string") {
      updates.conversationLanguage = body.conversationLanguage.trim().toLowerCase();
    }
    if (typeof body.buddyPrompt === "string") {
      updates.buddyPrompt = body.buddyPrompt;
    }
    if (typeof body.voiceProvider === "string") {
      updates.voiceProvider = body.voiceProvider;
    }
    if (typeof body.voiceId === "string") {
      updates.voiceId = body.voiceId;
    }
    if (typeof body.autonomousMode === "boolean") {
      updates.autonomousMode = body.autonomousMode;
    }

    const pet = await prisma.petConfig.update({
      where: { token },
      data: updates,
    });

    return NextResponse.json({
      token: pet.token,
      conversationLanguage: pet.conversationLanguage,
      buddyPrompt: pet.buddyPrompt,
      voiceProvider: pet.voiceProvider,
      voiceId: pet.voiceId,
      autonomousMode: pet.autonomousMode,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
