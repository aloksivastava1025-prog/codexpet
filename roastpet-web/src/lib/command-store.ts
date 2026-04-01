import fs from "fs";
import path from "path";
import crypto from "crypto";

type StoredCommand = {
  id: string;
  token: string;
  text: string;
  source: string;
  createdAt: string;
  status: "queued" | "picked" | "working" | "done" | "failed" | "canceled";
  statusMessage: string;
  pickedAt?: string;
  completedAt?: string;
};

type StoreShape = {
  commands: StoredCommand[];
};

const STORE_PATH = path.join(process.cwd(), ".pet-commands.json");
const STALE_COMMAND_MS = 60_000;

function refreshStaleCommands(store: StoreShape) {
  const now = Date.now();
  for (const command of store.commands) {
    const pickedAt = command.pickedAt ? new Date(command.pickedAt).getTime() : 0;
    if ((command.status === "picked" || command.status === "working") && pickedAt && now - pickedAt > STALE_COMMAND_MS) {
      command.status = "failed";
      command.statusMessage = "Pet stopped responding while handling this command. Please resend it.";
      command.completedAt = new Date().toISOString();
    }
  }
}

function readStore(): StoreShape {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return { commands: [] };
    }
    const store = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as StoreShape;
    refreshStaleCommands(store);
    return store;
  } catch {
    return { commands: [] };
  }
}

function writeStore(store: StoreShape) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function enqueueCommand(token: string, text: string, source = "browser") {
  const store = readStore();
  const command: StoredCommand = {
    id: crypto.randomUUID(),
    token,
    text,
    source,
    createdAt: new Date().toISOString(),
    status: "queued",
    statusMessage: "Command received. Waiting for your pet to pick it up.",
  };
  store.commands.push(command);
  writeStore(store);
  return command;
}

export function claimNextCommand(token: string) {
  const store = readStore();
  const index = store.commands.findIndex((command) => command.token === token && command.status === "queued");
  if (index === -1) {
    return null;
  }
  const command = store.commands[index];
  command.status = "picked";
  command.statusMessage = "Pet picked up the command.";
  command.pickedAt = new Date().toISOString();
  writeStore(store);
  return command;
}

export function updateCommandStatus(id: string, status: StoredCommand["status"], statusMessage: string) {
  const store = readStore();
  const command = store.commands.find((entry) => entry.id === id);
  if (!command) {
    return null;
  }
  command.status = status;
  command.statusMessage = statusMessage;
  if (status === "done" || status === "failed" || status === "canceled") {
    command.completedAt = new Date().toISOString();
  }
  writeStore(store);
  return command;
}

export function cancelCommand(id: string) {
  const store = readStore();
  const command = store.commands.find((entry) => entry.id === id);
  if (!command) {
    return null;
  }
  if (command.status === "done" || command.status === "failed" || command.status === "canceled") {
    return command;
  }
  command.status = "canceled";
  command.statusMessage = "Command canceled before execution.";
  command.completedAt = new Date().toISOString();
  writeStore(store);
  return command;
}

export function getCommand(id: string) {
  const store = readStore();
  return store.commands.find((entry) => entry.id === id) || null;
}

export function getRecentCommands(token: string, limit = 8) {
  const store = readStore();
  return store.commands
    .filter((entry) => entry.token === token)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}
