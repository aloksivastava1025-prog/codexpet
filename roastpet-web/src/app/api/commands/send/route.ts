import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueCommand } from "@/lib/command-store";

export async function POST(request: Request) {
  try {
    const { token, text, source } = await request.json();

    if (!token || !text) {
      return NextResponse.json({ error: "Missing token or text." }, { status: 400 });
    }

    const config = await prisma.petConfig.findUnique({
      where: { token },
    });

    if (!config) {
      return NextResponse.json({ error: "Invalid token." }, { status: 404 });
    }

    const command = enqueueCommand(token, String(text), source || "browser");
    return NextResponse.json({ success: true, command });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
