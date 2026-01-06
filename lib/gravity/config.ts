// ============================================================================
// GRAVITY STARS CONFIGURATION
// ============================================================================

// ============================================================================
// PHYSICS MODE
// ============================================================================

export enum PhysicsMode {
  ORBIT_PLAYGROUND = 'ORBIT_PLAYGROUND', // Central sun, satellites orbit (stable, readable)
  N_BODY_CHAOS = 'N_BODY_CHAOS' // Full pairwise gravity (chaotic)
}

// ============================================================================
// CORE PHYSICS PARAMETERS (Exposed for easy tuning)
// ============================================================================

export const PHYSICS_MODE = PhysicsMode.ORBIT_PLAYGROUND // Default mode
export const SUN_MASS = 200 // Central sun mass (for ORBIT_PLAYGROUND mode)
export const SATELLITES_ATTRACT_EACH_OTHER = false // MUST be false in ORBIT_PLAYGROUND (enforced)

export const LAUNCH_STRENGTH = 0.9 // Multiplier for launch velocity (0.6-1.2, default 0.9)
export const MASS_RESISTANCE_FACTOR = 0.3 // How much mass resists acceleration (0-1, higher = larger stars launch slower)
export const GRAVITY_CONSTANT = 10000 // Gravitational constant (fixed to 10000 for all universes)
export const MAX_STAR_SIZE = 12 // DEPRECATED: kept for backward compatibility
export const RADIUS_SCALE = 1.2 // Visual scale: radius = mass^radiusPower * radiusScale
export const RADIUS_POWER = 0.5 // Power for radius: 0.5 = sqrt (2D area), 0.333 = cbrt (3D volume)

// Energy conservation (default: no damping)
export const VELOCITY_DAMPING = 0 // Set to 0 for stable orbits (or 1e-6 for tiny decay)

// Gravity softening (Plummer softening) - keep SMALL for ORBIT_PLAYGROUND
export const SOFTENING_EPS_PX = 1.5 // Softening parameter in pixels (1-2 for stable orbits, prevents singularities only)
export const MAX_FORCE_MAGNITUDE = 1000 // Optional: clamp force magnitude to prevent insane impulses

// Launch velocity (flick measurement) - player-friendly defaults
export const FLICK_WINDOW_MS = 70 // Time window to measure flick speed (milliseconds before release)
export const FLICK_S0 = 400 // Speed compressor scale parameter (pixels/second)
export const FLICK_VMAX = 550 // Maximum compressed speed (pixels/second) - limit to 550 for all universes

// Orbit playground initial velocity
export const ORBIT_FACTOR = 1.0 // Multiplier for initial orbital velocity (0.7-1.3, default 1.0)

// Mass growth (same for all universes)
export const HOLD_TO_MAX_SECONDS = 5.0 // Time to hold to reach max mass (seconds) - 5 seconds steady
export const MIN_MASS = 5 // Minimum mass (initial mass when starting to create)
export const MAX_MASS = 20 // Maximum mass (all universes)

// Angular Momentum Guidance (LAUNCH ASSIST ONLY)
export const ANGULAR_GUIDANCE_STRENGTH = 0.6 // How strongly to guide toward orbital motion at launch (0-1)
export const RADIAL_CLAMP_FACTOR = 0.5 // How much to clamp excessive radial velocity at launch (0-1)
export const ORBITAL_CENTER_SEARCH_RADIUS = 300 // How far to search for orbital center (pixels)

// ============================================================================

export interface GravityConfig {
  // Physics mode
  physicsMode: PhysicsMode
  sunMass: number // Central sun mass (for ORBIT_PLAYGROUND)
  satellitesAttractEachOther: boolean // If false, satellites only feel sun's gravity
  
  // Launch physics
  launchStrength: number
  massResistanceFactor: number
  
  // Gravity physics
  gravityConstant: number
  velocityDamping: number
  
  // Gravity softening
  softeningEpsPx: number
  maxForceMagnitude: number
  
  // Launch velocity (flick)
  flickWindowMs: number
  flickS0: number
  flickVmax: number
  
  // Orbit playground
  orbitFactor: number // Multiplier for initial orbital velocity (0.7-1.3)
  
  // Mass growth
  holdToMaxSeconds: number
  minMass: number
  maxMass: number
  radiusScale: number
  radiusPower: number
  
  // Angular Momentum Guidance (launch assist only)
  angularGuidanceStrength: number
  radialClampFactor: number
  orbitalCenterSearchRadius: number
  
  // Visual
  glowRadiusMultiplier: number
  opacityMultiplier: number
  starTrailLength: number
  starTrailFadeTime: number
  
  // Comet cursor
  cometHeadSize: number
  cometHeadGlow: number
  cometTailLength: number
  cometTailOpacity: number
  cometTailFadeRate: number
  
  // Creation feedback
  creationRippleDuration: number
  creationRippleMaxRadius: number
  
  // Performance
  maxStars: number
  
  // Optional features
  enableMerging: boolean
  enableOrbitTrails: boolean
  orbitTrailFadeTime: number
  
  // DEPRECATED (kept for compatibility)
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
  // Physics mode
  physicsMode: PHYSICS_MODE,
  sunMass: SUN_MASS,
  satellitesAttractEachOther: SATELLITES_ATTRACT_EACH_OTHER,
  
  // Launch physics
  launchStrength: LAUNCH_STRENGTH,
  massResistanceFactor: MASS_RESISTANCE_FACTOR,
  
  // Gravity physics
  gravityConstant: GRAVITY_CONSTANT,
  velocityDamping: VELOCITY_DAMPING,
  
  // Gravity softening
  softeningEpsPx: SOFTENING_EPS_PX,
  maxForceMagnitude: MAX_FORCE_MAGNITUDE,
  
  // Launch velocity (flick)
  flickWindowMs: FLICK_WINDOW_MS,
  flickS0: FLICK_S0,
  flickVmax: FLICK_VMAX,
  
  // Orbit playground
  orbitFactor: ORBIT_FACTOR,
  
  // Mass growth
  holdToMaxSeconds: HOLD_TO_MAX_SECONDS,
  minMass: MIN_MASS,
  maxMass: MAX_MASS,
  radiusScale: RADIUS_SCALE,
  radiusPower: RADIUS_POWER,
  
  // Angular Momentum Guidance
  angularGuidanceStrength: ANGULAR_GUIDANCE_STRENGTH,
  radialClampFactor: RADIAL_CLAMP_FACTOR,
  orbitalCenterSearchRadius: ORBITAL_CENTER_SEARCH_RADIUS,
  
  // Visual (fixed values)
  glowRadiusMultiplier: 0.06,
  opacityMultiplier: 0.02,
  starTrailLength: 15,
  starTrailFadeTime: 0.5,
  
  // Comet cursor
  cometHeadSize: 4,
  cometHeadGlow: 15,
  cometTailLength: 25,
  cometTailOpacity: 0.6,
  cometTailFadeRate: 0.15,
  
  // Creation feedback
  creationRippleDuration: 0.3,
  creationRippleMaxRadius: 50,
  
  // Performance
  maxStars: 60,
  
  // Optional features
  enableMerging: true,
  enableOrbitTrails: false,
  orbitTrailFadeTime: 1.0,
  
  // DEPRECATED (kept for compatibility)
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
