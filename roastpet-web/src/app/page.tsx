"use client";

import { useEffect, useMemo, useState } from "react";
import { BODIES, HATS, SPECIES, renderSprite } from "./sprites";

type HatchResponse = {
  success: boolean;
  token: string;
  existingPet?: boolean;
  command: string;
  desktopCommand?: string;
  starter: {
    species: string;
    hat: string;
    eye: string;
    githubLevel: string;
    starterTitle: string;
    starterFlavor: string;
    score: number;
  };
};

type PreviewPet = {
  species: string;
  hat: string;
  eye: string;
  rarity: number;
  shiny: boolean;
  name: string;
  stats: number[];
  topStatIdx: number;
};

type BrowserSpeechWindow = Window & {
  webkitSpeechRecognition?: new () => {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
  };
  SpeechRecognition?: new () => {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
  };
};

type RemoteCommandStatus = {
  id: string;
  text: string;
  status: "queued" | "picked" | "working" | "done" | "failed" | "canceled";
  statusMessage: string;
  createdAt: string;
};

type PetPresence = {
  token: string;
  species: string;
  surface: string;
  lastSeenAt: string;
  status: string;
  online: boolean;
};

const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
const STAT_NAMES = ["DEBUGGING", "PATIENCE", "CHAOS", "WISDOM", "SNARK"];
const STAT_COLORS = ["#378add", "#1d9e75", "#d85a30", "#7f77dd", "#d4537e"];
const EYES = ["·", "o", "*", "@", "^", "~", "•", "x"];
const NAMES = ["Pixel", "Glitch", "Null", "Hexie", "Bugsy", "Nano", "Luma", "Fizz", "Chip", "Flux", "Zap", "Patch"];
const QUIPS = [
  "Waiting for your next commit...",
  "undefined is not a feeling.",
  "git blame says it was you.",
  "Your code smells like talent.",
  "Compiling happiness...",
];
const ASK_LINES = [
  "Should you refactor? Yes. Dramatically.",
  "That 400-line function is probably load-bearing now.",
  "Stack Overflow is just shared trauma with snippets.",
  "Your best bug fix is still ahead of you, trainer.",
];

function hash(input: string) {
  let value = 5381;
  for (let i = 0; i < input.length; i += 1) value = ((value << 5) + value) ^ input.charCodeAt(i);
  return Math.abs(value);
}

function seeded(seed: string, key: string) {
  return (hash(seed + key) % 1000) / 1000;
}

function previewFromUsername(username: string): PreviewPet {
  const seed = username.toLowerCase().trim() || "default";
  const rarity = seeded(seed, "rarity") < 0.01 ? 4 : seeded(seed, "rarity") < 0.05 ? 3 : seeded(seed, "rarity") < 0.15 ? 2 : seeded(seed, "rarity") < 0.4 ? 1 : 0;
  const pool = SPECIES.slice(0, Math.max(6, Math.min(SPECIES.length, 6 + rarity * 3)));
  const species = pool[Math.floor(seeded(seed, "species") * pool.length)] || "duck";
  const hatKeys = Object.keys(HATS);
  const hat = rarity === 0 ? "none" : hatKeys[Math.floor(seeded(seed, "hat") * hatKeys.length)] || "none";
  const eye = EYES[Math.floor(seeded(seed, "eye") * EYES.length)] || "o";
  const stats = STAT_NAMES.map((stat) => Math.floor(seeded(seed, stat) * 99) + 1);
  return {
    species,
    hat,
    eye,
    rarity,
    shiny: seeded(seed, "shiny") < 0.01,
    name: NAMES[Math.floor(seeded(seed, "name") * NAMES.length)] || "Pixel",
    stats,
    topStatIdx: stats.indexOf(Math.max(...stats)),
  };
}

export default function Page() {
  const [username, setUsername] = useState("devuser42");
  const [apiKey, setApiKey] = useState("");
  const [roastLevel, setRoastLevel] = useState("chaotic");
  const [commandToken, setCommandToken] = useState("");
  const [remoteCommand, setRemoteCommand] = useState("");
  const [remoteStatus, setRemoteStatus] = useState("");
  const [commandHistory, setCommandHistory] = useState<RemoteCommandStatus[]>([]);
  const [presence, setPresence] = useState<PetPresence | null>(null);
  const [listening, setListening] = useState(false);
  const [pendingVoiceCommand, setPendingVoiceCommand] = useState("");
  const [rawTranscript, setRawTranscript] = useState("");
  const [preview, setPreview] = useState<PreviewPet>(() => previewFromUsername("devuser42"));
  const [bubble, setBubble] = useState(QUIPS[0]);
  const [result, setResult] = useState<HatchResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [anim, setAnim] = useState(false);
  const [frame, setFrame] = useState(0);
  const [askIndex, setAskIndex] = useState(0);

  useEffect(() => {
    setPreview(previewFromUsername(username));
  }, [username]);

  useEffect(() => {
    if (!anim) {
      setFrame(0);
      return;
    }
    const timer = window.setInterval(() => {
      setFrame((prev) => (prev + 1) % (BODIES[preview.species]?.length || 1));
    }, 440);
    return () => window.clearInterval(timer);
  }, [anim, preview.species]);

  useEffect(() => {
    if (!commandToken) return;
    const timer = window.setInterval(async () => {
      try {
        const [statusResponse, presenceResponse] = await Promise.all([
          fetch(`/api/commands/status?token=${encodeURIComponent(commandToken)}`),
          fetch(`/api/pets/presence?token=${encodeURIComponent(commandToken)}`),
        ]);
        const statusData = await statusResponse.json();
        const presenceData = await presenceResponse.json();
        if (statusResponse.ok) {
          setCommandHistory((statusData.commands || []) as RemoteCommandStatus[]);
        }
        if (presenceResponse.ok) {
          setPresence((presenceData.presence || null) as PetPresence | null);
        }
      } catch {
        // ignore polling hiccups
      }
    }, 2500);
    return () => window.clearInterval(timer);
  }, [commandToken]);

  const sprite = useMemo(() => renderSprite(preview, frame), [preview, frame]);

  async function hatch() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, apiKey, roastLevel }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Hatch failed");
      const hatchData = data as HatchResponse;
      setResult(hatchData);
      setCommandToken(hatchData.token);
      setPreview((prev) => ({
        ...prev,
        species: hatchData.starter.species,
        hat: hatchData.starter.hat,
        eye: hatchData.starter.eye,
      }));
      setBubble(hatchData.starter.starterFlavor);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hatch failed");
    } finally {
      setLoading(false);
    }
  }

  async function sendRemoteCommand(text: string) {
    const finalText = text.trim();
    if (!commandToken || !finalText) return;
    setRemoteStatus("Sending remote command...");
    try {
      const response = await fetch("/api/commands/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: commandToken, text: finalText, source: "browser-voice" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send command");
      setRemoteStatus("Command sent. Pet will pick it up in a few seconds.");
      setCommandHistory((prev) => [data.command as RemoteCommandStatus, ...prev].slice(0, 8));
      setRemoteCommand("");
    } catch (err) {
      setRemoteStatus(err instanceof Error ? err.message : "Failed to send command");
    }
  }

  async function cancelRemoteCommand(id: string) {
    try {
      const response = await fetch("/api/commands/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, cancel: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Cancel failed");
      setRemoteStatus("Command canceled.");
      setCommandHistory((prev) => prev.map((entry) => (entry.id === id ? (data.command as RemoteCommandStatus) : entry)));
    } catch (err) {
      setRemoteStatus(err instanceof Error ? err.message : "Cancel failed");
    }
  }

  async function interpretTranscript(transcript: string) {
    const response = await fetch("/api/commands/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: commandToken, transcript }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Interpretation failed");
    return data as { cleanedCommand: string; detectedLanguage: string; confidence: number };
  }

  function startVoiceCommand() {
    const browserWindow = window as BrowserSpeechWindow;
    const SpeechRecognitionCtor = browserWindow.webkitSpeechRecognition || browserWindow.SpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setRemoteStatus("This browser does not support in-browser speech recognition.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);
    setRemoteStatus("Listening in Hindi / Hinglish / English...");

    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setListening(false);
      setRawTranscript(transcript);
      setRemoteStatus(`Heard: ${transcript}`);
      if (!transcript.trim()) return;
      try {
        const interpreted = await interpretTranscript(transcript);
        setPendingVoiceCommand(interpreted.cleanedCommand || transcript);
        setRemoteCommand(interpreted.cleanedCommand || transcript);
        setRemoteStatus(`Heard: ${transcript} | Cleaned: ${interpreted.cleanedCommand}`);
      } catch (err) {
        setPendingVoiceCommand(transcript);
        setRemoteCommand(transcript);
        setRemoteStatus(err instanceof Error ? err.message : `Heard: ${transcript}`);
      }
    };

    recognition.onerror = () => {
      setListening(false);
      setRemoteStatus("Voice capture failed. Try again or type the command.");
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.start();
  }

  return (
    <>
      <nav>
        <div className="nav-logo">DevCompanion_</div>
        <div className="nav-links">
          <a href="#app">Hatch</a>
          <a href="#how">How it works</a>
          <a href="#rarities">Rarities</a>
        </div>
        <a href="#app" className="nav-cta">Get yours →</a>
      </nav>

      <section className="hero">
        <div className="hero-grid"></div>
        <div className="hero-glow"></div>
        <div className="eyebrow">April 2026 — Now hatching</div>
        <h1>Your deterministic<br /><em>coding buddy</em></h1>
        <p className="hero-sub">Website se token milega. Terminal me run karoge to wahi exact pet open hoga aur saare real companion kaam waha karega.</p>
        <div className="hero-actions">
          <a href="#app"><button className="btn btn-primary">Hatch your companion ↗</button></a>
          <a href="#how"><button className="btn btn-ghost">How it works</button></a>
        </div>
        <div className="hero-sprites">
          {["duck", "dragon", "axolotl", "ghost", "mushroom"].map((sp) => (
            <div key={sp} className="hero-sprite-card"><pre>{renderSprite({ species: sp, eye: "·", hat: "none" }, frame)}</pre></div>
          ))}
        </div>
      </section>

      <div className="strip">
        <div className="strip-inner">
          {[..."18 SPECIES|DETERMINISTIC SEED|TOKEN TO TERMINAL FLOW|AI VOICE PET|MEME REACTIONS|REAL COMPANION LOOP|YOUR USERNAME = YOUR FATE|GITHUB POWERED STARTERS|18 SPECIES|DETERMINISTIC SEED|TOKEN TO TERMINAL FLOW|AI VOICE PET|MEME REACTIONS|REAL COMPANION LOOP|YOUR USERNAME = YOUR FATE|GITHUB POWERED STARTERS".split("|")].map((item, index) => (
            <span className="strip-item" key={`${item}-${index}`}><span className="strip-dot"></span>{item}</span>
          ))}
        </div>
      </div>

      <section className="app-section" id="app">
        <div className="container">
          <div className="app-layout">
            <div>
              <div className="section-label">Hatch Yours</div>
              <h2 className="section-title">Enter your username</h2>
              <div className="hatch-row">
                <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="github username or any seed..." onKeyDown={(e) => e.key === "Enter" && hatch()} />
                <button className="hatch-btn" onClick={hatch} disabled={loading}>{loading ? "Hatching..." : "Hatch ↗"}</button>
              </div>
              <div className="hatch-row">
                <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="AI API key for roast + voice" />
                <select value={roastLevel} onChange={(e) => setRoastLevel(e.target.value)}>
                  <option value="gentle">gentle</option>
                  <option value="sarcastic">sarcastic</option>
                  <option value="chaotic">chaotic</option>
                  <option value="boss-battle">boss-battle</option>
                </select>
              </div>

              <div className="comp-card">
                <div className="card-top">
                  <div className="sprite-wrap">
                    <pre className="sprite-pre">{sprite}</pre>
                    <div className="bubble">{bubble}</div>
                  </div>
                  <div className="info">
                    <div className="name-row">
                      <span className="card-name">{preview.name}</span>
                      <span className="badge" style={{ background: "rgba(255,255,255,0.05)", color: "#e8e4d8" }}>{`${"★".repeat(preview.rarity + 1)} ${RARITIES[preview.rarity]}`}</span>
                      {preview.shiny ? <span className="badge" style={{ background: "rgba(240,160,53,.15)", color: "#f0a035" }}>✦ Shiny</span> : null}
                    </div>
                    <div className="species-row">{preview.species} · eye: &quot;{preview.eye}&quot;</div>
                    <div className="stats">
                      {preview.stats.map((value, index) => (
                        <div className="stat-r" key={STAT_NAMES[index]}>
                          <span className="stat-lbl">{STAT_NAMES[index]}</span>
                          <div className="bar-bg"><div className="bar-fg" style={{ width: `${value}%`, background: STAT_COLORS[index] }}></div></div>
                          <span className="stat-n">{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="hat-sel">
                      {Object.keys(HATS).map((hatKey) => (
                        <button key={hatKey} className={`hat-btn ${preview.hat === hatKey ? "active" : ""}`} onClick={() => setPreview((prev) => ({ ...prev, hat: hatKey }))}>{hatKey}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="card-actions">
                  <button className="act-btn" onClick={() => setBubble(QUIPS[Math.floor(Math.random() * QUIPS.length)] || QUIPS[0])}>Pet ♥</button>
                  <button className="act-btn" onClick={() => { setBubble(ASK_LINES[askIndex % ASK_LINES.length] || ASK_LINES[0]); setAskIndex((prev) => prev + 1); }}>Ask</button>
                  <button className="act-btn" onClick={() => setAnim((prev) => !prev)}>{anim ? "Stop ◼" : "Animate"}</button>
                  <button className="act-btn" onClick={() => setUsername(Math.random().toString(36).slice(2, 10))}>Random</button>
                </div>
              </div>

              {error ? <div className="error">{error}</div> : null}
              {result ? (
                <div className="result">
                  <div className="mono" style={{ color: "var(--amber)", marginBottom: ".5rem" }}>TOKEN HATCHED</div>
                  <div>{result.existingPet ? "Existing allotted pet restored." : "Fresh pet allotted."}</div>
                  <div>{result.starter.starterTitle} · {result.starter.githubLevel}</div>
                  <div style={{ marginTop: ".45rem" }}>{result.starter.starterFlavor}</div>
                  <div style={{ marginTop: ".45rem" }}>Token: <strong>{result.token}</strong></div>
                  <div style={{ marginTop: ".45rem" }}>GitHub aura score: <strong>{result.starter.score}</strong></div>
                  <div className="command">{result.command}</div>
                  {result.desktopCommand ? <div className="command" style={{ marginTop: ".5rem" }}>{result.desktopCommand}</div> : null}
                </div>
              ) : null}

              <div className="result">
                <div className="mono" style={{ color: "var(--amber)", marginBottom: ".5rem" }}>PET STATUS</div>
                <div>{presence?.online ? "Pet is online on your screen." : "Pet is offline or not connected yet."}</div>
                <div style={{ marginTop: ".4rem" }}>Surface: {presence?.surface || "unknown"}</div>
                <div style={{ marginTop: ".2rem" }}>Last note: {presence?.status || "No heartbeat yet."}</div>
              </div>

              <div className="result">
                <div className="mono" style={{ color: "var(--amber)", marginBottom: ".5rem" }}>REMOTE COMPANION COMMANDS</div>
                <div>Browser se bolo ya type karo. Pet token ke through project me kaam karega.</div>
                <div className="hatch-row" style={{ marginTop: ".8rem" }}>
                  <input value={commandToken} onChange={(e) => setCommandToken(e.target.value)} placeholder="pet token" />
                </div>
                <div className="hatch-row">
                  <input value={remoteCommand} onChange={(e) => setRemoteCommand(e.target.value)} placeholder="create a new file called notes/todo.md" onKeyDown={(e) => e.key === "Enter" && sendRemoteCommand(remoteCommand)} />
                  <button className="hatch-btn" onClick={() => sendRemoteCommand(remoteCommand)}>Send</button>
                </div>
                <div className="hatch-row">
                  <button className="hatch-btn" onClick={startVoiceCommand}>{listening ? "Listening..." : "Speak Command"}</button>
                </div>
                {pendingVoiceCommand ? (
                  <div className="command">
                    <div><strong>Voice confirmation required</strong></div>
                    <div style={{ marginTop: ".35rem" }}>Raw: {rawTranscript}</div>
                    <div style={{ marginTop: ".35rem" }}>Cleaned: {pendingVoiceCommand}</div>
                    <div className="hatch-row" style={{ marginTop: ".8rem", marginBottom: 0 }}>
                      <button className="hatch-btn" onClick={() => { void sendRemoteCommand(pendingVoiceCommand); setPendingVoiceCommand(""); setRawTranscript(""); }}>Confirm And Send</button>
                      <button className="hatch-btn" onClick={() => { setPendingVoiceCommand(""); setRawTranscript(""); setRemoteStatus("Voice command discarded."); }}>Discard</button>
                    </div>
                  </div>
                ) : null}
                <div style={{ marginTop: ".45rem" }}>
                  Examples: `notes me ek todo file banao`, `promo.html naam ka landing page banao`, `is project ko analyze karo aur batao kya improve karna hai`
                </div>
                {remoteStatus ? <div className="command">{remoteStatus}</div> : null}
                {commandHistory.length ? (
                  <div className="command">
                    {commandHistory.map((entry) => (
                      <div key={entry.id} style={{ marginBottom: ".7rem", paddingBottom: ".7rem", borderBottom: "1px solid var(--border)" }}>
                        <div><strong>{entry.status.toUpperCase()}</strong></div>
                        <div>{entry.text}</div>
                        <div style={{ color: "var(--text3)", marginTop: ".2rem" }}>{entry.statusMessage}</div>
                        {["queued", "picked", "working"].includes(entry.status) ? (
                          <div style={{ marginTop: ".45rem" }}>
                            <button className="hatch-btn" onClick={() => cancelRemoteCommand(entry.id)}>Cancel</button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="metrics-row">
                <div className="metric"><div className="metric-v">{preview.species.slice(0, 6)}</div><div className="metric-l">SPECIES</div></div>
                <div className="metric"><div className="metric-v">{RARITIES[preview.rarity].slice(0, 6)}</div><div className="metric-l">RARITY</div></div>
                <div className="metric"><div className="metric-v">{STAT_NAMES[preview.topStatIdx].slice(0, 5)}</div><div className="metric-l">TOP STAT</div></div>
                <div className="metric"><div className="metric-v">{BODIES[preview.species]?.length || 0}</div><div className="metric-l">FRAMES</div></div>
              </div>

              <div className="section-label">All 18 Species — Click To Adopt</div>
              <div className="gallery-grid">
                {SPECIES.map((sp) => (
                  <div key={sp} className="g-item" onClick={() => setUsername(`${sp}_fan`)}>
                    <pre className="g-pre">{renderSprite({ species: sp, eye: "o", hat: "none" }, 0)}</pre>
                    <div className="g-name">{sp}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="info-panel">
              <div className="info-box"><div className="info-label">Determinism</div><div className="info-title">Same seed, same companion. Always.</div><div className="info-body">Tumhara preview deterministic hai. Real pet backend pe token ke saath save hota hai, aur terminal wahi exact pet open karta hai.</div></div>
              <div className="info-box"><div className="info-label">Token Flow</div><div className="info-title">Website hatches. Terminal lives.</div><div className="info-body">Ye page hatch lab hai. Yaha token milega. Terminal me command run karte hi wahi pet roast, meme reaction aur AI voice behavior ke saath khul jayega.</div></div>
              <div className="info-box"><div className="info-label">Personality</div><div className="info-title">They have opinions.</div><div className="info-body">Ask preview sirf mood dikhata hai. Real companion loop terminal me chalega, jaha pet code dekhega aur react karega.</div></div>
            </div>
          </div>
        </div>
      </section>

      <section id="how">
        <div className="container">
          <div className="section-label">How It Works</div>
          <h2 className="section-title">Built on token, pet config, and terminal flow</h2>
          <p className="section-sub">Website creates the token. Terminal opens the exact same companion.</p>
          <div className="how-grid">
            <div className="how-card"><div className="mono" style={{ marginBottom: ".5rem" }}>01</div><div>Hatch on web with username + API key.</div></div>
            <div className="how-card"><div className="mono" style={{ marginBottom: ".5rem" }}>02</div><div>Get token and CLI command from this page.</div></div>
            <div className="how-card"><div className="mono" style={{ marginBottom: ".5rem" }}>03</div><div>Run token in terminal and let the real pet do the work there.</div></div>
          </div>
        </div>
      </section>

      <section className="rarity-table-section" id="rarities">
        <div className="container">
          <div className="section-label">Rarities</div>
          <h2 className="section-title">Five tiers. One legendary.</h2>
          <p className="section-sub">Design vibe same rakhi hai, but now it feeds a real token-to-terminal companion flow.</p>
          <div className="rarity-cards">
            {RARITIES.map((rarity, index) => (
              <div key={rarity} className={`rar-card rar-${index}`}>
                <div className="mono" style={{ marginBottom: ".5rem" }}>{"★".repeat(index + 1)}</div>
                <div>{rarity}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stats-section">
        <div className="container">
          <div className="section-label">The Five Stats</div>
          <h2 className="section-title">What kind of dev are you?</h2>
          <div className="stats-explainer">
            {STAT_NAMES.map((stat, index) => (
              <div key={stat} className="stat-card">
                <div className="mono" style={{ color: STAT_COLORS[index], marginBottom: ".5rem" }}>{stat}</div>
                <div style={{ color: "var(--text2)" }}>Your companion uses this stat profile as part of its vibe and identity.</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="container">
          <div className="section-label">Claim Yours</div>
          <h2 className="section-title">Your companion is already waiting.</h2>
          <p className="section-sub">This page hatches the token. The terminal opens the real pet. That is where the whole platform comes alive.</p>
          <div className="cta-term"><span style={{ color: "var(--amber)" }}>token flow:</span> website → token → terminal pet → code roasting + AI voice + meme reactions</div>
        </div>
      </section>

      <footer>
        <div>DevCompanion — built for developers who want a real terminal pet</div>
        <div style={{ display: "flex", gap: "1.5rem" }}><a href="#app">hatch</a><a href="#how">docs</a><a href="https://github.com">github</a></div>
      </footer>
    </>
  );
}
