import os from "os";

import { NextResponse } from "next/server";

function isPrivateIpv4(address: string) {
  return (
    address.startsWith("10.") ||
    address.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

function pickLanIp() {
  const interfaces = os.networkInterfaces();
  let fallback = "";

  for (const [name, entries] of Object.entries(interfaces)) {
    if (!entries) continue;
    const lowered = name.toLowerCase();
    if (lowered.includes("vethernet") || lowered.includes("virtual") || lowered.includes("hyper-v")) {
      continue;
    }
    for (const entry of entries) {
      if (entry.family !== "IPv4" || entry.internal) continue;
      if (!fallback) fallback = entry.address;
      if (isPrivateIpv4(entry.address)) {
        return entry.address;
      }
    }
  }

  return fallback || "127.0.0.1";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const hostHeader = request.headers.get("host") || "127.0.0.1:3000";
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const currentHost = hostHeader.split(":")[0];
  const port = hostHeader.split(":")[1] || "3000";
  const lanIp = currentHost === "localhost" || currentHost === "127.0.0.1" ? pickLanIp() : currentHost;
  const shareUrl = `${protocol}://${lanIp}:${port}/buddy/${encodeURIComponent(token)}`;
  const qrUrl = `https://quickchart.io/qr?size=280&text=${encodeURIComponent(shareUrl)}`;

  return NextResponse.json({
    token,
    host: lanIp,
    shareUrl,
    qrUrl,
  });
}
