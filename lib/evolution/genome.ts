// ============================================================================
// GENOME: Log-space parameterization for unbounded exploration
// ============================================================================

import { GravityConfig, PhysicsMode } from '../gravity/config'

export interface Genome {
  // Log-space physics parameters (unbounded exploration)
  log10G: number // G = 10^log10G
  log10SofteningEps: number // eps = 10^log10SofteningEps
  log10ForceCap: number // maxForce = 10^log10ForceCap (0 = disabled)
  log10FlickVmax: number // flickVmax = 10^log10FlickVmax
  log10FlickS0: number // flickS0 = 10^log10FlickS0
  log10DtClamp: number // dtClamp = 10^log10DtClamp
  
  // Mass distribution (part of universe definition)
  log10MassMin: number // massMin = 10^log10MassMin
  log10MassRatio: number // massMax = massMin * 10^log10MassRatio
  massShapeExponent: number // k in: mass = massMin + (massMax-massMin) * (u^k), clamped [0.3..3]
  
  // Radius mapping
  radiusScale: number // Visual scale
  radiusPower: number // 0.33..0.6 (continuous)
  
  // Launch parameters
  launchStrength: number // [0.1..2.0]
  massResistanceFactor: number // [0..1]
  
  // Angular guidance
  angularGuidanceStrength: number // [0..1]
  radialClampFactor: number // [0..1]
  
  // Fitness (computed during evaluation)
  fitness?: number
  fitnessDetails?: {
    radialVariance: number
    energyDrift: number
    escapeCount: number
    mergeCount: number
    playabilityScore: number
    scenarioScores: number[]
    orbitMetrics?: {
      radVar: number
      turns: number
      tanRatio: number
    }
    starsRemaining?: number
  }
}

// Sanity clamps for log-space parameters (very broad)
export const GENOME_CLAMPS = {
  log10G: { min: 3.699, max: 4.699 }, // G from 5000 to 50000 (log10(5000)≈3.699, log10(50000)≈4.699)
  log10SofteningEps: { min: -2, max: 2 }, // eps from 0.01 to 100
  log10ForceCap: { min: -1, max: 5 }, // maxForce from 0.1 to 100,000 (0 = disabled)
  log10FlickVmax: { min: 2, max: 2.740 }, // flickVmax from 100 to 550 (log10(100)=2, log10(550)≈2.740)
  log10FlickS0: { min: 1, max: 4 }, // flickS0 from 10 to 10,000
  log10DtClamp: { min: -3, max: -1 }, // dtClamp from 0.001 to 0.1
  log10MassMin: { min: 0.5, max: 2 }, // massMin from ~3.16 to 100 (higher lower limit for more massive stars)
  log10MassRatio: { min: 0, max: 2 }, // massMax/massMin from 1 to 100
  massShapeExponent: { min: 0.3, max: 3 },
  radiusScale: { min: 0.1, max: 5 },
  radiusPower: { min: 0.33, max: 0.6 },
  launchStrength: { min: 0.1, max: 2.0 },
  massResistanceFactor: { min: 0, max: 1 },
  angularGuidanceStrength: { min: 0, max: 1 },
  radialClampFactor: { min: 0, max: 1 },
}

// Adaptive range expansion tracking
export interface RangeExpansion {
  gene: keyof Genome
  boundary: 'min' | 'max'
  generationsAtBoundary: number
}

export class GenomeDecoder {
  /**
   * Decode genome to GravityConfig
   */
  static decode(genome: Genome): GravityConfig {
    const massMin = Math.pow(10, genome.log10MassMin)
    const massMax = massMin * Math.pow(10, genome.log10MassRatio)
    
    return {
      // Physics mode
      physicsMode: PhysicsMode.N_BODY_CHAOS, // GA uses N-body mode
      sunMass: 200, // Default
      satellitesAttractEachOther: true,
      orbitFactor: 1.0,
      
      // Physics
      gravityConstant: Math.pow(10, genome.log10G),
      velocityDamping: 0, // Always 0 for energy conservation
      softeningEpsPx: Math.pow(10, genome.log10SofteningEps),
      maxForceMagnitude: genome.log10ForceCap < -0.5 ? 0 : Math.pow(10, genome.log10ForceCap),
      
      // Launch velocity
      flickWindowMs: 70, // Fixed
      flickS0: Math.pow(10, genome.log10FlickS0),
      flickVmax: Math.pow(10, genome.log10FlickVmax),
      
      // Mass growth - easier to make massive stars
      holdToMaxSeconds: 0.8, // Faster growth (was 1.5) - easier to reach max mass
      minMass: massMin,
      maxMass: massMax,
      radiusScale: genome.radiusScale,
      radiusPower: genome.radiusPower,
      
      // Launch physics
      launchStrength: genome.launchStrength,
      massResistanceFactor: genome.massResistanceFactor,
      
      // Angular guidance
      angularGuidanceStrength: genome.angularGuidanceStrength,
      radialClampFactor: genome.radialClampFactor,
      orbitalCenterSearchRadius: 300, // Fixed
      
      // Visual (fixed for consistency)
      glowRadiusMultiplier: 2.5,
      opacityMultiplier: 0.08,
      starTrailLength: 15,
      starTrailFadeTime: 0.5,
      
      // Comet cursor (fixed)
      cometHeadSize: 4,
      cometHeadGlow: 15,
      cometTailLength: 25,
      cometTailOpacity: 0.6,
      cometTailFadeRate: 0.15,
      
      // Creation feedback (fixed)
      creationRippleDuration: 0.3,
      creationRippleMaxRadius: 50,
      
      // Performance
      maxStars: 60,
      
      // Optional features
      enableMerging: true,
      enableOrbitTrails: false,
      orbitTrailFadeTime: 1.0,
      
      // DEPRECATED (for compatibility)
      maxStarSize: 12,
      starMinRadius: 3,
      starGrowthRate: 8,
      starMinMass: massMin,
      starMaxMass: massMax,
      cursorVelocitySamples: 8,
      minDistance: 5,
      starGlowRadius: 20,
      starBaseOpacity: 0.8,
      mergeDistance: 5,
    }
  }
  
  /**
   * Create random genome within clamps
   */
  static random(): Genome {
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
    
    return {
      log10G: clamp(Math.random() * (GENOME_CLAMPS.log10G.max - GENOME_CLAMPS.log10G.min) + GENOME_CLAMPS.log10G.min, GENOME_CLAMPS.log10G.min, GENOME_CLAMPS.log10G.max),
      log10SofteningEps: clamp(Math.random() * (GENOME_CLAMPS.log10SofteningEps.max - GENOME_CLAMPS.log10SofteningEps.min) + GENOME_CLAMPS.log10SofteningEps.min, GENOME_CLAMPS.log10SofteningEps.min, GENOME_CLAMPS.log10SofteningEps.max),
      log10ForceCap: clamp(Math.random() * (GENOME_CLAMPS.log10ForceCap.max - GENOME_CLAMPS.log10ForceCap.min) + GENOME_CLAMPS.log10ForceCap.min, GENOME_CLAMPS.log10ForceCap.min, GENOME_CLAMPS.log10ForceCap.max),
      log10FlickVmax: clamp(Math.random() * (GENOME_CLAMPS.log10FlickVmax.max - GENOME_CLAMPS.log10FlickVmax.min) + GENOME_CLAMPS.log10FlickVmax.min, GENOME_CLAMPS.log10FlickVmax.min, GENOME_CLAMPS.log10FlickVmax.max),
      log10FlickS0: clamp(Math.random() * (GENOME_CLAMPS.log10FlickS0.max - GENOME_CLAMPS.log10FlickS0.min) + GENOME_CLAMPS.log10FlickS0.min, GENOME_CLAMPS.log10FlickS0.min, GENOME_CLAMPS.log10FlickS0.max),
      log10DtClamp: clamp(Math.random() * (GENOME_CLAMPS.log10DtClamp.max - GENOME_CLAMPS.log10DtClamp.min) + GENOME_CLAMPS.log10DtClamp.min, GENOME_CLAMPS.log10DtClamp.min, GENOME_CLAMPS.log10DtClamp.max),
      log10MassMin: clamp(Math.random() * (GENOME_CLAMPS.log10MassMin.max - GENOME_CLAMPS.log10MassMin.min) + GENOME_CLAMPS.log10MassMin.min, GENOME_CLAMPS.log10MassMin.min, GENOME_CLAMPS.log10MassMin.max),
      log10MassRatio: clamp(Math.random() * (GENOME_CLAMPS.log10MassRatio.max - GENOME_CLAMPS.log10MassRatio.min) + GENOME_CLAMPS.log10MassRatio.min, GENOME_CLAMPS.log10MassRatio.min, GENOME_CLAMPS.log10MassRatio.max),
      massShapeExponent: clamp(Math.random() * (GENOME_CLAMPS.massShapeExponent.max - GENOME_CLAMPS.massShapeExponent.min) + GENOME_CLAMPS.massShapeExponent.min, GENOME_CLAMPS.massShapeExponent.min, GENOME_CLAMPS.massShapeExponent.max),
      radiusScale: clamp(Math.random() * (GENOME_CLAMPS.radiusScale.max - GENOME_CLAMPS.radiusScale.min) + GENOME_CLAMPS.radiusScale.min, GENOME_CLAMPS.radiusScale.min, GENOME_CLAMPS.radiusScale.max),
      radiusPower: clamp(Math.random() * (GENOME_CLAMPS.radiusPower.max - GENOME_CLAMPS.radiusPower.min) + GENOME_CLAMPS.radiusPower.min, GENOME_CLAMPS.radiusPower.min, GENOME_CLAMPS.radiusPower.max),
      launchStrength: clamp(Math.random() * (GENOME_CLAMPS.launchStrength.max - GENOME_CLAMPS.launchStrength.min) + GENOME_CLAMPS.launchStrength.min, GENOME_CLAMPS.launchStrength.min, GENOME_CLAMPS.launchStrength.max),
      massResistanceFactor: clamp(Math.random() * (GENOME_CLAMPS.massResistanceFactor.max - GENOME_CLAMPS.massResistanceFactor.min) + GENOME_CLAMPS.massResistanceFactor.min, GENOME_CLAMPS.massResistanceFactor.min, GENOME_CLAMPS.massResistanceFactor.max),
      angularGuidanceStrength: clamp(Math.random() * (GENOME_CLAMPS.angularGuidanceStrength.max - GENOME_CLAMPS.angularGuidanceStrength.min) + GENOME_CLAMPS.angularGuidanceStrength.min, GENOME_CLAMPS.angularGuidanceStrength.min, GENOME_CLAMPS.angularGuidanceStrength.max),
      radialClampFactor: clamp(Math.random() * (GENOME_CLAMPS.radialClampFactor.max - GENOME_CLAMPS.radialClampFactor.min) + GENOME_CLAMPS.radialClampFactor.min, GENOME_CLAMPS.radialClampFactor.min, GENOME_CLAMPS.radialClampFactor.max),
    }
  }
  
  /**
   * Mutate genome (log-space aware)
   */
  static mutate(genome: Genome, mutationRate: number = 0.1, mutationStrength: number = 0.1): Genome {
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
    const mutateLog = (value: number, min: number, max: number) => {
      if (Math.random() < mutationRate) {
        const noise = (Math.random() - 0.5) * mutationStrength * (max - min)
        return clamp(value + noise, min, max)
      }
      return value
    }
    const mutateLinear = (value: number, min: number, max: number) => {
      if (Math.random() < mutationRate) {
        const noise = (Math.random() - 0.5) * mutationStrength * (max - min)
        return clamp(value + noise, min, max)
      }
      return value
    }
    
    return {
      log10G: mutateLog(genome.log10G, GENOME_CLAMPS.log10G.min, GENOME_CLAMPS.log10G.max),
      log10SofteningEps: mutateLog(genome.log10SofteningEps, GENOME_CLAMPS.log10SofteningEps.min, GENOME_CLAMPS.log10SofteningEps.max),
      log10ForceCap: mutateLog(genome.log10ForceCap, GENOME_CLAMPS.log10ForceCap.min, GENOME_CLAMPS.log10ForceCap.max),
      log10FlickVmax: mutateLog(genome.log10FlickVmax, GENOME_CLAMPS.log10FlickVmax.min, GENOME_CLAMPS.log10FlickVmax.max),
      log10FlickS0: mutateLog(genome.log10FlickS0, GENOME_CLAMPS.log10FlickS0.min, GENOME_CLAMPS.log10FlickS0.max),
      log10DtClamp: mutateLog(genome.log10DtClamp, GENOME_CLAMPS.log10DtClamp.min, GENOME_CLAMPS.log10DtClamp.max),
      log10MassMin: mutateLog(genome.log10MassMin, GENOME_CLAMPS.log10MassMin.min, GENOME_CLAMPS.log10MassMin.max),
      log10MassRatio: mutateLog(genome.log10MassRatio, GENOME_CLAMPS.log10MassRatio.min, GENOME_CLAMPS.log10MassRatio.max),
      massShapeExponent: mutateLinear(genome.massShapeExponent, GENOME_CLAMPS.massShapeExponent.min, GENOME_CLAMPS.massShapeExponent.max),
      radiusScale: mutateLinear(genome.radiusScale, GENOME_CLAMPS.radiusScale.min, GENOME_CLAMPS.radiusScale.max),
      radiusPower: mutateLinear(genome.radiusPower, GENOME_CLAMPS.radiusPower.min, GENOME_CLAMPS.radiusPower.max),
      launchStrength: mutateLinear(genome.launchStrength, GENOME_CLAMPS.launchStrength.min, GENOME_CLAMPS.launchStrength.max),
      massResistanceFactor: mutateLinear(genome.massResistanceFactor, GENOME_CLAMPS.massResistanceFactor.min, GENOME_CLAMPS.massResistanceFactor.max),
      angularGuidanceStrength: mutateLinear(genome.angularGuidanceStrength, GENOME_CLAMPS.angularGuidanceStrength.min, GENOME_CLAMPS.angularGuidanceStrength.max),
      radialClampFactor: mutateLinear(genome.radialClampFactor, GENOME_CLAMPS.radialClampFactor.min, GENOME_CLAMPS.radialClampFactor.max),
    }
  }
  
  /**
   * Crossover two genomes
   */
  static crossover(parent1: Genome, parent2: Genome): Genome {
    const uniformCrossover = (a: number, b: number) => Math.random() < 0.5 ? a : b
    
    return {
      log10G: uniformCrossover(parent1.log10G, parent2.log10G),
      log10SofteningEps: uniformCrossover(parent1.log10SofteningEps, parent2.log10SofteningEps),
      log10ForceCap: uniformCrossover(parent1.log10ForceCap, parent2.log10ForceCap),
      log10FlickVmax: uniformCrossover(parent1.log10FlickVmax, parent2.log10FlickVmax),
      log10FlickS0: uniformCrossover(parent1.log10FlickS0, parent2.log10FlickS0),
      log10DtClamp: uniformCrossover(parent1.log10DtClamp, parent2.log10DtClamp),
      log10MassMin: uniformCrossover(parent1.log10MassMin, parent2.log10MassMin),
      log10MassRatio: uniformCrossover(parent1.log10MassRatio, parent2.log10MassRatio),
      massShapeExponent: uniformCrossover(parent1.massShapeExponent, parent2.massShapeExponent),
      radiusScale: uniformCrossover(parent1.radiusScale, parent2.radiusScale),
      radiusPower: uniformCrossover(parent1.radiusPower, parent2.radiusPower),
      launchStrength: uniformCrossover(parent1.launchStrength, parent2.launchStrength),
      massResistanceFactor: uniformCrossover(parent1.massResistanceFactor, parent2.massResistanceFactor),
      angularGuidanceStrength: uniformCrossover(parent1.angularGuidanceStrength, parent2.angularGuidanceStrength),
      radialClampFactor: uniformCrossover(parent1.radialClampFactor, parent2.radialClampFactor),
    }
  }
  
  /**
   * Expand range if elites are near boundary
   */
  static expandRange(clamps: typeof GENOME_CLAMPS, expansions: RangeExpansion[]): typeof GENOME_CLAMPS {
    const expanded = { ...clamps }
    
    for (const exp of expansions) {
      if (exp.generationsAtBoundary >= 2) {
        const clamp = expanded[exp.gene as keyof typeof expanded]
        if (clamp && typeof clamp === 'object' && 'min' in clamp && 'max' in clamp) {
          if (exp.boundary === 'min') {
            clamp.min -= 1.0 // Expand by 10x in log space
          } else {
            clamp.max += 1.0
          }
        }
      }
    }
    
    return expanded
  }
}

