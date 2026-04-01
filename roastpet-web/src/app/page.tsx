"use client";

import { useState } from 'react';
import { BODIES, HATS, SPECIES, renderSprite } from './sprites';



export default function Dashboard() {
  const [species, setSpecies] = useState('duck');
  const [roastLevel, setRoastLevel] = useState('sarcastic');
  const [apiKey, setApiKey] = useState('');
  const [hat, setHat] = useState('none');
  const [eye, setEye] = useState('o');
  const [command, setCommand] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/pets/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ species, roastLevel, apiKey, hat, eye })
      });
      const data = await res.json();
      if (data.token) {
        setCommand(`cd .. && pip install -e ./roastpet_cli && python -m roastpet_cli --token ${data.token}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const spritePreview = renderSprite({ species, eye, hat }, 0);

  return (
    <>
      <style jsx global>{`
        :root {
          --bg: #0d0d0d;
          --surface: #141414;
          --surface2: #1c1c1c;
          --border: #2a2a2a;
          --border2: #383838;
          --text: #e8e4d8;
          --text2: #8a8678;
          --text3: #504e48;
          --amber: #f0a035;
          --amber2: #c47a18;
          --amber-dim: #2a1f0a;
          --green: #3ecf6e;
          --green-dim: #0a1f12;
          --blue: #5599ee;
          --pink: #e0608a;
          --purple: #9b87e8;
          --font-mono: 'Berkeley Mono', monospace;
          --font-body: 'DM Sans', sans-serif;
          --font-serif: 'Instrument Serif', serif;
          --r: 8px;
          --r2: 14px;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: var(--bg); color: var(--text); font-family: var(--font-body); font-size: 15px; line-height: 1.6; overflow-x: hidden; }
        ::selection { background: var(--amber); color: #000; }
        a { color: inherit; text-decoration: none; }

        nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 100;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 2rem;
          border-bottom: 0.5px solid var(--border);
          background: rgba(13, 13, 13, 0.85);
          backdrop-filter: blur(12px);
        }
        .nav-logo { font-family: var(--font-mono); font-size: 14px; color: var(--amber); letter-spacing: .05em; }
        .nav-links { display: flex; gap: 1.5rem; font-size: 13px; color: var(--text2); }
        .nav-links a:hover { color: var(--text); }
        .nav-cta {
          font-size: 13px;
          padding: 6px 14px;
          border: 0.5px solid var(--amber);
          border-radius: var(--r);
          color: var(--amber);
          cursor: pointer;
          transition: all .2s;
          background: transparent;
        }
        .nav-cta:hover { background: var(--amber); color: #000; }

        .hero {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 5rem 1.5rem 4rem;
          position: relative;
          overflow: hidden;
        }
        .hero-grid {
          position: absolute;
          inset: 0;
          background-image: linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px);
          background-size: 60px 60px;
          opacity: .25;
          pointer-events: none;
        }
        .hero-glow {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(240, 160, 53, .07) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -60%);
          pointer-events: none;
        }
        .hero-eyebrow {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: .15em;
          color: var(--amber);
          border: 0.5px solid var(--amber-dim);
          background: var(--amber-dim);
          padding: 4px 12px;
          border-radius: 20px;
          margin-bottom: 1.5rem;
          display: inline-block;
        }
        .hero h1 {
          font-family: var(--font-serif);
          font-size: clamp(2.8rem, 7vw, 5.5rem);
          font-weight: 400;
          line-height: 1.1;
          margin-bottom: 1.25rem;
          letter-spacing: -.01em;
        }
        .hero h1 em { font-style: italic; color: var(--amber); }
        .hero-sub {
          font-size: 16px;
          color: var(--text2);
          max-width: 480px;
          line-height: 1.7;
          margin-bottom: 2.5rem;
        }
        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 3.5rem;
        }
        .btn-primary {
          padding: 11px 24px;
          background: var(--amber);
          color: #000;
          border: none;
          border-radius: var(--r);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all .2s;
        }
        .btn-primary:hover { background: #e8941f; transform: translateY(-1px); }
        .btn-ghost {
          padding: 11px 24px;
          background: transparent;
          color: var(--text);
          border: 0.5px solid var(--border2);
          border-radius: var(--r);
          font-family: var(--font-body);
          font-size: 14px;
          cursor: pointer;
          transition: all .2s;
        }
        .btn-ghost:hover { border-color: var(--text2); background: var(--surface); }

        .hero-sprites {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
          opacity: .7;
        }
        .hero-sprite-card {
          background: var(--surface);
          border: 0.5px solid var(--border);
          border-radius: var(--r);
          padding: 10px 14px;
        }
        .hero-sprite-card pre {
          font-family: var(--font-mono);
          font-size: 9px;
          line-height: 1.45;
          color: var(--text2);
          white-space: pre;
        }

        .strip {
          border-top: 0.5px solid var(--border);
          border-bottom: 0.5px solid var(--border);
          background: var(--surface);
          padding: 12px 0;
          overflow: hidden;
          position: relative;
        }
        .strip-inner {
          display: flex;
          gap: 2.5rem;
          white-space: nowrap;
          animation: marquee 28s linear infinite;
        }
        .strip-item {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text3);
          letter-spacing: .08em;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .strip-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--amber);
          flex-shrink: 0;
        }
        @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

        section { padding: 5rem 1.5rem; }
        .container { max-width: 1040px; margin: 0 auto; }
        .section-label {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: .12em;
          color: var(--amber);
          margin-bottom: .75rem;
        }
        .section-title {
          font-family: var(--font-serif);
          font-size: clamp(1.8rem, 4vw, 2.8rem);
          font-weight: 400;
          line-height: 1.2;
          margin-bottom: 1rem;
        }
        .section-sub {
          font-size: 15px;
          color: var(--text2);
          max-width: 520px;
          line-height: 1.7;
        }

        .app-section { background: var(--surface); border-top: 0.5px solid var(--border); border-bottom: 0.5px solid var(--border); }
        .app-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; align-items: start; }
        @media (max-width: 700px) { .app-layout { grid-template-columns: 1fr; } }

        .hatch-row { display: flex; gap: 8px; margin-bottom: 1.25rem; }
        .hatch-row input {
          flex: 1;
          height: 38px;
          padding: 0 14px;
          font-size: 14px;
          font-family: var(--font-mono);
          border: 0.5px solid var(--border2);
          border-radius: var(--r);
          background: var(--surface2);
          color: var(--text);
          outline: none;
          transition: border-color .2s;
        }
        .hatch-row input:focus { border-color: var(--amber); }
        .hatch-row input::placeholder { color: var(--text3); }
        .hatch-btn {
          height: 38px;
          padding: 0 18px;
          font-size: 13px;
          font-weight: 500;
          border: 0.5px solid var(--amber);
          border-radius: var(--r);
          background: transparent;
          color: var(--amber);
          cursor: pointer;
          transition: all .2s;
          white-space: nowrap;
        }
        .hatch-btn:hover { background: var(--amber); color: #000; }

        .comp-card {
          background: var(--bg);
          border: 0.5px solid var(--border);
          border-radius: var(--r2);
          padding: 1.25rem;
          margin-bottom: 1rem;
        }
        .card-top { display: flex; gap: 1.25rem; align-items: flex-start; }
        .sprite-wrap {
          position: relative;
          text-align: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .sprite-pre {
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.5;
          color: var(--text);
          background: var(--surface2);
          border-radius: var(--r);
          padding: 10px 14px;
          display: inline-block;
          min-width: 130px;
          white-space: pre;
          user-select: none;
          border: 0.5px solid var(--border);
          transition: border-color .2s;
        }
        .sprite-wrap:hover .sprite-pre { border-color: var(--amber); }
        .hearts {
          position: absolute;
          top: -4px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 13px;
          color: var(--pink);
          opacity: 0;
          transition: opacity .3s, top .5s;
          pointer-events: none;
        }
        .hearts.pop { opacity: 1; top: -22px; }
        .bubble {
          font-size: 11.5px;
          color: var(--text2);
          font-style: italic;
          text-align: center;
          margin-top: 6px;
          min-height: 28px;
          max-width: 140px;
          line-height: 1.4;
          font-family: var(--font-mono);
        }
        .info { flex: 1; min-width: 0; }
        .name-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
        .cname { font-size: 20px; font-family: var(--font-serif); font-weight: 400; color: var(--text); }
        .badge {
          font-size: 10px;
          padding: 2px 7px;
          border-radius: 4px;
          font-weight: 500;
          font-family: var(--font-mono);
          letter-spacing: .04em;
        }
        .shiny-badge { background: rgba(240, 160, 53, .15); color: var(--amber); border: 0.5px solid rgba(240, 160, 53, .3); }
        .species-row { font-size: 12px; color: var(--text2); margin-bottom: 10px; font-family: var(--font-mono); }
        .stats { display: flex; flex-direction: column; gap: 5px; }
        .stat-r { display: flex; align-items: center; gap: 7px; }
        .stat-lbl { font-size: 9px; font-weight: 500; color: var(--text3); width: 72px; letter-spacing: .06em; font-family: var(--font-mono); }
        .bar-bg { flex: 1; height: 4px; background: var(--border); border-radius: 2px; overflow: hidden; }
        .bar-fg { height: 100%; border-radius: 2px; transition: width .8s ease; }
        .stat-n { font-size: 10px; color: var(--text2); width: 22px; text-align: right; font-family: var(--font-mono); }
        .hat-sel { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 10px; }
        .hat-btn {
          font-size: 10px;
          padding: 3px 8px;
          border: 0.5px solid var(--border2);
          border-radius: var(--r);
          background: transparent;
          color: var(--text3);
          cursor: pointer;
          font-family: var(--font-mono);
          transition: all .15s;
        }
        .hat-btn:hover { color: var(--text); border-color: var(--border2); }
        .hat-btn.active { border-color: var(--amber); color: var(--amber); background: var(--amber-dim); }
        .card-actions { display: flex; gap: 6px; margin-top: 1rem; flex-wrap: wrap; }
        .act-btn {
          flex: 1;
          min-width: 56px;
          height: 32px;
          font-size: 12px;
          border: 0.5px solid var(--border2);
          border-radius: var(--r);
          background: transparent;
          color: var(--text2);
          cursor: pointer;
          font-family: var(--font-body);
          transition: all .15s;
        }
        .act-btn:hover { border-color: var(--border2); color: var(--text); background: var(--surface2); }
        .act-btn:active { transform: scale(.97); }

        .metrics-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 1rem; }
        .metric {
          background: var(--surface2);
          border-radius: var(--r);
          padding: 10px;
          text-align: center;
          border: 0.5px solid var(--border);
        }
        .metric-v { font-size: 14px; font-weight: 500; color: var(--text); font-family: var(--font-mono); }
        .metric-l { font-size: 9px; color: var(--text3); margin-top: 2px; letter-spacing: .05em; font-family: var(--font-mono); }

        .gallery-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 6px; }
        @media (max-width: 500px) { .gallery-grid { grid-template-columns: repeat(4, 1fr); } }
        .g-item {
          background: var(--surface2);
          border-radius: var(--r);
          padding: 7px 5px;
          text-align: center;
          cursor: pointer;
          border: 0.5px solid var(--border);
          transition: all .15s;
        }
        .g-item:hover { border-color: var(--amber); background: var(--amber-dim); }
        .g-pre {
          font-family: var(--font-mono);
          font-size: 6px;
          line-height: 1.45;
          color: var(--text2);
          white-space: pre;
        }
        .g-name {
          font-size: 8.5px;
          color: var(--text3);
          margin-top: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: .04em;
        }

        .info-panel { display: flex; flex-direction: column; gap: 1.5rem; padding-top: .5rem; }
        .info-block-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: .1em;
          color: var(--text3);
          margin-bottom: .5rem;
        }
        .info-block-title {
          font-family: var(--font-serif);
          font-size: 1.4rem;
          line-height: 1.25;
          margin-bottom: .5rem;
          color: var(--text);
        }
        .info-block-body { font-size: 13px; color: var(--text2); line-height: 1.7; }
        .rarity-list { display: flex; flex-direction: column; gap: 6px; margin-top: .75rem; }
        .rarity-row { display: flex; align-items: center; gap: 10px; }
        .rarity-star { font-family: var(--font-mono); font-size: 11px; width: 80px; color: var(--amber); }
        .rarity-bar-bg { flex: 1; height: 4px; background: var(--border); border-radius: 2px; }
        .rarity-bar-fill { height: 100%; border-radius: 2px; background: var(--amber); }
        .rarity-pct { font-family: var(--font-mono); font-size: 10px; color: var(--text3); width: 32px; text-align: right; }

        .how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 2.5rem; }
        @media (max-width: 640px) { .how-grid { grid-template-columns: 1fr; } }
        .how-card {
          background: var(--surface);
          border: 0.5px solid var(--border);
          border-radius: var(--r2);
          padding: 1.5rem;
          position: relative;
          overflow: hidden;
        }
        .how-card::before {
          content: attr(data-n);
          position: absolute;
          right: 1rem;
          top: 1rem;
          font-family: var(--font-mono);
          font-size: 40px;
          color: var(--border);
          font-weight: 700;
          line-height: 1;
        }
        .how-icon { font-family: var(--font-mono); font-size: 24px; margin-bottom: .75rem; display: block; }
        .how-title { font-size: 15px; font-weight: 500; margin-bottom: .4rem; color: var(--text); }
        .how-body { font-size: 13px; color: var(--text2); line-height: 1.65; }

        .rarity-table-section { background: var(--surface); border-top: 0.5px solid var(--border); border-bottom: 0.5px solid var(--border); }
        .rarity-cards { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 2rem; }
        @media (max-width: 700px) { .rarity-cards { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 400px) { .rarity-cards { grid-template-columns: repeat(2, 1fr); } }
        .rar-card { border-radius: var(--r); padding: 1rem; text-align: center; border: 0.5px solid var(--border); }
        .rar-stars { font-family: var(--font-mono); font-size: 12px; margin-bottom: 6px; }
        .rar-name { font-size: 12px; font-weight: 500; margin-bottom: 4px; }
        .rar-chance { font-family: var(--font-mono); font-size: 10px; color: var(--text3); }
        .rar-0 { background: var(--surface2); }
        .rar-1 { background: var(--green-dim); border-color: #0f3d20; }
        .rar-1 .rar-stars { color: var(--green); }
        .rar-2 { background: #0d1829; border-color: #1a3a5c; }
        .rar-2 .rar-stars { color: var(--blue); }
        .rar-3 { background: #160f2e; border-color: #2e1f6e; }
        .rar-3 .rar-stars { color: var(--purple); }
        .rar-4 { background: #1e1300; border-color: #4a3000; }
        .rar-4 .rar-stars { color: var(--amber); }

        .stats-section { padding: 5rem 1.5rem; }
        .stats-explainer { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-top: 2rem; }
        @media (max-width: 640px) { .stats-explainer { grid-template-columns: 1fr; } }
        .stat-card {
          background: var(--surface);
          border: 0.5px solid var(--border);
          border-radius: var(--r2);
          padding: 1.25rem;
        }
        .stat-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: .5rem; }
        .stat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .stat-card-name { font-family: var(--font-mono); font-size: 11px; letter-spacing: .08em; font-weight: 500; }
        .stat-card-body { font-size: 13px; color: var(--text2); line-height: 1.6; }

        .cta-section {
          text-align: center;
          padding: 6rem 1.5rem;
          position: relative;
          overflow: hidden;
        }
        .cta-glow {
          position: absolute;
          width: 500px;
          height: 300px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(240, 160, 53, .08) 0%, transparent 70%);
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .cta-section .section-title { margin-bottom: .75rem; }
        .cta-section .section-sub { margin: 0 auto 2rem; text-align: center; }
        .cta-term {
          font-family: var(--font-mono);
          font-size: 13px;
          color: var(--text3);
          margin-top: 2rem;
          border-top: 0.5px solid var(--border);
          padding-top: 2rem;
        }
        .cta-term span { color: var(--amber); }

        footer {
          border-top: 0.5px solid var(--border);
          padding: 1.5rem 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text3);
          font-family: var(--font-mono);
        }
        footer a { color: var(--text3); transition: color .15s; }
        footer a:hover { color: var(--amber); }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .fade-up { animation: fadeUp .6s ease both; }
        .delay-1 { animation-delay: .1s; }
        .delay-2 { animation-delay: .2s; }
        .delay-3 { animation-delay: .3s; }
        .delay-4 { animation-delay: .4s; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
        .cursor { animation: blink 1.1s step-end infinite; color: var(--amber); }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--bg); }
        ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text3); }
      `}</style>

      <nav>
        <div className="nav-logo">RoastPet<span className="cursor">_</span></div>
        <div className="nav-links">
          <a href="#app">Hatch</a>
          <a href="#how">How it works</a>
          <a href="#rarities">Rarities</a>
        </div>
        <a href="#app" className="nav-cta">Get yours</a>
      </nav>

      <section className="hero">
        <div className="hero-grid"></div>
        <div className="hero-glow"></div>
        <div className="hero-eyebrow fade-up">April 2026 &mdash; Now hatching</div>
        <h1 className="fade-up delay-1">Your sarcastic<br/><em>coding roaster</em></h1>
        <p className="hero-sub fade-up delay-2">Enter your username. Get a unique AI companion that watches your code, roasts your mistakes, fixes your bugs, and levels up as you improve. No rerolls. No mercy.</p>
        <div className="hero-actions fade-up delay-3">
          <a href="#app"><button className="btn-primary">Hatch your RoastPet</button></a>
          <a href="#how"><button className="btn-ghost">How it works</button></a>
        </div>
        <div className="hero-sprites fade-up delay-4">
          {/* Hero sprites */}
          <div className="hero-sprite-card"><pre>{renderSprite({ species: 'duck', eye: '·', hat: 'none' }, 0)}</pre></div>
          <div className="hero-sprite-card"><pre>{renderSprite({ species: 'dragon', eye: '·', hat: 'none' }, 0)}</pre></div>
          <div className="hero-sprite-card"><pre>{renderSprite({ species: 'axolotl', eye: '·', hat: 'none' }, 0)}</pre></div>
          <div className="hero-sprite-card"><pre>{renderSprite({ species: 'ghost', eye: '·', hat: 'none' }, 0)}</pre></div>
          <div className="hero-sprite-card"><pre>{renderSprite({ species: 'mushroom', eye: '·', hat: 'none' }, 0)}</pre></div>
        </div>
      </section>

      <div className="strip">
        <div className="strip-inner">
          <span className="strip-item"><span className="strip-dot"></span>18 SPECIES</span>
          <span className="strip-item"><span className="strip-dot"></span>DETERMINISTIC SEED</span>
          <span className="strip-item"><span className="strip-dot"></span>5 RPG STATS</span>
          <span className="strip-item"><span className="strip-dot"></span>AI CODE ROASTING</span>
          <span className="strip-item"><span className="strip-dot"></span>1% LEGENDARY</span>
          <span className="strip-item"><span className="strip-dot"></span>MEME SOUNDS</span>
          <span className="strip-item"><span className="strip-dot"></span>XP LEVELING</span>
          <span className="strip-item"><span className="strip-dot"></span>7 HAT STYLES</span>
          <span className="strip-item"><span className="strip-dot"></span>AUTO CODE FIX</span>
          <span className="strip-item"><span className="strip-dot"></span>YOUR USERNAME = YOUR FATE</span>
        </div>
      </div>

      <section className="app-section" id="app">
        <div className="container">
          <div className="app-layout">
            <div>
              <div className="section-label">// hatch yours</div>
              <h2 className="section-title" style={{ marginBottom: '1.5rem' }}>Enter your username</h2>
              <div className="hatch-row">
                <input id="uInput" placeholder="github username or any seed..." defaultValue="devuser42" />
                <button className="hatch-btn" onClick={handleGenerate}>Hatch</button>
              </div>
              <div className="comp-card">
                <div className="card-top">
                  <div className="sprite-wrap">
                    <pre className="sprite-pre">{spritePreview}</pre>
                    <div className="hearts">♥ ♥</div>
                    <div className="bubble">Waiting for your next commit...</div>
                  </div>
                  <div className="info">
                    <div className="name-row">
                      <span className="cname">Your Pet</span>
                      <span className="badge">★ Common</span>
                    </div>
                    <div className="species-row">{species.charAt(0).toUpperCase() + species.slice(1)} · eye: "{eye}"</div>
                    <div className="stats">
                      {/* Placeholder stats */}
                      <div className="stat-r"><span className="stat-lbl">DEBUGGING</span><div className="bar-bg"><div className="bar-fg" style={{ width: '50%', background: '#378add' }}></div></div><span className="stat-n">50</span></div>
                      <div className="stat-r"><span className="stat-lbl">PATIENCE</span><div className="bar-bg"><div className="bar-fg" style={{ width: '60%', background: '#1d9e75' }}></div></div><span className="stat-n">60</span></div>
                      <div className="stat-r"><span className="stat-lbl">CHAOS</span><div className="bar-bg"><div className="bar-fg" style={{ width: '40%', background: '#d85a30' }}></div></div><span className="stat-n">40</span></div>
                      <div className="stat-r"><span className="stat-lbl">WISDOM</span><div className="bar-bg"><div className="bar-fg" style={{ width: '70%', background: '#7f77dd' }}></div></div><span className="stat-n">70</span></div>
                      <div className="stat-r"><span className="stat-lbl">SNARK</span><div className="bar-bg"><div className="bar-fg" style={{ width: '80%', background: '#d4537e' }}></div></div><span className="stat-n">80</span></div>
                    </div>
                    <div className="hat-sel">
                      {Object.keys(HATS).map((h) => (
                        <button key={h} className={`hat-btn ${hat === h ? 'active' : ''}`} onClick={() => setHat(h)}>{h}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="card-actions">
                  <button className="act-btn">Pet</button>
                  <button className="act-btn">Ask</button>
                  <button className="act-btn">Animate</button>
                  <button className="act-btn">Random</button>
                </div>
              </div>
              <div className="metrics-row">
                <div className="metric"><div className="metric-v">{species.slice(0, 6)}</div><div className="metric-l">SPECIES</div></div>
                <div className="metric"><div className="metric-v">Common</div><div className="metric-l">RARITY</div></div>
                <div className="metric"><div className="metric-v">SNARK</div><div className="metric-l">TOP STAT</div></div>
                <div className="metric"><div className="metric-v">3</div><div className="metric-l">FRAMES</div></div>
              </div>
              <div className="section-label" style={{ marginBottom: '8px' }}>// all 18 species - click to adopt</div>
              <div className="gallery-grid">
                {SPECIES.map((sp) => (
                  <div key={sp} className="g-item" onClick={() => setSpecies(sp)}>
                    <pre className="g-pre">{renderSprite({ species: sp, eye: 'o', hat: 'none' }, 0)}</pre>
                    <div className="g-name">{sp}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="info-panel">
              <div className="info-block">
                <div className="info-block-label">// determinism</div>
                <div className="info-block-title">Same seed, same roaster. Always.</div>
                <div className="info-block-body">Your RoastPet is generated from a hash of your username. It's permanent, unfakeable, and always yours. Same name in 10 years = same duck roasting your code.</div>
              </div>
              <div className="info-block">
                <div className="info-block-label">// rarity drop rates</div>
                <div className="info-block-title">Real scarcity. No gacha.</div>
                <div className="rarity-list">
                  <div className="rarity-row"><span className="rarity-star">★</span><div className="rarity-bar-bg"><div className="rarity-bar-fill" style={{ width: '60%' }}></div></div><span className="rarity-pct">60%</span><span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '4px' }}>Common</span></div>
                  <div className="rarity-row"><span className="rarity-star">★★</span><div className="rarity-bar-bg"><div className="rarity-bar-fill" style={{ width: '25%' }}></div></div><span className="rarity-pct">25%</span><span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '4px' }}>Uncommon</span></div>
                  <div className="rarity-row"><span className="rarity-star">★★★</span><div className="rarity-bar-bg"><div className="rarity-bar-fill" style={{ width: '10%' }}></div></div><span className="rarity-pct">10%</span><span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '4px' }}>Rare</span></div>
                  <div className="rarity-row"><span className="rarity-star">★★★★</span><div className="rarity-bar-bg"><div className="rarity-bar-fill" style={{ width: '4%' }}></div></div><span className="rarity-pct">4%</span><span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '4px' }}>Epic</span></div>
                  <div className="rarity-row"><span className="rarity-star">★★★★★</span><div className="rarity-bar-bg"><div className="rarity-bar-fill" style={{ width: '1%' }}></div></div><span className="rarity-pct">1%</span><span style={{ fontSize: '11px', color: 'var(--text3)', marginLeft: '4px' }}>Legendary</span></div>
                </div>
              </div>
              <div className="info-block">
                <div className="info-block-label">// xp & leveling</div>
                <div className="info-block-title">Write good code. Level up.</div>
                <div className="info-block-body">Every time you save a file, your RoastPet analyzes it via AI. Good code earns XP (+50 to +100). Bad code loses XP (-30). Level up your pet by actually improving as a developer.</div>
              </div>
              <div className="info-block">
                <div className="info-block-label">// personality</div>
                <div className="info-block-title">They have <em>opinions.</em></div>
                <div className="info-block-body">Your pet roasts your code, plays meme sounds through your speakers, and offers to auto-fix your mistakes. Write <code># @roastpet</code> in any file to summon it directly.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="how">
        <div className="container">
          <div className="section-label">// how it works</div>
          <h2 className="section-title">Built on hash, roast, and shame</h2>
          <p className="section-sub">Three steps. Your pet watches, judges, and fixes your code.</p>
          <div className="how-grid">
            <div className="how-card" data-n="01">
              <span className="how-icon">#</span>
              <div className="how-title">Hatch on the web</div>
              <div className="how-body">Enter your username, customize your pet's species and hat. The dashboard generates a unique token and a CLI command you paste into your terminal.</div>
            </div>
            <div className="how-card" data-n="02">
              <span className="how-icon">&gt;_</span>
              <div className="how-title">Run the CLI daemon</div>
              <div className="how-body">The Python CLI watches your codebase in real-time using watchdog. Every file save triggers an AI analysis through your secure backend. No API keys exposed locally.</div>
            </div>
            <div className="how-card" data-n="03">
              <span className="how-icon">!!!</span>
              <div className="how-title">Get roasted. Get fixed.</div>
              <div className="how-body">Your pet roasts your code, plays meme sounds (bruh, womp, emotional damage), and offers the corrected version. Press Y to auto-apply the fix. Earn or lose XP.</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rarity-table-section" id="rarities">
        <div className="container">
          <div className="section-label">// rarities</div>
          <h2 className="section-title">Five tiers. One legendary.</h2>
          <p className="section-sub">Rarity is determined by your hash. Not by paying, not by grinding.</p>
          <div className="rarity-cards">
            <div className="rar-card rar-0"><div className="rar-stars">★</div><div className="rar-name" style={{ color: 'var(--text2)' }}>Common</div><div className="rar-chance">60% chance</div><div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px', lineHeight: '1.5' }}>No hat. Honest work.</div></div>
            <div className="rar-card rar-1"><div className="rar-stars">★★</div><div className="rar-name" style={{ color: 'var(--green)' }}>Uncommon</div><div className="rar-chance">25% chance</div><div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px', lineHeight: '1.5' }}>Hat unlocked. Higher stats.</div></div>
            <div className="rar-card rar-2"><div className="rar-stars">★★★</div><div className="rar-name" style={{ color: 'var(--blue)' }}>Rare</div><div className="rar-chance">10% chance</div><div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px', lineHeight: '1.5' }}>Great stats. Worth flexing.</div></div>
            <div className="rar-card rar-3"><div className="rar-stars">★★★★</div><div className="rar-name" style={{ color: 'var(--purple)' }}>Epic</div><div className="rar-chance">4% chance</div><div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px', lineHeight: '1.5' }}>Exceptional. Post it.</div></div>
            <div className="rar-card rar-4"><div className="rar-stars">★★★★★</div><div className="rar-name" style={{ color: 'var(--amber)' }}>Legendary</div><div className="rar-chance">1% chance</div><div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '8px', lineHeight: '1.5' }}>You didn't earn it. But you have it.</div></div>
          </div>
        </div>
      </section>

      <section className="stats-section">
        <div className="container">
          <div className="section-label">// the five stats</div>
          <h2 className="section-title">What kind of dev are you?</h2>
          <p className="section-sub">Each pet has one peak, one dump, and three scattered stats.</p>
          <div className="stats-explainer">
            <div className="stat-card"><div className="stat-card-header"><div className="stat-dot" style={{ background: '#378add' }}></div><span className="stat-card-name" style={{ color: '#378add' }}>DEBUGGING</span></div><div className="stat-card-body">High DEBUGGING means you read V8 source for fun. Low means console.log until it stops yelling.</div></div>
            <div className="stat-card"><div className="stat-card-header"><div className="stat-dot" style={{ background: '#1d9e75' }}></div><span className="stat-card-name" style={{ color: '#1d9e75' }}>PATIENCE</span></div><div className="stat-card-body">Your relationship with 2-hour CI pipelines and stakeholders who want "just a small change."</div></div>
            <div className="stat-card"><div className="stat-card-header"><div className="stat-dot" style={{ background: '#d85a30' }}></div><span className="stat-card-name" style={{ color: '#d85a30' }}>CHAOS</span></div><div className="stat-card-body">Push to main. YOLO deploys on Fridays. 400-line functions. High CHAOS makes things happen.</div></div>
            <div className="stat-card"><div className="stat-card-header"><div className="stat-dot" style={{ background: '#7f77dd' }}></div><span className="stat-card-name" style={{ color: '#7f77dd' }}>WISDOM</span></div><div className="stat-card-body">The one who's seen it fail before. Knows which tech debt is load-bearing.</div></div>
            <div className="stat-card" style={{ gridColumn: '1/-1', maxWidth: '320px' }}><div className="stat-card-header"><div className="stat-dot" style={{ background: '#d4537e' }}></div><span className="stat-card-name" style={{ color: '#d4537e' }}>SNARK</span></div><div className="stat-card-body">Code review tone. Whether your pet says "interesting approach" or "this will not scale."</div></div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-glow"></div>
        <div className="container">
          <div className="section-label">// claim yours</div>
          <h2 className="section-title">Your RoastPet is already waiting.</h2>
          <p className="section-sub">It's been a deterministic function of your username this whole time.</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#app"><button className="btn-primary">Hatch your RoastPet</button></a>
          </div>
          <div className="cta-term"><span>// run locally:</span> cd roastpet_cli && python cli.py --token YOUR_TOKEN</div>
        </div>
      </section>

      <footer>
        <div>RoastPet AI &mdash; built for developers who can take a joke</div>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <a href="#app">hatch</a>
          <a href="#how">docs</a>
          <a href="https://github.com">github</a>
        </div>
      </footer>
    </>
  );
}
