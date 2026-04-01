import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { assignStarter, fetchGithubSummary, normalizeUsername } from '@/lib/pet-assignment';
import { getUserPetToken, setUserPetToken } from '@/lib/user-pet-registry';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, roastLevel, apiKey } = body;
    const normalizedUsername = normalizeUsername(username);

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
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
