import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { assignStarter, fetchGithubSummary, normalizeUsername } from '@/lib/pet-assignment';
import { getUserPetToken, setUserPetToken } from '@/lib/user-pet-registry';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, roastLevel, apiKey, buddyPrompt, voiceProvider, voiceId, conversationLanguage } = body;
    const normalizedUsername = normalizeUsername(username);
    const finalBuddyPrompt =
      String(buddyPrompt || "").trim() ||
      "You are a stylish, egoist, friendly, funny coding buddy with smooth confidence and protective loyalty toward your Master.";
    const finalVoiceProvider = String(voiceProvider || "cartesia").trim() || "cartesia";
    const finalVoiceId = String(voiceId || "779cb79a-59b0-45c6-b33b-ae46a39809be").trim() || "779cb79a-59b0-45c6-b33b-ae46a39809be";
    const finalConversationLanguage = String(conversationLanguage || "hinglish").trim().toLowerCase() || "hinglish";

    if (!normalizedUsername || !roastLevel) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const github = await fetchGithubSummary(normalizedUsername);
    const existingToken = getUserPetToken(normalizedUsername);
    const starter = assignStarter(normalizedUsername, github);
    let config = null;
    let existingPet = false;

    if (existingToken) {
      const found = await prisma.petConfig.findUnique({
        where: { token: existingToken },
      });

      if (found) {
        existingPet = true;
        config = await prisma.petConfig.update({
          where: { token: existingToken },
          data: {
            roastLevel,
            apiKey: apiKey || found.apiKey || null,
            buddyPrompt: finalBuddyPrompt,
            voiceProvider: finalVoiceProvider,
            voiceId: finalVoiceId,
            conversationLanguage: finalConversationLanguage,
          },
        });
      }
    }

    if (!config) {
      const token = crypto.randomBytes(4).toString('hex');
      config = await prisma.petConfig.create({
        data: {
          token,
          species: starter.species,
          roastLevel,
          apiKey: apiKey || null,
          hat: starter.hat,
          eye: starter.eye,
          buddyPrompt: finalBuddyPrompt,
          voiceProvider: finalVoiceProvider,
          voiceId: finalVoiceId,
          conversationLanguage: finalConversationLanguage,
        },
      });
      setUserPetToken(normalizedUsername, config.token);
    }

    return NextResponse.json({
      success: true,
      token: config.token,
      existingPet,
      command: `cd .. && py -3.12 -m pip install -r ./roastpet_cli/requirements.txt && py -3.12 ./roastpet_cli/cli.py --token ${config.token} --backend-url http://127.0.0.1:3000`,
      desktopCommand: `cd .. && py -3.12 ./roastpet_cli/desktop_companion.py --token ${config.token} --backend-url http://127.0.0.1:3000`,
      github,
      starter: {
        ...starter,
        species: config.species,
        hat: config.hat,
        eye: config.eye,
      },
      buddyPrompt: config.buddyPrompt,
      voiceProvider: config.voiceProvider,
      voiceId: config.voiceId,
      conversationLanguage: config.conversationLanguage,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
