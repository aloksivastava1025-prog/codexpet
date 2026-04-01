import fs from "fs";
import path from "path";

type RegistryShape = {
  users: Record<string, string>;
};

const REGISTRY_PATH = path.join(process.cwd(), ".user-pets.json");

function readRegistry(): RegistryShape {
  try {
    if (!fs.existsSync(REGISTRY_PATH)) {
      return { users: {} };
    }
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf-8")) as RegistryShape;
  } catch {
    return { users: {} };
  }
}

function writeRegistry(registry: RegistryShape) {
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), "utf-8");
}

export function getUserPetToken(username: string) {
  const registry = readRegistry();
  return registry.users[username] || null;
}

export function setUserPetToken(username: string, token: string) {
  const registry = readRegistry();
  registry.users[username] = token;
  writeRegistry(registry);
}
