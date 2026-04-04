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
      hasApiKey: Boolean(pet.apiKey),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
