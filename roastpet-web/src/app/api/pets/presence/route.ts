import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPresence, updatePresence } from "@/lib/presence-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Missing token." }, { status: 400 });
    }

    const config = await prisma.petConfig.findUnique({
      where: { token },
    });
    if (!config) {
      return NextResponse.json({ error: "Invalid token." }, { status: 404 });
    }

    return NextResponse.json({ presence: getPresence(token) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { token, species, surface, status } = await request.json();
    if (!token || !species || !surface) {
      return NextResponse.json({ error: "Missing presence payload." }, { status: 400 });
    }

    const config = await prisma.petConfig.findUnique({
      where: { token },
    });
    if (!config) {
      return NextResponse.json({ error: "Invalid token." }, { status: 404 });
    }

    const presence = updatePresence(String(token), String(species), String(surface), String(status || "online"));
    return NextResponse.json({ success: true, presence });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
