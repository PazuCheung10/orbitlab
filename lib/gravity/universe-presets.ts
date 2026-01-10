import { GravityConfig, PhysicsMode } from './config'
import { GRAVITY_CONFIG } from './config'

export interface UniversePreset {
  name: string
  description: string
  config?: Partial<GravityConfig>
  getConfig?: () => Partial<GravityConfig>
}

function hashStringToSeed(input: string): number {
  // Simple deterministic hash -> 32-bit seed
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6D2B79F5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function pick<T>(rng: () => number, items: T[]): T {
  return items[Math.floor(rng() * items.length)]
}

/**
 * Procedurally generate a "universe" starfield.
 * - Deterministic per seed (good for keeping each universe distinct but stable).
 * - Random-looking spatial distribution with mild clustering + ring-ish bias.
 */
export function generateProceduralUniverse(params: {
  width: number
  height: number
  config?: Partial<GravityConfig>
  seed: string | number
  starCount?: number
}): { width: number; height: number; stars: Array<{ x: number; y: number; mass: number }> } {
  const { width, height, config, starCount } = params
  const seedNum = typeof params.seed === 'number' ? params.seed >>> 0 : hashStringToSeed(params.seed)
  const rng = mulberry32(seedNum)

  const minDim = Math.min(width, height)
  const margin = Math.max(6, Math.floor(minDim * 0.06))
  const cx = width / 2
  const cy = height / 2

  const minMass = config?.minMass ?? GRAVITY_CONFIG.minMass
  const maxMass = config?.maxMass ?? GRAVITY_CONFIG.maxMass
  const maxStarsCap = config?.maxStars ?? GRAVITY_CONFIG.maxStars

  // A bit denser for previews, a bit lighter for full-screen
  // Reduce baseline by ~30% for gameplay (user request); thumbnails override starCount explicitly.
  const defaultCountRaw = Math.floor((minDim * minDim) / 14000)
  const defaultCount = clamp(Math.floor(defaultCountRaw * 0.7), 25, 120)
  const n = Math.min(clamp(starCount ?? defaultCount, 12, 220), maxStarsCap)

  // 2-4 cluster centers to create interesting structure
  const clusterCount = pick(rng, [2, 3, 4])
  const clusters = Array.from({ length: clusterCount }, () => {
    const angle = rng() * Math.PI * 2
    const radius = (0.1 + rng() * 0.35) * (minDim / 2)
    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      spread: lerp(minDim * 0.06, minDim * 0.18, rng()),
    }
  })

  const stars: Array<{ x: number; y: number; mass: number }> = []

  // Mass distribution: bias toward lighter stars, few heavy ones
  const sampleMass = () => {
    const u = rng()
    const k = 2.4 // >1 biases toward min
    const t = Math.pow(u, k)
    return lerp(minMass, maxMass, t)
  }

  for (let i = 0; i < n; i++) {
    const mode = pick(rng, ['cluster', 'ring', 'uniform'] as const)

    let x = cx
    let y = cy

    if (mode === 'cluster') {
      const c = pick(rng, clusters)
      // Box-Muller-ish via sum of uniforms (cheap)
      const jitterX = (rng() + rng() + rng() - 1.5) * c.spread
      const jitterY = (rng() + rng() + rng() - 1.5) * c.spread
      x = c.x + jitterX
      y = c.y + jitterY
    } else if (mode === 'ring') {
      const angle = rng() * Math.PI * 2
      const ringR = lerp(minDim * 0.14, minDim * 0.46, rng())
      const jitter = lerp(minDim * 0.0, minDim * 0.06, rng())
      x = cx + Math.cos(angle) * (ringR + (rng() - 0.5) * jitter)
      y = cy + Math.sin(angle) * (ringR + (rng() - 0.5) * jitter)
    } else {
      x = margin + rng() * (width - 2 * margin)
      y = margin + rng() * (height - 2 * margin)
    }

    // Clamp into bounds (important for small preview canvases)
    x = clamp(x, margin, width - margin)
    y = clamp(y, margin, height - margin)

    stars.push({ x, y, mass: sampleMass() })
  }

  return { width, height, stars }
}

export function getPresetConfig(preset: UniversePreset): Partial<GravityConfig> {
  return preset.getConfig ? preset.getConfig() : (preset.config ?? {})
}

// Random universe generator
export function randomizeUniverse(): Partial<GravityConfig> {
  const logUniform = (min: number, max: number): number => {
    const logMin = Math.log10(min)
    const logMax = Math.log10(max)
    return Math.pow(10, logMin + (logMax - logMin) * Math.random())
  }
  
  return {
    physicsMode: Math.random() < 0.5 ? PhysicsMode.ORBIT_PLAYGROUND : PhysicsMode.N_BODY_CHAOS,
    sunMass: 100 + Math.random() * 300, // 100-400
    satellitesAttractEachOther: Math.random() < 0.3, // 30% chance
    
    // Make each random universe meaningfully different
    // Reduced by 30% then 40% then 50% then 20% then decreased by 100 then 150 per request (preserves the shape of the distribution)
    gravityConstant: logUniform(100, 1750),
    softeningEpsPx: logUniform(1, 10),
    maxForceMagnitude: Math.random() < 0.5 ? 0 : logUniform(100, 10000),
    
    flickVmax: 400 + Math.random() * 150,
    flickS0: logUniform(100, 1000),
    
    orbitFactor: 0.7 + Math.random() * 0.6,
    
    launchStrength: 0.6 + Math.random() * 0.6,
    massResistanceFactor: Math.random() * 0.5,
    
    angularGuidanceStrength: Math.random() * 0.8,
    radialClampFactor: Math.random() * 0.7,
    
    radiusScale: 0.7 + Math.random() * 1.6,
    // Mass-radius exponent (visual): 0.3-0.6 gives noticeably different looks
    radiusPower: 0.3 + Math.random() * 0.3,
  }
}

export const UNIVERSE_PRESETS: UniversePreset[] = [
  {
    name: 'Stable Orbits',
    description: 'Perfect circular orbits around central sun',
    config: {
      physicsMode: PhysicsMode.ORBIT_PLAYGROUND,
      sunMass: 200,
      satellitesAttractEachOther: false,
      gravityConstant: 300,
      softeningEpsPx: 1.5,
      maxForceMagnitude: 0,
      orbitFactor: 1.0,
      flickVmax: 550,
      launchStrength: 0.9,
      radiusPower: 0.40,
      radiusScale: 1.15,
    }
  },
  {
    name: 'Elliptical Orbits',
    description: 'Slightly elliptical orbits (orbitFactor < 1.0)',
    config: {
      physicsMode: PhysicsMode.ORBIT_PLAYGROUND,
      sunMass: 250,
      satellitesAttractEachOther: false,
      gravityConstant: 500,
      softeningEpsPx: 3,
      maxForceMagnitude: 0,
      orbitFactor: 0.85,
      flickVmax: 550,
      launchStrength: 0.9,
      radiusPower: 0.36,
      radiusScale: 1.25,
    }
  },
  {
    name: 'Tight Orbits',
    description: 'Fast, close orbits with high gravity',
    config: {
      physicsMode: PhysicsMode.ORBIT_PLAYGROUND,
      sunMass: 300,
      satellitesAttractEachOther: false,
      gravityConstant: 800,
      softeningEpsPx: 1.5,
      maxForceMagnitude: 0,
      orbitFactor: 1.0,
      flickVmax: 550,
      launchStrength: 0.9,
      radiusPower: 0.48,
      radiusScale: 1.05,
    }
  },
  {
    name: 'Wide Orbits',
    description: 'Larger orbital distances with lower gravity',
    config: {
      physicsMode: PhysicsMode.ORBIT_PLAYGROUND,
      sunMass: 150,
      satellitesAttractEachOther: false,
      gravityConstant: 50,
      softeningEpsPx: 1.5,
      maxForceMagnitude: 0,
      orbitFactor: 1.0,
      flickVmax: 550,
      launchStrength: 0.9,
      radiusPower: 0.34,
      radiusScale: 1.35,
    }
  },
  {
    name: 'N-Body Chaos',
    description: 'Full pairwise gravity (chaotic)',
    config: {
      physicsMode: PhysicsMode.N_BODY_CHAOS,
      sunMass: 200,
      satellitesAttractEachOther: true,
      gravityConstant: 600,
      softeningEpsPx: 3,
      maxForceMagnitude: 5000,
      orbitFactor: 1.0,
      flickVmax: 550,
      launchStrength: 0.9,
      radiusPower: 0.52,
      radiusScale: 0.95,
    }
  },
  {
    name: 'Random',
    description: 'Randomly generated universe',
    getConfig: randomizeUniverse
  }
]

