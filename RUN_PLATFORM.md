# CodexPet Run Guide

This project has 3 parts:

1. `roastpet-web`
2. `roastpet_cli`
3. local desktop companion + terminal runtime

Use this guide to run the full platform from scratch.

## What The Platform Does

- Website hatches a pet and returns a token
- Desktop pet lives outside the terminal
- Terminal pet is optional debug/work mode
- Browser can send text or voice commands to the pet
- Pet can analyze the repo, create files, update files, and report command status

## Requirements

- Windows
- Python `3.12`
- Node.js `18+`
- npm
- internet connection for GitHub profile lookup and LLM-backed planning

## Folder Overview

- `roastpet-web`: Next.js website and API routes
- `roastpet_cli`: terminal pet and desktop companion
- `RUN_PLATFORM.md`: this file

## Install Web App

From the project root:

```powershell
cd C:\Users\Peeyush\WHATSAPP\pet_agent
cd .\roastpet-web
npm install
```

## Install CLI Dependencies

From the project root:

```powershell
cd C:\Users\Peeyush\WHATSAPP\pet_agent
py -3.12 -m pip install -r .\roastpet_cli\requirements.txt
```

## Database

The web app uses SQLite through Prisma.

Current schema file:

- `roastpet-web/prisma/schema.prisma`

If a local SQLite file does not exist yet, start the web app once and let the local setup create it, or create the Prisma database using your normal Prisma workflow.

## API Keys

You can use:

- OpenAI API key
- NVIDIA-compatible `nvapi-...` key for roast/planning flows

Important:

- AI text planning and roast features need a valid key
- AI voice route may need an OpenAI-compatible audio/TTS key
- without a key, some smart planning features fall back to simpler behavior

## Start The Website

```powershell
cd C:\Users\Peeyush\WHATSAPP\pet_agent\roastpet-web
npm run dev
```

Open:

- [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Hatch A Pet

On the website:

1. enter GitHub username
2. enter API key
3. click `Hatch`

The website returns:

- pet token
- CLI command
- desktop companion command

One user gets one allotted pet. Re-hatching the same user restores the same pet.

## Start The Desktop Pet

Use the token returned by the website:

```powershell
cd C:\Users\Peeyush\WHATSAPP\pet_agent
py -3.12 .\roastpet_cli\desktop_companion.py --token YOUR_TOKEN --backend-url http://127.0.0.1:3000 --dir C:\Users\Peeyush\WHATSAPP\pet_agent
```

What it does:

- shows the desktop pet
- sends heartbeat/presence to the website
- watches for remote commands
- can create or update project files
- can run safe project-scoped shell commands

## Start The Terminal Pet

Optional, but useful for debugging and code roast flow.

Normal mode:

```powershell
cd C:\Users\Peeyush\WHATSAPP\pet_agent
py -3.12 .\roastpet_cli\cli.py --token YOUR_TOKEN --backend-url http://127.0.0.1:3000 --dir C:\Users\Peeyush\WHATSAPP\pet_agent
```

Plain visible mode:

```powershell
cd C:\Users\Peeyush\WHATSAPP\pet_agent
py -3.12 .\roastpet_cli\cli.py --token YOUR_TOKEN --backend-url http://127.0.0.1:3000 --dir C:\Users\Peeyush\WHATSAPP\pet_agent --plain
```

Use `--plain` if the rich UI is not clearly visible in your terminal.

## How Remote Commands Work

In the website `REMOTE COMPANION COMMANDS` section:

1. enter token
2. type a command or click `Speak Command`
3. if using voice:
   - transcript is captured
   - LLM cleans Hindi / Hinglish / English transcript
   - you confirm before sending
4. pet picks the command and executes it locally

Examples:

- `notes me ek todo file banao`
- `update instructions.txt and add 3 short steps`
- `promo.html naam ka landing page banao`
- `is project ko analyze karo aur batao kya improve karna hai`

## Command Status Meanings

On the website:

- `QUEUED`: command received
- `PICKED`: pet picked it up
- `WORKING`: pet is planning or executing
- `DONE`: command completed
- `FAILED`: command failed or got stuck
- `CANCELED`: command was canceled manually

## Pet Presence Status

The website `PET STATUS` panel shows:

- whether the pet is online
- which surface is active
- the last heartbeat note from the desktop pet

If it says the pet is offline:

1. confirm website is running
2. confirm desktop companion is running with the same token
3. relaunch the desktop companion

## Desktop Pet Controls

Right-click the pet for:

- `Pet`
- `Ask`
- `Scout Repo`
- `Meme`
- `Open Terminal`
- `Voice Mode`
- `Speaker Surface`
- `Stop My Pets`

## Safe Scope

The pet agent is intended to operate inside the project directory given by `--dir`.

It should:

- read files in the project
- update project files
- create files in the project
- run safe project-scoped commands

It should not:

- run destructive system commands
- write outside the project root

## Recommended Startup Order

1. start web app
2. hatch pet
3. start desktop pet
4. optionally start terminal pet
5. send commands from the website

## Troubleshooting

### Pet is not visible

- check website `PET STATUS`
- relaunch desktop companion
- look near the lower-right part of the screen first

### Command did not run

- check command history on the website
- if it is `QUEUED`, the pet has not picked it up yet
- if it is `WORKING`, wait a few seconds
- if it is `FAILED`, resend or simplify the command

### Voice command is wrong

- use the confirm step before send
- discard the transcript if it looks bad
- try short Hindi / Hinglish phrases

### Terminal UI looks broken

- use:

```powershell
py -3.12 .\roastpet_cli\cli.py --token YOUR_TOKEN --backend-url http://127.0.0.1:3000 --dir C:\Users\Peeyush\WHATSAPP\pet_agent --plain
```

## Suggested Daily Use

1. keep website running
2. keep desktop pet running
3. use website for voice/text commands
4. use terminal pet only when you want debug-style visibility

## Current Main Entry Points

- website: `roastpet-web/src/app/page.tsx`
- roast API: `roastpet-web/src/app/api/roast/route.ts`
- command planner: `roastpet-web/src/app/api/commands/plan/route.ts`
- desktop pet: `roastpet_cli/desktop_companion.py`
- terminal pet: `roastpet_cli/cli.py`
