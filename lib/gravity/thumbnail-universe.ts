import { generateProceduralUniverse } from './universe-presets'

export type ProceduralUniverse = ReturnType<typeof generateProceduralUniverse>

/**
 * Thumbnail-only post-process:
 * randomly pick 2–5 stars and multiply their mass by 2x (excluding the heaviest star by default),
 * so each thumbnail run has a few standout bodies.
 */
export function applyRandomMassBoost(
  universe: ProceduralUniverse,
  opts?: {
    boostFactor?: number
    minCount?: number
    maxCount?: number
    excludeHeaviest?: boolean
  }
): ProceduralUniverse {
  const stars = universe.stars
  if (stars.length === 0) return universe

  const boostFactor = opts?.boostFactor ?? 2
  const minCount = opts?.minCount ?? 2
  const maxCount = opts?.maxCount ?? 5
  const excludeHeaviest = opts?.excludeHeaviest ?? true

  // Find heaviest star (usually the "center-ish" one in previews).
  let heaviestIdx = 0
  for (let i = 1; i < stars.length; i++) {
    if (stars[i].mass > stars[heaviestIdx].mass) heaviestIdx = i
  }

  const candidates: number[] = []
  for (let i = 0; i < stars.length; i++) {
    if (excludeHeaviest && i === heaviestIdx) continue
    candidates.push(i)
  }

  if (candidates.length === 0) return universe

  // Random each time (intentionally NOT seeded): thumbnails should feel alive.
  const kRaw = minCount + Math.floor(Math.random() * (maxCount - minCount + 1))
  const k = Math.max(0, Math.min(candidates.length, kRaw))

  // Fisher–Yates shuffle candidate indices
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = candidates[i]
    candidates[i] = candidates[j]
    candidates[j] = tmp
  }

  for (let i = 0; i < k; i++) {
    const idx = candidates[i]
    stars[idx].mass *= boostFactor
  }

  return universe
}


