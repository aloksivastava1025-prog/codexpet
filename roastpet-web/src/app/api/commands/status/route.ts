import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cancelCommand, getCommand, getRecentCommands, updateCommandStatus } from "@/lib/command-store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    const id = searchParams.get("id");

    if (!token && !id) {
      return NextResponse.json({ error: "Missing token or id." }, { status: 400 });
    }

    if (token) {
      const config = await prisma.petConfig.findUnique({
        where: { token },
      });
      if (!config) {
        return NextResponse.json({ error: "Invalid token." }, { status: 404 });
      }
      return NextResponse.json({ commands: getRecentCommands(token) });
    }

    return NextResponse.json({ command: getCommand(String(id)) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { id, status, statusMessage, cancel } = await request.json();
    if (!id) {
      return NextResponse.json({ error: "Missing status payload." }, { status: 400 });
    }

    if (cancel) {
      const canceled = cancelCommand(String(id));
      if (!canceled) {
        return NextResponse.json({ error: "Command not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true, command: canceled });
    }

    if (!status || !statusMessage) {
      return NextResponse.json({ error: "Missing status payload." }, { status: 400 });
    }

    const command = updateCommandStatus(String(id), status, String(statusMessage));
    if (!command) {
      return NextResponse.json({ error: "Command not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, command });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
