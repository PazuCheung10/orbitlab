import { GravityConfig } from './config'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function randomInt(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1))
}

// Box–Muller transform: N(0,1)
function gaussian01(): number {
  // Avoid log(0)
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function gaussian(mean: number, std: number): number {
  return mean + gaussian01() * std
}

export function generateGaussianUniverse(params: {
  width: number
  height: number
  config: GravityConfig
  minStars?: number
  maxStars?: number
}): { width: number; height: number; stars: Array<{ x: number; y: number; mass: number }> } {
  const { width, height, config } = params
  const minStars = params.minStars ?? 10
  const maxStars = params.maxStars ?? 30

  const cap = Math.max(1, Math.floor(config.maxStars || 60))
  const requested = randomInt(minStars, maxStars)
  const count = clamp(requested, 1, cap)

  const cx = width / 2
  const cy = height / 2
  const minDim = Math.min(width, height)
  const margin = Math.max(6, Math.floor(minDim * 0.06))

  // Position spread: clustered around center but wide enough to fill screen
  const sigmaX = Math.max(20, width * 0.22)
  const sigmaY = Math.max(20, height * 0.22)

  // Mass spread: centered between min/max, clamped
  const minMass = config.minMass
  const maxMassVal = config.maxMass
  const meanMass = (minMass + maxMassVal) / 2
  const sigmaMass = Math.max(0.001, (maxMassVal - minMass) / 6) // ~99% within range

  const stars: Array<{ x: number; y: number; mass: number }> = []

  // Light rejection sampling to avoid extreme overlap; capped attempts to avoid hangs.
  const maxAttempts = count * 20
  let attempts = 0
  while (stars.length < count && attempts < maxAttempts) {
    attempts++
    const x = clamp(gaussian(cx, sigmaX), margin, width - margin)
    const y = clamp(gaussian(cy, sigmaY), margin, height - margin)

    const mass = clamp(gaussian(meanMass, sigmaMass), minMass, maxMassVal)

    // Avoid placing too many stars on top of each other
    const tooClose = stars.some((s) => {
      const dx = s.x - x
      const dy = s.y - y
      return dx * dx + dy * dy < 12 * 12
    })
    if (tooClose) continue

    stars.push({ x, y, mass })
  }

  // If we failed to place enough (tiny canvases), fill remaining uniformly.
  while (stars.length < count) {
    const x = margin + Math.random() * (width - 2 * margin)
    const y = margin + Math.random() * (height - 2 * margin)
    const mass = clamp(gaussian(meanMass, sigmaMass), minMass, maxMassVal)
    stars.push({ x, y, mass })
  }

  return { width, height, stars }
}

export function generateGaussianStars(params: {
  width: number
  height: number
  config: GravityConfig
  count: number
}): Array<{ x: number; y: number; mass: number }> {
  const { width, height, config } = params
  const count = clamp(Math.floor(params.count), 0, 10000)
  if (count === 0) return []

  const cx = width / 2
  const cy = height / 2
  const minDim = Math.min(width, height)
  const margin = Math.max(6, Math.floor(minDim * 0.06))

  // Position spread: clustered around center but wide enough to fill screen
  const sigmaX = Math.max(20, width * 0.22)
  const sigmaY = Math.max(20, height * 0.22)

  // Mass spread: centered between min/max, clamped
  const minMass = config.minMass
  const maxMassVal = config.maxMass
  const meanMass = (minMass + maxMassVal) / 2
  const sigmaMass = Math.max(0.001, (maxMassVal - minMass) / 6) // ~99% within range

  const stars: Array<{ x: number; y: number; mass: number }> = []

  const maxAttempts = count * 20
  let attempts = 0
  while (stars.length < count && attempts < maxAttempts) {
    attempts++
    const x = clamp(gaussian(cx, sigmaX), margin, width - margin)
    const y = clamp(gaussian(cy, sigmaY), margin, height - margin)

    const mass = clamp(gaussian(meanMass, sigmaMass), minMass, maxMassVal)

    const tooClose = stars.some((s) => {
      const dx = s.x - x
      const dy = s.y - y
      return dx * dx + dy * dy < 12 * 12
    })
    if (tooClose) continue

    stars.push({ x, y, mass })
  }

  while (stars.length < count) {
    const x = margin + Math.random() * (width - 2 * margin)
    const y = margin + Math.random() * (height - 2 * margin)
    const mass = clamp(gaussian(meanMass, sigmaMass), minMass, maxMassVal)
    stars.push({ x, y, mass })
  }

  return stars
}


