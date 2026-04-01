import fs from "fs";
import path from "path";

type PresenceEntry = {
  token: string;
  species: string;
  surface: string;
  lastSeenAt: string;
  status: string;
};

type PresenceShape = {
  pets: Record<string, PresenceEntry>;
};

const STORE_PATH = path.join(process.cwd(), ".pet-presence.json");

function readStore(): PresenceShape {
  try {
    if (!fs.existsSync(STORE_PATH)) {
      return { pets: {} };
    }
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf-8")) as PresenceShape;
  } catch {
    return { pets: {} };
  }
}

function writeStore(store: PresenceShape) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function updatePresence(token: string, species: string, surface: string, status: string) {
  const store = readStore();
  store.pets[token] = {
    token,
    species,
    surface,
    status,
    lastSeenAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.pets[token];
}

export function getPresence(token: string) {
  const store = readStore();
  const pet = store.pets[token];
  if (!pet) return null;
  const ageMs = Date.now() - new Date(pet.lastSeenAt).getTime();
  return {
    ...pet,
    online: ageMs < 15_000,
  };
}
