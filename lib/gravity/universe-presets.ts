// ============================================================================
// UNIVERSE PRESETS
// ============================================================================

import { GravityConfig, PhysicsMode } from './config'
import { GRAVITY_CONFIG } from './config'

export interface UniversePreset {
  name: string
  description: string
  config: Partial<GravityConfig>
}

/**
 * Generate a random universe config (log-uniform sampling)
 */
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
    
    gravityConstant: 10000, // Fixed for all universes
    softeningEpsPx: logUniform(1, 10),
    maxForceMagnitude: Math.random() < 0.5 ? 0 : logUniform(100, 10000),
    
    flickVmax: 400 + Math.random() * 150, // 400-550 (clamped to 550 max)
    flickS0: logUniform(100, 1000),
    
    orbitFactor: 0.7 + Math.random() * 0.6, // 0.7-1.3
    
    launchStrength: 0.6 + Math.random() * 0.6, // 0.6-1.2
    massResistanceFactor: Math.random() * 0.5, // 0-0.5
    
    angularGuidanceStrength: Math.random() * 0.8, // 0-0.8
    radialClampFactor: Math.random() * 0.7, // 0-0.7
    
    // Mass generation is the same for all universes (3-20 over 3 seconds)
    // Don't override minMass, maxMass, or holdToMaxSeconds
    radiusScale: 0.5 + Math.random() * 2, // 0.5-2.5
    radiusPower: 0.5, // Fixed to 1/2 (sqrt) for all universes
  }
}

/**
 * Default presets for stable circular/elliptical orbits
 */
export const UNIVERSE_PRESETS: UniversePreset[] = [
  {
    name: 'Stable Orbits',
    description: 'Perfect circular orbits around central sun',
    config: {
      physicsMode: PhysicsMode.ORBIT_PLAYGROUND,
      sunMass: 200,
      satellitesAttractEachOther: false,
      gravityConstant: 10000, // Fixed for all universes
      softeningEpsPx: 1.5,
      maxForceMagnitude: 0, // Disabled in ORBIT_PLAYGROUND
      orbitFactor: 1.0,
      flickVmax: 550,
      launchStrength: 0.9,
    }
  },
  {
    name: 'Elliptical Orbits',
    description: 'Slightly elliptical orbits (orbitFactor < 1.0)',
    config: {
      physicsMode: PhysicsMode.ORBIT_PLAYGROUND,
      sunMass: 250,
      satellitesAttractEachOther: false,
      gravityConstant: 10000, // Fixed for all universes
      softeningEpsPx: 3,
      maxForceMagnitude: 0,
      orbitFactor: 0.85,
      flickVmax: 550,
      launchStrength: 0.9,
    }
  },
  {
    name: 'Tight Orbits',
    description: 'Fast, close orbits with high gravity',
    config: {
      physicsMode: PhysicsMode.ORBIT_PLAYGROUND,
      sunMass: 300,
      satellitesAttractEachOther: false,
      gravityConstant: 10000, // Fixed for all universes
      softeningEpsPx: 1.5,
      maxForceMagnitude: 0,
      orbitFactor: 1.0,
      flickVmax: 550,
      launchStrength: 0.9,
    }
  },
  {
    name: 'Wide Orbits',
    description: 'Larger orbital distances with lower gravity',
    config: {
      physicsMode: PhysicsMode.ORBIT_PLAYGROUND,
      sunMass: 150,
      satellitesAttractEachOther: false, // Enforced false in ORBIT_PLAYGROUND
      gravityConstant: 10000, // Fixed for all universes
      softeningEpsPx: 1.5,
      maxForceMagnitude: 0, // Disabled in ORBIT_PLAYGROUND
      orbitFactor: 1.0,
      flickVmax: 550,
      launchStrength: 0.9,
    }
  },
  {
    name: 'N-Body Chaos',
    description: 'Full pairwise gravity (chaotic)',
    config: {
      physicsMode: PhysicsMode.N_BODY_CHAOS,
      sunMass: 200,
      satellitesAttractEachOther: true,
      gravityConstant: 10000, // Fixed for all universes
      softeningEpsPx: 3,
      maxForceMagnitude: 5000,
      orbitFactor: 1.0,
      flickVmax: 550,
      launchStrength: 0.9,
    }
  },
  {
    name: 'Random',
    description: 'Randomly generated universe',
    config: randomizeUniverse()
  }
]

