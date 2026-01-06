export enum PhysicsMode {
  ORBIT_PLAYGROUND = 'ORBIT_PLAYGROUND', // Stable orbits, energy-conserving
  N_BODY_CHAOS = 'N_BODY_CHAOS' // Chaotic, with damping
}

export const PHYSICS_MODE = PhysicsMode.ORBIT_PLAYGROUND
export const SUN_MASS = 200
export const SATELLITES_ATTRACT_EACH_OTHER = false

export const LAUNCH_STRENGTH = 0.9
export const MASS_RESISTANCE_FACTOR = 0.3 // Bigger stars launch slower
export const GRAVITY_CONSTANT = 10000
export const MAX_STAR_SIZE = 12 // Not used anymore
export const RADIUS_SCALE = 1.2
export const RADIUS_POWER = 0.5 // sqrt for 2D

export const VELOCITY_DAMPING = 0 // Zero for stable orbits

export const SOFTENING_EPS_PX = 1.5 // Prevents singularities
export const MAX_FORCE_MAGNITUDE = 1000

export const FLICK_WINDOW_MS = 70 // How far back to look for flick gesture
export const FLICK_S0 = 400
export const FLICK_VMAX = 550

export const ORBIT_FACTOR = 1.0

export const HOLD_TO_MAX_SECONDS = 5.0
export const MIN_MASS = 30
export const MAX_MASS = 100

export const ANGULAR_GUIDANCE_STRENGTH = 0.6 // Nudge toward orbital direction
export const RADIAL_CLAMP_FACTOR = 0.5 // Not used currently
export const ORBITAL_CENTER_SEARCH_RADIUS = 300

export interface GravityConfig {
  physicsMode: PhysicsMode
  sunMass: number
  satellitesAttractEachOther: boolean
  
  launchStrength: number
  massResistanceFactor: number
  
  gravityConstant: number
  velocityDamping: number
  
  softeningEpsPx: number
  maxForceMagnitude: number
  
  flickWindowMs: number
  flickS0: number
  flickVmax: number
  
  orbitFactor: number
  
  holdToMaxSeconds: number
  minMass: number
  maxMass: number
  radiusScale: number
  radiusPower: number
  
  angularGuidanceStrength: number
  radialClampFactor: number
  orbitalCenterSearchRadius: number
  
  glowRadiusMultiplier: number
  opacityMultiplier: number
  starTrailLength: number
  starTrailFadeTime: number
  
  cometHeadSize: number
  cometHeadGlow: number
  cometTailLength: number
  cometTailOpacity: number
  cometTailFadeRate: number
  
  creationRippleDuration: number
  creationRippleMaxRadius: number
  
  maxStars: number
  
  enableMerging: boolean
  enableOrbitTrails: boolean
  orbitTrailFadeTime: number
  enableBoundaryWrapping: boolean // Torus mode
  
  // Old stuff, kept for compatibility
  maxStarSize: number
  starMinRadius: number
  starGrowthRate: number
  starMinMass: number
  starMaxMass: number
  cursorVelocitySamples: number
  minDistance: number
  starGlowRadius: number
  starBaseOpacity: number
  mergeDistance: number
}

export const GRAVITY_CONFIG: GravityConfig = {
  physicsMode: PHYSICS_MODE,
  sunMass: SUN_MASS,
  satellitesAttractEachOther: SATELLITES_ATTRACT_EACH_OTHER,
  
  launchStrength: LAUNCH_STRENGTH,
  massResistanceFactor: MASS_RESISTANCE_FACTOR,
  
  gravityConstant: GRAVITY_CONSTANT,
  velocityDamping: VELOCITY_DAMPING,
  
  softeningEpsPx: SOFTENING_EPS_PX,
  maxForceMagnitude: MAX_FORCE_MAGNITUDE,
  
  flickWindowMs: FLICK_WINDOW_MS,
  flickS0: FLICK_S0,
  flickVmax: FLICK_VMAX,
  
  orbitFactor: ORBIT_FACTOR,
  
  holdToMaxSeconds: HOLD_TO_MAX_SECONDS,
  minMass: MIN_MASS,
  maxMass: MAX_MASS,
  radiusScale: RADIUS_SCALE,
  radiusPower: RADIUS_POWER,
  
  angularGuidanceStrength: ANGULAR_GUIDANCE_STRENGTH,
  radialClampFactor: RADIAL_CLAMP_FACTOR,
  orbitalCenterSearchRadius: ORBITAL_CENTER_SEARCH_RADIUS,
  
  glowRadiusMultiplier: 0.05,
  opacityMultiplier: 0.004,
  starTrailLength: 15,
  starTrailFadeTime: 0.5,
  
  cometHeadSize: 4,
  cometHeadGlow: 15,
  cometTailLength: 25,
  cometTailOpacity: 0.6,
  cometTailFadeRate: 0.15,
  
  creationRippleDuration: 0.3,
  creationRippleMaxRadius: 50,
  
  maxStars: 60,
  
  enableMerging: true,
  enableOrbitTrails: false,
  orbitTrailFadeTime: 1.0,
  enableBoundaryWrapping: true, // Torus mode - breaks energy conservation
  
  maxStarSize: MAX_STAR_SIZE,
  starMinRadius: 3,
  starGrowthRate: 8,
  starMinMass: MIN_MASS,
  starMaxMass: MAX_MASS,
  cursorVelocitySamples: 8,
  minDistance: 5,
  starGlowRadius: 20,
  starBaseOpacity: 0.8,
  mergeDistance: 5,
}
