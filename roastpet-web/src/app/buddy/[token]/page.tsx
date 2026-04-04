"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type BrowserSpeechWindow = Window & {
  webkitSpeechRecognition?: new () => BrowserSpeechRecognitionInstance;
  SpeechRecognition?: new () => BrowserSpeechRecognitionInstance;
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

type ChatEntry = {
  role: "master" | "buddy";
  text: string;
};

type PetConfig = {
  token: string;
  species: string;
  buddyPrompt?: string;
  voiceProvider?: string;
  voiceId?: string;
  conversationLanguage?: string;
};

export default function BuddyPhonePage() {
  const params = useParams<{ token: string }>();
  const token = useMemo(() => String(params?.token || ""), [params]);
  const [config, setConfig] = useState<PetConfig | null>(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Buddy is getting ready...");
  const [earOn, setEarOn] = useState(false);
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [lastAudioUrl, setLastAudioUrl] = useState("");
  const [voiceReady, setVoiceReady] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognitionInstance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const processingRef = useRef(false);
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const response = await fetch(`/api/pets/${encodeURIComponent(token)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Buddy config load failed");
        setConfig(data as PetConfig);
        setStatus("Buddy is online on your phone.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Buddy config load failed");
      }
    })();
  }, [token]);

  async function unlockAudio() {
    if (audioUnlockedRef.current) return true;
    try {
      const audio = audioRef.current ?? new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=");
      audio.muted = true;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audioUnlockedRef.current = true;
      setVoiceReady(true);
      return true;
    } catch {
      return false;
    }
  }

  async function speakReply(reply: string) {
    if (!token || !reply.trim()) {
      processingRef.current = false;
      return;
    }
    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          text: reply,
          species: config?.species || "cat",
          mode: "ambient",
        }),
      });
      if (!response.ok) throw new Error("Voice unavailable");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setLastAudioUrl(url);
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.pause();
      audio.src = url;
      audio.currentTime = 0;
      audio.playsInline = true;
      audio.preload = "auto";
      audio.load();
      audio.onended = () => {
        processingRef.current = false;
        setStatus("Gojo bol chuka. Phir se kuch likho ya bolo.");
        if (earOn) window.setTimeout(() => startListeningLoop(), 300);
      };
      audio.onerror = () => {
        setStatus("Phone audio blocked ya failed. Ek baar Test Voice dabao.");
        processingRef.current = false;
        if (earOn) window.setTimeout(() => startListeningLoop(), 300);
      };
      await audio.play();
      setStatus("Gojo is speaking...");
    } catch {
      setStatus("Phone browser ne audio autoplay block kar diya. Pehle Test Voice ya Start Ears dabao.");
      processingRef.current = false;
      if (earOn) window.setTimeout(() => startListeningLoop(), 300);
    }
  }

  async function talkToBuddy(text: string) {
    const finalText = text.trim();
    if (!token || !finalText) return;
    const nextHistory = [...history.slice(-6), { role: "master" as const, text: finalText }];
    processingRef.current = true;
    setStatus("Buddy is thinking...");
    setHistory((prev) => [...prev, { role: "master", text: finalText }]);
    setMessage("");
    try {
      const response = await fetch("/api/companion/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          message: finalText,
          history: nextHistory,
          context: "Master is talking from the phone buddy page. Keep it short and natural.",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Buddy chat failed");
      setHistory((prev) => [...prev, { role: "buddy", text: data.reply as string }]);
      setStatus("Buddy replied. Voice nikal raha hoon...");
      await speakReply(String(data.reply || ""));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Buddy chat failed");
      processingRef.current = false;
      if (earOn) window.setTimeout(() => startListeningLoop(), 400);
    }
  }

  function stopListeningLoop() {
    setEarOn(false);
    processingRef.current = false;
    try {
      recognitionRef.current?.stop?.();
    } catch {
      // ignore
    }
    recognitionRef.current = null;
    setStatus("Phone ears off.");
  }

  function recognitionLanguage() {
    const language = String(config?.conversationLanguage || "hinglish").toLowerCase();
    if (language === "english") return "en-US";
    return "hi-IN";
  }

  function startListeningLoop() {
    if (!earOn || processingRef.current) return;
    const browserWindow = window as BrowserSpeechWindow;
    const SpeechRecognitionCtor = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setStatus("This phone browser does not support mic recognition.");
      setEarOn(false);
      return;
    }
    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.lang = recognitionLanguage();
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setStatus("Listening... just talk naturally.");

    recognition.onresult = async (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
      if (!transcript) {
        if (earOn) window.setTimeout(() => startListeningLoop(), 250);
        return;
      }
      await talkToBuddy(transcript);
    };

    recognition.onerror = () => {
      if (earOn && !processingRef.current) {
        setStatus("Mic hiccup. Trying again...");
        window.setTimeout(() => startListeningLoop(), 500);
      }
    };

    recognition.onend = () => {
      if (earOn && !processingRef.current) {
        window.setTimeout(() => startListeningLoop(), 350);
      }
    };

    recognition.start();
  }

  function togglePhoneEars() {
    if (earOn) {
      stopListeningLoop();
      return;
    }
    void (async () => {
      setStatus("Trying to turn buddy ears on...");
      await unlockAudio();
      setEarOn(true);
      window.setTimeout(() => startListeningLoop(), 150);
    })();
  }

  function testVoice() {
    void (async () => {
      const unlocked = await unlockAudio();
      if (!unlocked) {
        setStatus("Audio unlock nahi hua. Browser permission ya silent mode check karo.");
        return;
      }
      setStatus("Voice unlocked. Gojo ab phone par bolega.");
      await speakReply("Yo Master, phone voice check. Main yahin hoon.");
    })();
  }

  return (
    <main className="phone-shell">
      <section className="phone-card">
        <div className="phone-badge">Buddy Mobile Link</div>
        <h1 className="phone-title">{config?.species ? `${config.species} buddy is with you` : "Buddy mobile mode"}</h1>
        <p className="phone-sub">
          Phone se seedha baat karo. Short replies, same personality, same voice.
        </p>

        <div className="phone-status">{status}</div>

        <div className="phone-actions">
          <button type="button" className="phone-primary" onClick={togglePhoneEars} style={{ touchAction: "manipulation" }}>
            {earOn ? "Stop Ears" : "Start Ears"}
          </button>
          <button type="button" className="phone-ghost" onClick={() => void talkToBuddy(message)} style={{ touchAction: "manipulation" }}>
            Send
          </button>
        </div>

        <div className="phone-actions" style={{ marginTop: ".75rem" }}>
          <button type="button" className="phone-ghost" onClick={testVoice} style={{ touchAction: "manipulation" }}>
            Test Voice
          </button>
          <button type="button" className="phone-ghost" onClick={() => setStatus("Tip: phone silent mode off rakho, aur mobile mic mostly HTTPS par best chalta hai.")} style={{ touchAction: "manipulation" }}>
            Help
          </button>
        </div>

        <div className="phone-input-wrap">
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Buddy, mera mood off hai. Ab kya karu?"
            rows={3}
          />
        </div>

        <div className="phone-meta">
          <div>Language: {config?.conversationLanguage || "hinglish"}</div>
          <div>Voice: {config?.voiceProvider || "cartesia"}</div>
          <div>Voice ready: {voiceReady ? "yes" : "not unlocked yet"}</div>
          <div>Best browser: Chrome mobile</div>
          <div>Mic note: some phones block speech recognition on plain HTTP.</div>
        </div>

        <audio
          ref={(node) => {
            if (node) audioRef.current = node;
          }}
          style={{ display: "none" }}
          playsInline
          preload="auto"
        />

        {lastAudioUrl ? (
          <div className="phone-meta">
            <div style={{ marginBottom: ".45rem" }}>Manual voice fallback</div>
            <audio controls src={lastAudioUrl} playsInline preload="auto" style={{ width: "100%" }} />
          </div>
        ) : null}

        <div className="phone-chat">
          {history.length ? history.slice(-8).map((entry, index) => (
            <div key={`${entry.role}-${index}`} className={`phone-line ${entry.role}`}>
              <strong>{entry.role === "master" ? "You" : "Buddy"}</strong>
              <span>{entry.text}</span>
            </div>
          )) : (
            <div className="phone-empty">Start ears and just talk. No website juggling needed.</div>
          )}
        </div>
      </section>
    </main>
  );
}
