import crypto from 'crypto';

const STARTER_POOLS = {
  rookie: ['duck', 'rabbit', 'snail', 'blob'],
  builder: ['cat', 'penguin', 'ghost', 'mushroom'],
  maintainer: ['owl', 'turtle', 'axolotl', 'robot'],
  elite: ['dragon', 'octopus', 'capybara', 'chonk'],
} as const;

const TIER_META = {
  rookie: {
    label: 'Rookie Trainer',
    aura: 'fresh-grass',
    pitch: 'tiny but fearless',
    vibe: 'Your commits are small, your dreams are huge, and your pet is absolutely convinced you are the chosen one.',
  },
  builder: {
    label: 'Builder Class',
    aura: 'spark-badge',
    pitch: 'scrappy gym contender',
    vibe: 'You ship enough to wake the pet world. Your starter arrives with hustle, opinions, and suspicious confidence.',
  },
  maintainer: {
    label: 'Maintainer Ace',
    aura: 'moon-badge',
    pitch: 'calm strategist',
    vibe: 'People already trust your repos, so your starter behaves like a battle-tested partner with zero patience for sloppy code.',
  },
  elite: {
    label: 'Legend Circuit',
    aura: 'solar-badge',
    pitch: 'final-evolution menace',
    vibe: 'You have serious GitHub gravity. Your starter shows up like a champion-tier creature ready to roast bugs on sight.',
  },
} as const;

const HAT_BY_TIER = {
  rookie: 'beanie',
  builder: 'propeller',
  maintainer: 'wizard',
  elite: 'crown',
} as const;

const EYE_BY_TIER = {
  rookie: 'o',
  builder: '^',
  maintainer: '>',
  elite: '*',
} as const;

export type GithubSummary = {
  username: string;
  followers: number;
  following: number;
  publicRepos: number;
  publicGists: number;
  accountAgeYears: number;
  avatarUrl?: string;
  profileUrl?: string;
  exists: boolean;
};

export type StarterAssignment = {
  species: string;
  hat: string;
  eye: string;
  githubTier: keyof typeof TIER_META;
  githubLevel: string;
  score: number;
  starterTitle: string;
  starterFlavor: string;
  voiceStyle: string;
};

export function normalizeUsername(username?: string) {
  return (username || '').trim().replace(/^@/, '');
}

function seededIndex(seed: string, max: number) {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  const num = parseInt(hash.slice(0, 8), 16);
  return num % max;
}

export async function fetchGithubSummary(username: string): Promise<GithubSummary> {
  const normalized = normalizeUsername(username);
  if (!normalized) {
    return {
      username: '',
      followers: 0,
      following: 0,
      publicRepos: 0,
      publicGists: 0,
      accountAgeYears: 0,
      exists: false,
    };
  }

  try {
    const response = await fetch(`https://api.github.com/users/${normalized}`, {
      headers: {
        'User-Agent': 'RoastPet-Web',
        Accept: 'application/vnd.github+json',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        username: normalized,
        followers: 0,
        following: 0,
        publicRepos: 0,
        publicGists: 0,
        accountAgeYears: 0,
        exists: false,
      };
    }

    const data = await response.json();
    const createdAt = data.created_at ? new Date(data.created_at).getTime() : Date.now();
    const ageYears = Math.max(0, (Date.now() - createdAt) / (365.25 * 24 * 60 * 60 * 1000));

    return {
      username: data.login || normalized,
      followers: data.followers || 0,
      following: data.following || 0,
      publicRepos: data.public_repos || 0,
      publicGists: data.public_gists || 0,
      accountAgeYears: Number(ageYears.toFixed(1)),
      avatarUrl: data.avatar_url || undefined,
      profileUrl: data.html_url || undefined,
      exists: true,
    };
  } catch {
    return {
      username: normalized,
      followers: 0,
      following: 0,
      publicRepos: 0,
      publicGists: 0,
      accountAgeYears: 0,
      exists: false,
    };
  }
}

export function assignStarter(username: string, github: GithubSummary): StarterAssignment {
  const score =
    github.publicRepos * 3 +
    github.followers * 2 +
    github.publicGists +
    Math.round(github.accountAgeYears * 6);

  let tier: keyof typeof TIER_META = 'rookie';
  if (score >= 180) tier = 'elite';
  else if (score >= 70) tier = 'maintainer';
  else if (score >= 20) tier = 'builder';

  const pool = STARTER_POOLS[tier];
  const species = pool[seededIndex(`${username}:${tier}:species`, pool.length)];
  const meta = TIER_META[tier];

  return {
    species,
    hat: HAT_BY_TIER[tier],
    eye: EYE_BY_TIER[tier],
    githubTier: tier,
    githubLevel: meta.label,
    score,
    starterTitle: `${meta.label} ${species.charAt(0).toUpperCase() + species.slice(1)}`,
    starterFlavor: meta.vibe,
    voiceStyle: meta.pitch,
  };
}
