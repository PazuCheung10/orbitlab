// ============================================================================
// FITNESS EVALUATION: Multi-scenario robust testing
// ============================================================================

import { Genome } from './genome'
import { GravitySimulation } from '../gravity/simulation'
import { GravityConfig } from '../gravity/config'
import { GenomeDecoder } from './genome'
import { Star } from '../gravity/star'
import { computeOrbitMetrics, OrbitMetrics } from './orbit-metrics'

export interface Scenario {
  name: string
  centralMass: number
  satelliteMass: number
  initialRadius: number
  launchSpeedMultiplier: number // 0.8, 1.0, or 1.2 * v_circ
  flickSpeed: number // Human flick speed (px/s)
}

export interface FitnessResult {
  fitness: number
  radialVariance: number
  energyDrift: number
  escapeCount: number
  mergeCount: number
  playabilityScore: number
  scenarioScores: number[]
  orbitMetrics?: OrbitMetrics
  starsRemaining: number
}

// Fitness weights
const FITNESS_WEIGHTS = {
  radialVariance: 0.3, // Low radial variance = stable orbit
  energyDrift: 0.25, // Low energy drift = numerical stability
  escapeCount: -0.2, // Penalize escapes
  mergeCount: -0.1, // Penalize merges (optional)
  playabilityScore: 0.15, // Reward playable universes
}

/**
 * Sample mass from distribution defined by genome
 */
function sampleMass(genome: Genome): number {
  const massMin = Math.pow(10, genome.log10MassMin)
  const massMax = massMin * Math.pow(10, genome.log10MassRatio)
  const u = Math.random()
  const k = genome.massShapeExponent
  return massMin + (massMax - massMin) * Math.pow(u, k)
}

/**
 * Create standardized star distribution (same for all universes)
 * 40 stars, same positions, speeds (100 or 550), mass range (5-20)
 */
function createStandardizedStars(config: GravityConfig): Star[] {
  const width = 800
  const height = 600
  const centerX = width / 2
  const centerY = height / 2
  
  const stars: Star[] = []
  const numStars = 40
  const massMin = 5
  const massMax = 20
  const speedMin = 100
  const speedMax = 550
  
  // Use fixed seed positions for reproducibility
  const positions = [
    // Inner ring (12 stars)
    ...Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2
      const radius = 80 + (i % 3) * 20
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      }
    }),
    // Middle ring (16 stars)
    ...Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2
      const radius = 150 + (i % 4) * 15
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      }
    }),
    // Outer ring (12 stars)
    ...Array.from({ length: 12 }, (_, i) => {
      const angle = (i / 12) * Math.PI * 2
      const radius = 220 + (i % 3) * 20
      return {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      }
    }),
  ]
  
  for (let i = 0; i < numStars; i++) {
    const pos = positions[i]
    const mass = massMin + (massMax - massMin) * (i / (numStars - 1)) // Linear distribution
    const speed = speedMin + (speedMax - speedMin) * (i / (numStars - 1)) // Linear distribution from 100 to 550
    
    // Tangential velocity (perpendicular to radius)
    const dx = pos.x - centerX
    const dy = pos.y - centerY
    const dist = Math.hypot(dx, dy)
    if (dist > 1e-6) {
      const angle = Math.atan2(dy, dx)
      const vx = -Math.sin(angle) * speed
      const vy = Math.cos(angle) * speed
      
      stars.push(new Star(
        pos.x,
        pos.y,
        mass,
        vx,
        vy,
        config.radiusScale,
        config.radiusPower
      ))
    }
  }
  
  return stars
}

/**
 * Create test scenarios (deprecated - using standardized stars now)
 */
export function createScenarios(genome: Genome, count: number = 6): Scenario[] {
  const massMin = Math.pow(10, genome.log10MassMin)
  const massMax = massMin * Math.pow(10, genome.log10MassRatio)
  
  const scenarios: Scenario[] = []
  
  for (let i = 0; i < count; i++) {
    // Vary central mass
    const centralMass = massMin + (massMax - massMin) * (0.3 + Math.random() * 0.4) // 30-70% of range
    
    // Vary satellite mass
    const satelliteMass = massMin + (massMax - massMin) * (0.1 + Math.random() * 0.3) // 10-40% of range
    
    // Vary initial radius
    const initialRadius = 100 + Math.random() * 200 // 100-300px
    
    // Vary launch speed multiplier
    const multipliers = [0.8, 1.0, 1.2]
    const launchSpeedMultiplier = multipliers[i % multipliers.length]
    
    // Vary flick speed (human-like distribution: most around 200-400, some up to 600)
    const flickSpeed = 100 + Math.random() * 500 // 100-600 px/s
    
    scenarios.push({
      name: `Scenario ${i + 1}`,
      centralMass,
      satelliteMass,
      initialRadius,
      launchSpeedMultiplier,
      flickSpeed,
    })
  }
  
  return scenarios
}

/**
 * Evaluate fitness using standardized star distribution
 */
function evaluateUniverse(
  config: GravityConfig,
  simulationDuration: number = 20, // Real time: 20 seconds
  dt: number = 1/180, // Smaller dt for more steps (3x faster simulation)
  timeAcceleration: number = 3 // Simulate 3x faster: 20s real = 60s simulated
): {
  radialVariance: number
  energyDrift: number
  starsRemaining: number
  orbitMetrics: OrbitMetrics | null
} {
  // Create simulation
  const width = 800
  const height = 600
  const sim = new GravitySimulation(width, height, config)
  
  // Create standardized star distribution
  const stars = createStandardizedStars(config)
  sim.stars = [...stars]
  
  const centerX = width / 2
  const centerY = height / 2
  const center = { x: centerX, y: centerY }
  
  // Track orbital data
  const positions: Array<{x: number; y: number}> = []
  const velocities: Array<{x: number; y: number}> = []
  const energies: number[] = []
  
  // Run simulation with time acceleration
  const effectiveDt = dt * timeAcceleration
  const steps = Math.floor(simulationDuration / dt)
  const sampleInterval = Math.max(1, Math.floor(steps / 100)) // Sample ~100 points
  
  for (let step = 0; step < steps; step++) {
    sim.update(effectiveDt)
    
    // Sample positions and velocities periodically
    if (step % sampleInterval === 0 && sim.stars.length > 0) {
      // Track all stars relative to center
      const starPositions: Array<{x: number; y: number}> = []
      const starVelocities: Array<{x: number; y: number}> = []
      
      for (const star of sim.stars) {
        starPositions.push({ x: star.x, y: star.y })
        starVelocities.push({ x: star.vx, y: star.vy })
      }
      
      positions.push(...starPositions)
      velocities.push(...starVelocities)
    }
  }
  
  // Calculate orbit metrics
  const orbitMetrics = computeOrbitMetrics(positions, velocities, center)
  
  // Calculate radial variance from orbit metrics
  const radialVariance = orbitMetrics ? orbitMetrics.radVar : 1.0
  
  // Calculate energy drift (approximate)
  let energyDrift = 0
  if (sim.stars.length > 0) {
    // Simple energy check: total kinetic energy
    const initialKE = stars.reduce((sum, s) => {
      const v = Math.hypot(s.vx, s.vy)
      return sum + 0.5 * s.mass * v * v
    }, 0)
    const finalKE = sim.stars.reduce((sum, s) => {
      const v = Math.hypot(s.vx, s.vy)
      return sum + 0.5 * s.mass * v * v
    }, 0)
    if (initialKE > 1e-6) {
      energyDrift = Math.abs((finalKE - initialKE) / initialKE)
    }
  }
  
  return {
    radialVariance,
    energyDrift,
    starsRemaining: sim.stars.length,
    orbitMetrics,
  }
}

/**
 * Evaluate playability (simplified - just check if system is stable)
 */
function evaluatePlayability(config: GravityConfig): number {
  // Run a shorter test
  const result = evaluateUniverse(config, 10, 1/180, 3)
  
  // Playability based on stability metrics
  let score = 0
  if (result.starsRemaining >= 20) score += 0.5 // At least 20 stars remain
  if (result.orbitMetrics) {
    if (result.orbitMetrics.radVar < 0.3) score += 0.3 // Low radial variance
    if (result.orbitMetrics.tanRatio > 0.7) score += 0.2 // High tangential ratio (circular)
  }
  
  return Math.min(1, score)
}

/**
 * Evaluate genome fitness using standardized star distribution
 */
export function evaluateFitness(genome: Genome, scenarios?: Scenario[]): FitnessResult {
  const config = GenomeDecoder.decode(genome)
  
  // Evaluate universe with standardized stars
  const result = evaluateUniverse(config, 20, 1/180, 3)
  
  // Check if more than 20 stars remain (key requirement)
  const starsRemaining = result.starsRemaining
  const starsRemainingScore = starsRemaining >= 20 ? 1.0 : starsRemaining / 20
  
  // Calculate fitness based on orbit metrics
  let fitness = 0
  
  if (result.orbitMetrics) {
    const { radVar, turns, tanRatio } = result.orbitMetrics
    
    // Radial variance: lower is better (stable orbit)
    fitness += FITNESS_WEIGHTS.radialVariance * (1 / (1 + radVar))
    
    // Tangential ratio: higher is better (more circular)
    fitness += FITNESS_WEIGHTS.playabilityScore * tanRatio
    
    // Turns: reward multiple orbits (shows stability)
    const turnsScore = Math.min(1, turns / 5) // Normalize to 0-1 for 5+ turns
    fitness += 0.15 * turnsScore
  } else {
    // Penalize if no orbit metrics (system too chaotic)
    fitness -= 0.5
  }
  
  // Energy drift: lower is better
  fitness += FITNESS_WEIGHTS.energyDrift * (1 - Math.min(1, result.energyDrift))
  
  // Stars remaining: must have at least 20
  fitness += 0.3 * starsRemainingScore
  
  // Penalize if too many stars lost
  const starsLost = 40 - starsRemaining
  if (starsLost > 20) {
    fitness -= 0.2 * ((starsLost - 20) / 20) // Penalty for losing more than 20
  }
  
  const finalFitness = Math.max(0, fitness)
  
  return {
    fitness: finalFitness,
    radialVariance: result.radialVariance,
    energyDrift: result.energyDrift,
    escapeCount: 0, // Not tracked in new system
    mergeCount: 40 - starsRemaining, // Merged stars = lost stars
    playabilityScore: result.orbitMetrics?.tanRatio || 0,
    scenarioScores: [finalFitness], // Single score now
    orbitMetrics: result.orbitMetrics || undefined,
    starsRemaining,
  }
}

