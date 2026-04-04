"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { BODIES, HATS, SPECIES, renderSprite } from "./sprites";

type HatchResponse = {
  success: boolean;
  token: string;
  existingPet?: boolean;
  command: string;
  desktopCommand?: string;
  buddyPrompt?: string;
  voiceProvider?: string;
  voiceId?: string;
  conversationLanguage?: string;
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
    stop?: () => void;
  };
  SpeechRecognition?: new () => {
    lang: string;
    interimResults: boolean;
    maxAlternatives: number;
    onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop?: () => void;
  };
};

type BrowserSpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop?: () => void;
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

type BuddyChatEntry = {
  role: "master" | "buddy";
  text: string;
};

type SavedBuddySession = {
  username: string;
  apiKey: string;
  roastLevel: string;
  buddyPrompt: string;
  voiceProvider: string;
  voiceId: string;
  conversationLanguage: string;
  commandToken: string;
};

type ShareLink = {
  token: string;
  host: string;
  shareUrl: string;
  qrUrl: string;
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
const DEFAULT_BUDDY_PROMPT = "You are a stylish, egoist, friendly, funny coding buddy with smooth confidence and protective loyalty toward your Master. Speak like a cool best friend with elite aura, playful teasing, and real warmth.";
const GOJO_VOICE_ID = "779cb79a-59b0-45c6-b33b-ae46a39809be";
const BUDDY_SESSION_KEY = "codexpet-buddy-session-v1";

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
  const [buddyPrompt, setBuddyPrompt] = useState(DEFAULT_BUDDY_PROMPT);
  const [voiceProvider, setVoiceProvider] = useState("cartesia");
  const [voiceId, setVoiceId] = useState(GOJO_VOICE_ID);
  const [conversationLanguage, setConversationLanguage] = useState("hinglish");
  const [commandToken, setCommandToken] = useState("");
  const [remoteCommand, setRemoteCommand] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatStatus, setChatStatus] = useState("");
  const [chatHistory, setChatHistory] = useState<BuddyChatEntry[]>([]);
  const [lastBuddyAudioUrl, setLastBuddyAudioUrl] = useState("");
  const [buddyEarOn, setBuddyEarOn] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState("");
  const [commandHistory, setCommandHistory] = useState<RemoteCommandStatus[]>([]);
  const [presence, setPresence] = useState<PetPresence | null>(null);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
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
  const buddyRecognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);
  const buddyAudioRef = useRef<HTMLAudioElement | null>(null);
  const buddyProcessingRef = useRef(false);
  const buddyAudioUnlockedRef = useRef(false);

  useEffect(() => {
    setPreview(previewFromUsername(username));
  }, [username]);


  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(BUDDY_SESSION_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as Partial<SavedBuddySession>;
      if (saved.username) setUsername(saved.username);
      if (saved.apiKey) setApiKey(saved.apiKey);
      if (saved.roastLevel) setRoastLevel(saved.roastLevel);
      if (saved.buddyPrompt) setBuddyPrompt(saved.buddyPrompt);
      if (saved.voiceProvider) setVoiceProvider(saved.voiceProvider);
      if (saved.voiceId) setVoiceId(saved.voiceId);
      if (saved.conversationLanguage) setConversationLanguage(saved.conversationLanguage);
      if (saved.commandToken) setCommandToken(saved.commandToken);
      setSessionRestored(true);
    } catch {
      // ignore broken saved session
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: SavedBuddySession = {
      username,
      apiKey,
      roastLevel,
      buddyPrompt,
      voiceProvider,
      voiceId,
      conversationLanguage,
      commandToken,
    };
    window.localStorage.setItem(BUDDY_SESSION_KEY, JSON.stringify(payload));
  }, [username, apiKey, roastLevel, buddyPrompt, voiceProvider, voiceId, conversationLanguage, commandToken]);

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

  useEffect(() => {
    if (!commandToken) {
      setShareLink(null);
      return;
    }
    void (async () => {
      try {
        const response = await fetch(`/api/system/share-url?token=${encodeURIComponent(commandToken)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "QR generation failed");
        setShareLink(data as ShareLink);
      } catch {
        setShareLink(null);
      }
    })();
  }, [commandToken]);

  const sprite = useMemo(() => renderSprite(preview, frame), [preview, frame]);

  async function hatch() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/pets/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, apiKey, roastLevel, buddyPrompt, voiceProvider, voiceId, conversationLanguage }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Hatch failed");
      const hatchData = data as HatchResponse;
      setResult(hatchData);
      setCommandToken(hatchData.token);
      setBuddyPrompt(hatchData.buddyPrompt || buddyPrompt);
      setVoiceProvider(hatchData.voiceProvider || voiceProvider);
      setVoiceId(hatchData.voiceId || voiceId);
      setConversationLanguage(hatchData.conversationLanguage || conversationLanguage);
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


  async function talkToBuddy(messageText: string) {
    const finalText = messageText.trim();
    if (!commandToken || !finalText) return;
    const nextHistory = [...chatHistory.slice(-6), { role: "master" as const, text: finalText }];
    buddyProcessingRef.current = true;
    setChatStatus("Buddy is thinking...");
    setChatHistory((prev) => [...prev, { role: "master", text: finalText }]);
    setChatMessage("");
    try {
      const response = await fetch("/api/companion/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: commandToken, message: finalText, history: nextHistory }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Buddy chat failed");
      setChatHistory((prev) => [...prev, { role: "buddy", text: data.reply as string }]);
      setChatStatus("Buddy replied.");
      await speakBuddyReply(data.reply as string);
    } catch (err) {
      setChatStatus(err instanceof Error ? err.message : "Buddy chat failed");
      buddyProcessingRef.current = false;
      if (buddyEarOn) window.setTimeout(() => startBuddyListeningLoop(), 400);
    }
  }

  async function unlockBuddyAudio() {
    if (buddyAudioUnlockedRef.current) return true;
    try {
      const audio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=");
      audio.muted = true;
      await audio.play();
      audio.pause();
      buddyAudioUnlockedRef.current = true;
      return true;
    } catch {
      return false;
    }
  }

  async function speakBuddyReply(reply: string) {
    if (!commandToken || !reply.trim()) {
      buddyProcessingRef.current = false;
      return;
    }
    try {
      await unlockBuddyAudio();
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: commandToken, text: reply, species: preview.species, mode: "ambient" }),
      });
      if (!response.ok) throw new Error("Voice playback unavailable.");
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      setLastBuddyAudioUrl(audioUrl);
      if (buddyAudioRef.current) buddyAudioRef.current.pause();
      const audio = new Audio(audioUrl);
      audio.playsInline = true;
      buddyAudioRef.current = audio;
      audio.onended = () => {
        buddyProcessingRef.current = false;
        if (buddyEarOn) window.setTimeout(() => startBuddyListeningLoop(), 350);
      };
      audio.onerror = () => {
        setChatStatus("Voice blocked by browser. Use the play bar below once.");
        buddyProcessingRef.current = false;
        if (buddyEarOn) window.setTimeout(() => startBuddyListeningLoop(), 350);
      };
      await audio.play();
    } catch {
      setChatStatus("Buddy replied, but browser blocked voice autoplay. Use the play bar below.");
      buddyProcessingRef.current = false;
      if (buddyEarOn) window.setTimeout(() => startBuddyListeningLoop(), 350);
    }
  }

  async function testBuddyVoice() {
    const unlocked = await unlockBuddyAudio();
    if (!unlocked) {
      setChatStatus("Browser audio unlock failed. Tap again or check site permissions.");
      return;
    }
    setChatStatus("Buddy voice unlocked. Ab text bhejo, awaaz aayegi.");
  }

  function stopBuddyListeningLoop() {
    setBuddyEarOn(false);
    setListening(false);
    buddyProcessingRef.current = false;
    try {
      buddyRecognitionRef.current?.stop();
    } catch {
      // ignore stop failure
    }
    buddyRecognitionRef.current = null;
    setChatStatus("Buddy ears off.");
  }

  function startBuddyListeningLoop() {
    if (!buddyEarOn || buddyProcessingRef.current) return;
    const browserWindow = window as BrowserSpeechWindow;
    const SpeechRecognitionCtor = browserWindow.webkitSpeechRecognition || browserWindow.SpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setChatStatus("This browser does not support in-browser speech recognition.");
      setBuddyEarOn(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    buddyRecognitionRef.current = recognition;
    recognition.lang = conversationLanguage === "english" ? "en-US" : "hi-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setListening(true);
    setChatStatus("Buddy ears on. Bas bolo, Master...");

    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setListening(false);
      if (!transcript.trim()) {
        if (buddyEarOn) window.setTimeout(() => startBuddyListeningLoop(), 250);
        return;
      }
      await talkToBuddy(transcript);
    };

    recognition.onerror = () => {
      setListening(false);
      if (buddyEarOn) window.setTimeout(() => startBuddyListeningLoop(), 700);
    };

    recognition.onend = () => {
      setListening(false);
      if (buddyEarOn && !buddyProcessingRef.current) window.setTimeout(() => startBuddyListeningLoop(), 350);
    };

    recognition.start();
  }

  function toggleBuddyVoiceChat() {
    if (buddyEarOn) {
      stopBuddyListeningLoop();
      return;
    }
    setBuddyEarOn(true);
    window.setTimeout(() => startBuddyListeningLoop(), 150);
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
        {sessionRestored ? <div className="hero-eyebrow" style={{ marginTop: ".8rem" }}>Saved buddy session restored</div> : null}
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
              <div className="hatch-row">
                <select value={voiceProvider} onChange={(e) => setVoiceProvider(e.target.value)}>
                  <option value="cartesia">cartesia</option>
                  <option value="openai">openai</option>
                  <option value="elevenlabs">elevenlabs</option>
                </select>
                <input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="voice id" />
              </div>
              <div className="hatch-row">
                <select value={conversationLanguage} onChange={(e) => setConversationLanguage(e.target.value)}>
                  <option value="hinglish">hinglish</option>
                  <option value="english">english</option>
                  <option value="hindi">hindi</option>
                </select>
                <input value={buddyPrompt} onChange={(e) => setBuddyPrompt(e.target.value)} placeholder="buddy vibe prompt" />
              </div>
              <div className="result" style={{ marginBottom: ".9rem" }}>
                <div className="mono" style={{ color: "var(--amber)", marginBottom: ".5rem" }}>BUDDY SYSTEM PROMPT</div>
                <textarea
                  value={buddyPrompt}
                  onChange={(e) => setBuddyPrompt(e.target.value)}
                  placeholder="Tell your buddy how to behave..."
                  style={{ width: "100%", minHeight: 120, background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, resize: "vertical" }}
                />
                <div style={{ marginTop: ".45rem", color: "var(--text2)" }}>Suggested vibe: stylish egoist, friendly, funny man, elite aura, playful teasing, loyal to Master.</div>
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
                <div style={{ marginTop: ".2rem" }}>Voice: {voiceProvider} ? {voiceId}</div>
                <div style={{ marginTop: ".2rem" }}>Language: {conversationLanguage}</div>
              </div>

              {shareLink ? (
                <div className="result">
                  <div className="mono" style={{ color: "var(--amber)", marginBottom: ".5rem" }}>SCAN TO TALK FROM PHONE</div>
                  <div>Same Wi-Fi pe phone se scan karo. Direct mobile buddy page khulega.</div>
                  <div className="qr-card">
                    <Image src={shareLink.qrUrl} alt="Buddy phone QR" width={220} height={220} className="qr-image" unoptimized />
                    <div className="command" style={{ marginTop: ".85rem" }}>{shareLink.shareUrl}</div>
                    <div style={{ marginTop: ".45rem", color: "var(--text2)", fontSize: "12px" }}>LAN host: {shareLink.host}:3000</div>
                  </div>
                </div>
              ) : null}

              <div className="result">
                <div className="mono" style={{ color: "var(--amber)", marginBottom: ".5rem" }}>TALK TO BUDDY</div>
                <div>Your buddy can listen from the website mic and reply like a friend.</div>
                <div className="hatch-row" style={{ marginTop: ".8rem" }}>
                  <input value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="Talk to your buddy..." onKeyDown={(e) => e.key === "Enter" && talkToBuddy(chatMessage)} />
                  <button className="hatch-btn" onClick={() => talkToBuddy(chatMessage)}>Send</button>
                </div>
                <div className="hatch-row">
                  <button className="hatch-btn" onClick={toggleBuddyVoiceChat}>{buddyEarOn ? "Buddy Ears Off" : "Buddy Ears On"}</button>
                  <button className="hatch-btn" onClick={testBuddyVoice}>Unlock Voice</button>
                </div>
                {chatStatus ? <div className="command">{chatStatus}</div> : null}
                {lastBuddyAudioUrl ? (
                  <div className="command">
                    <div style={{ marginBottom: ".4rem" }}><strong>Voice fallback</strong></div>
                    <audio controls src={lastBuddyAudioUrl} style={{ width: "100%" }} />
                  </div>
                ) : null}
                {chatHistory.length ? (
                  <div className="command">
                    {chatHistory.slice(-6).map((entry, index) => (
                      <div key={`${entry.role}-${index}`} style={{ marginBottom: ".65rem" }}>
                        <strong>{entry.role === "master" ? "Master" : "Buddy"}:</strong> {entry.text}
                      </div>
                    ))}
                  </div>
                ) : null}
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
