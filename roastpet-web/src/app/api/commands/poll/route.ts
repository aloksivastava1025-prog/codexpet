import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { claimNextCommand } from "@/lib/command-store";

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

    const command = claimNextCommand(token);
    return NextResponse.json({ command });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
