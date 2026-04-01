import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { species, roastLevel, apiKey, hat, eye } = body;

    if (!species || !roastLevel) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Generate a short, unique sync token for the CLI command
    const token = crypto.randomBytes(4).toString('hex');

    const config = await prisma.petConfig.create({
      data: {
        token,
        species,
        roastLevel,
        apiKey: apiKey || null,
        hat: hat || 'none',
        eye: eye || 'o',
      },
    });

    return NextResponse.json({ success: true, token: config.token });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
