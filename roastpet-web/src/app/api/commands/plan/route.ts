import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";

function buildClient(apiKey: string) {
  if (apiKey.startsWith("nvapi-")) {
    return {
      client: new OpenAI({
        apiKey,
        baseURL: "https://integrate.api.nvidia.com/v1",
      }),
      model: process.env.NVIDIA_MODEL || "meta/llama-3.1-70b-instruct",
      structured: false,
    };
  }

  return {
    client: new OpenAI({ apiKey }),
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    structured: true,
  };
}

function parseJson(content: string | null) {
  if (!content) throw new Error("Empty model response.");
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    throw new Error("Command planner returned invalid JSON.");
  }
}

export async function POST(request: Request) {
  try {
    const { token, text, context } = await request.json();
    if (!token || !text) {
      return NextResponse.json({ error: "Missing token or text." }, { status: 400 });
    }

    const config = await prisma.petConfig.findUnique({
      where: { token },
    });

    if (!config) {
      return NextResponse.json({ error: "Invalid token." }, { status: 404 });
    }

    const apiKey = config.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          action: "suggest",
          path: "",
          content: "",
          summary: `Remote command received: ${String(text)}. I need an API key on this pet to plan richer code actions.`,
        },
        { status: 200 }
      );
    }

    const { client, model, structured } = buildClient(apiKey);
    const prompt = `You convert a spoken browser command into a local coding action for a desktop AI pet.
The pet can only safely operate inside one project folder. Return strict JSON with this schema:
{
  "action": "create_file" | "write_file" | "edit_file" | "shell_command" | "analyze_repo" | "suggest" | "noop",
  "path": "relative/path/from_project_root or empty string",
  "content": "raw file contents to write, or empty string",
  "command": "shell command to run inside project root or empty string",
  "summary": "very short summary the pet should speak back"
}

Rules:
- If the user asks to create a new file, choose create_file.
- If the user asks to write or replace code in a file, choose write_file.
- If the user asks to update an existing file, choose edit_file and return the full updated file content.
- Use shell_command only for safe project-scoped dev commands like npm scripts, python scripts, tests, or listing/searching files.
- If the user asks for analysis, cleanup ideas, or next steps, choose analyze_repo or suggest.
- Keep paths relative, never absolute.
- If asked to build a website or landing page and no path is given, use "index.html".
- Generate useful starter code when asked for a website/page/component.
- If context includes existing file contents, use it to produce better edits.
- Never suggest destructive commands like deleting folders, resetting git, or formatting drives.
- Do not use markdown fences in content.`;

    const requestBody: OpenAI.Chat.ChatCompletionCreateParams = {
      model,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: `Command: ${String(text)}\n\nProject context:\n${String(context || "No extra context provided.")}` },
      ],
      temperature: 0.3,
    };

    if (structured) {
      requestBody.response_format = { type: "json_object" };
    }

    const response = await client.chat.completions.create(requestBody);
    const parsed = parseJson(response.choices[0]?.message?.content ?? null);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
