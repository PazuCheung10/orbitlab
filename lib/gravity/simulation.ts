/**
 * Gravity Simulation with Velocity Verlet Integrator
 * 
 * PHYSICS VALIDATION REQUIREMENTS:
 * For accurate energy conservation and orbital stability testing:
 * 1. Set enableMerging = false (merging is inelastic, non-Hamiltonian)
 * 2. Set enableBoundaryWrapping = false (wrapping implements torus topology, not Newtonian free space)
 * 3. Use fixed timestep (already implemented via accumulator pattern)
 * 4. Two-body system should maintain constant energy and closed orbits
 * 
 * CONCEPTUAL SWITCHES:
 * - enableMerging: Intentional inelastic collision (gameplay feature, NOT physics validation)
 * - enableBoundaryWrapping: 2D torus universe (NOT Newtonian free space)
 * 
 * INTEGRATOR:
 * - Velocity Verlet (symplectic, energy-conserving for Hamiltonian systems)
 * - Fixed timestep with accumulator pattern
 * - vxHalf/vyHalf are persistent state variables (never synced to vx/vy during integration)
 */

import { GravityConfig, PhysicsMode } from './config'
import { Star } from './star'

// Vector math helpers for angular momentum guidance
interface Vector2 {
  x: number
  y: number
}

function dot(v1: Vector2, v2: Vector2): number {
  return v1.x * v2.x + v1.y * v2.y
}

function length(v: Vector2): number {
  return Math.sqrt(v.x * v.x + v.y * v.y)
}

function normalize(v: Vector2): Vector2 {
  const len = length(v)
  if (len === 0) return { x: 0, y: 0 }
  return { x: v.x / len, y: v.y / len }
}

function scale(v: Vector2, s: number): Vector2 {
  return { x: v.x * s, y: v.y * s }
}

function subtract(v1: Vector2, v2: Vector2): Vector2 {
  return { x: v1.x - v2.x, y: v1.y - v2.y }
}

function add(v1: Vector2, v2: Vector2): Vector2 {
  return { x: v1.x + v2.x, y: v1.y + v2.y }
}

/**
 * Minimum image convention for periodic boundary conditions (torus wrapping)
 * Returns the shortest distance across periodic boundaries
 * 
 * @param d - Distance component (dx or dy)
 * @param size - Boundary size (width or height)
 * @returns Shortest distance across boundaries
 */
function minImageDelta(d: number, size: number): number {
  if (d > size / 2) {
    d -= size
  } else if (d < -size / 2) {
    d += size
  }
  return d
}

// Find orbital center (nearest massive star or center of mass)
// Uses minimum-image convention for periodic boundaries
function findOrbitalCenter(
  position: Vector2,
  stars: Star[],
  searchRadius: number,
  width: number,
  height: number,
  enableWrapping: boolean
): { center: Vector2; totalMass: number } | null {
  let nearestStar: Star | null = null
  let nearestDistance = Infinity
  
  // Find nearest massive star using minimum-image convention
  for (const star of stars) {
    let dx = star.x - position.x
    let dy = star.y - position.y
    
    if (enableWrapping) {
      dx = minImageDelta(dx, width)
      dy = minImageDelta(dy, height)
    }
    
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance < searchRadius && distance < nearestDistance) {
      nearestStar = star
      nearestDistance = distance
    }
  }
  
  if (!nearestStar) return null
  
  // Check if there are other stars nearby to compute center of mass
  const nearbyStars: Array<{ star: Star; dx: number; dy: number }> = []
  for (const star of stars) {
    if (star === nearestStar) {
      let dx = star.x - position.x
      let dy = star.y - position.y
      if (enableWrapping) {
        dx = minImageDelta(dx, width)
        dy = minImageDelta(dy, height)
      }
      nearbyStars.push({ star, dx, dy })
      continue
    }
    
    let dx = star.x - position.x
    let dy = star.y - position.y
    if (enableWrapping) {
      dx = minImageDelta(dx, width)
      dy = minImageDelta(dy, height)
    }
    const distance = Math.sqrt(dx * dx + dy * dy)
    if (distance < searchRadius) {
      nearbyStars.push({ star, dx, dy })
    }
  }
  
  // Compute center of mass using minimum-image positions
  let totalMass = 0
  let weightedX = 0
  let weightedY = 0
  
  for (const { star, dx, dy } of nearbyStars) {
    // Position relative to search position using minimum-image
    const relX = position.x + dx
    const relY = position.y + dy
    totalMass += star.mass
    weightedX += relX * star.mass
    weightedY += relY * star.mass
  }
  
  if (totalMass === 0) return null
  
  return {
    center: { x: weightedX / totalMass, y: weightedY / totalMass },
    totalMass
  }
}

// Decompose velocity into radial and tangential components
function decomposeVelocity(
  position: Vector2,
  center: Vector2,
  velocity: Vector2
): { radial: Vector2; tangential: Vector2 } {
  // Vector from center to position
  const r = subtract(position, center)
  const rLen = length(r)
  
  if (rLen === 0) {
    // If at center, no decomposition possible
    return { radial: { x: 0, y: 0 }, tangential: velocity }
  }
  
  const rUnit = normalize(r)
  
  // Radial component (parallel to r)
  const radialMagnitude = dot(velocity, rUnit)
  const radial = scale(rUnit, radialMagnitude)
  
  // Tangential component (perpendicular to r)
  const tangential = subtract(velocity, radial)
  
  return { radial, tangential }
}

/**
 * Rotate velocity direction toward tangential direction while preserving magnitude
 * This is Hamiltonian-consistent: preserves energy and angular momentum magnitude
 * 
 * @param position - Star position
 * @param center - Orbital center position
 * @param velocity - Current velocity vector
 * @param guidanceStrength - Guidance strength [0, 1], where 0 = no change, 1 = pure tangential
 * @returns New velocity with same magnitude, rotated direction
 */
function rotateVelocityTowardTangential(
  position: Vector2,
  center: Vector2,
  velocity: Vector2,
  guidanceStrength: number
): Vector2 {
  const EPS = 1e-6
  
  // Safety: if velocity is too small, skip guidance
  const speed = length(velocity)
  if (speed < EPS) {
    return velocity
  }
  
  // Compute relative position
  const r = subtract(position, center)
  const rLen = length(r)
  
  // Safety: if position is at center, skip guidance
  if (rLen < EPS) {
    return velocity
  }
  
  // Normalize radial direction
  const rHat = normalize(r)
  
  // Compute tangential direction (perpendicular to radial, counter-clockwise)
  const tHat = { x: -rHat.y, y: rHat.x }
  
  // Decompose velocity into radial and tangential components
  const vRadial = dot(velocity, rHat)
  const vTangential = dot(velocity, tHat)
  
  // Current velocity direction
  const vHat = normalize(velocity)
  
  // Determine tangential direction sign (preserve current tangential component sign)
  const tangentialSign = vTangential >= 0 ? 1 : -1
  const tHatSigned = scale(tHat, tangentialSign)
  
  // Interpolate between current direction and tangential direction
  // guidanceStrength = 0: keep current direction
  // guidanceStrength = 1: pure tangential direction
  const desiredDir = normalize(
    add(
      scale(vHat, 1 - guidanceStrength),
      scale(tHatSigned, guidanceStrength)
    )
  )
  
  // Reconstruct velocity with same magnitude, new direction
  return scale(desiredDir, speed)
}

// Speed compressor: maps raw speed to compressed output
function compressSpeed(rawSpeed: number, s0: number, vmax: number): number {
  return vmax * (1 - Math.exp(-rawSpeed / s0))
}

export interface CreationRipple {
  x: number
  y: number
  time: number
  maxRadius: number
  duration: number
}

export class GravitySimulation {
  stars: Star[] = []
  config: GravityConfig
  width: number
  height: number
  centralSun: Star | null = null // DEPRECATED: Not used in current implementation (ORBIT_PLAYGROUND uses full pairwise gravity)
  
  // Star creation state
  isCreating: boolean = false
  creationX: number = 0
  creationY: number = 0
  creationStartTime: number = 0
  cursorHistory: Array<{ x: number; y: number; time: number }> = []
  
  // Visual effects
  ripples: CreationRipple[] = []
  
  // Debug stats
  debugStats: {
    holdDragSpeed: number
    releaseFlickSpeed: number
    compressedSpeed: number
    finalLaunchSpeed: number
    estimatedVCirc: number
    estimatedVEsc: number
  } | null = null
  
  // Energy diagnostics
  // Separates integrator drift (numerical error) from merge-induced energy loss (intentional gameplay)
  energyStats: {
    kinetic: number
    potential: number
    total: number
    history: number[] // Last 100 values for trend analysis
    trend: 'stable' | 'decreasing' | 'increasing' // Energy trend (excluding merge events)
    mergeEvents: Array<{ frame: number; energyPreMerge: number; energyPostMerge: number; deltaEnergy: number }> // Track merge energy changes (inelastic collisions)
    integratorDrift: number // Cumulative energy change from integrator (excluding merges)
    lastEnergyBeforeMerge: number | null // Energy before last merge (for drift calculation)
  } | null = null

  constructor(width: number, height: number, config: GravityConfig) {
    this.width = width
    this.height = height
    this.config = config
    this.initializePhysicsMode()
  }

  /**
   * Initialize physics mode (create central sun if needed)
   */
  initializePhysicsMode(): void {
    // No central sun - all stars interact with each other
    this.centralSun = null
  }

  /**
   * Load stars from universe JSON (positions only, compute velocities)
   */
  loadUniverse(universe: { width: number; height: number; stars: Array<{ x: number; y: number; mass: number }> }): void {
    this.stars = []
    
    const centerX = universe.width / 2
    const centerY = universe.height / 2
    
    for (const starData of universe.stars) {
      // Calculate distance from center
      const dx = starData.x - centerX
      const dy = starData.y - centerY
      const r = Math.sqrt(dx * dx + dy * dy)
      
      if (r < 1e-6) continue // Skip if at center
      
      // Compute orbital velocity: v_circ = sqrt(G * M_center / r)
      // NO mass-dependent scaling - circular orbit speed depends ONLY on (G * M / r)
      // Use center of mass approximation for initial velocity
      const centerMass = this.computeCenterOfMassMass()
      
      const vCirc = Math.sqrt((this.config.gravityConstant * centerMass) / r)
      
      // Velocity magnitude = v_circ * orbitFactor (no mass scaling)
      const v = vCirc * this.config.orbitFactor
      
      // Velocity direction = perpendicular to radius (tangential)
      // Angle calculation for initial velocity
      // NOTE: For A/B tests, set randomDeviation to 0 for deterministic initial conditions
      // For seeded RNG, replace Math.random() with seeded random function
      const angle = Math.atan2(dy, dx)
      const tangentialAngle = angle + Math.PI / 2 // Perpendicular to radius (tangential)
      const randomDeviation = 0 // Disabled for deterministic A/B tests (was: (Math.random() - 0.5) * 0.1)
      const finalAngle = tangentialAngle + randomDeviation
      
      const vx = Math.cos(finalAngle) * v
      const vy = Math.sin(finalAngle) * v
      
      const star = new Star(
        starData.x,
        starData.y,
        starData.mass,
        vx,
        vy,
        this.config.radiusScale,
        this.config.radiusPower
      )
      this.stars.push(star)
    }
    
    // Reinitialize physics mode to ensure sun exists
    this.initializePhysicsMode()
  }

  /**
   * Compute total mass at center (for N_BODY mode, approximate center of mass)
   */
  private computeCenterOfMassMass(): number {
    // For N_BODY mode, use average mass as approximation
    if (this.stars.length === 0) return 100
    const totalMass = this.stars.reduce((sum, s) => sum + s.mass, 0)
    return totalMass / this.stars.length * 10 // Rough approximation
  }

  updateConfig(config: GravityConfig): void {
    const oldMode = this.config.physicsMode
    this.config = config
    
    // Enforce ORBIT_PLAYGROUND rules
    if (config.physicsMode === PhysicsMode.ORBIT_PLAYGROUND) {
      // Ensure no velocity damping (force clamping removed entirely - breaks energy conservation)
      this.config.velocityDamping = 0
    }
    
    if (oldMode !== config.physicsMode) {
      this.initializePhysicsMode()
    }
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
  }

  startCreation(x: number, y: number): void {
    if (this.stars.length >= this.config.maxStars) return
    
    this.isCreating = true
    this.creationX = x
    this.creationY = y
    this.creationStartTime = performance.now() / 1000
    this.cursorHistory = [{ x, y, time: this.creationStartTime }]
    this.debugStats = null
  }

  updateCreation(x: number, y: number): void {
    if (!this.isCreating) return
    
    const now = performance.now() / 1000
    this.creationX = x
    this.creationY = y
    
    // Track cursor movement for launch velocity
    this.cursorHistory.push({ x, y, time: now })
    
    // Keep only history within flick window
    const flickWindowSeconds = this.config.flickWindowMs / 1000
    const cutoff = now - flickWindowSeconds
    this.cursorHistory = this.cursorHistory.filter(point => point.time > cutoff)
    
    // Calculate hold drag speed (for debug)
    if (this.cursorHistory.length >= 2) {
      const recent = this.cursorHistory
      let totalDx = 0
      let totalDy = 0
      let totalDt = 0
      
      for (let i = 1; i < recent.length; i++) {
        const dt = recent[i].time - recent[i - 1].time
        if (dt > 0) {
          totalDx += (recent[i].x - recent[i - 1].x) / dt
          totalDy += (recent[i].y - recent[i - 1].y) / dt
          totalDt += dt
        }
      }
      
      if (totalDt > 0) {
        const avgVx = totalDx / (recent.length - 1)
        const avgVy = totalDy / (recent.length - 1)
        const holdDragSpeed = Math.sqrt(avgVx * avgVx + avgVy * avgVy)
        
        // Update debug stats
        if (this.debugStats) {
          this.debugStats.holdDragSpeed = holdDragSpeed
        }
      }
    }
  }

  finishCreation(): Star | null {
    if (!this.isCreating) return null
    
    const now = performance.now() / 1000
    const holdDuration = now - this.creationStartTime
    
    // Get current scene's largest star mass (rounded to integer), or use default if no stars exist
    const currentMaxMass = this.stars.length > 0
      ? Math.floor(Math.max(...this.stars.map(s => s.mass)))
      : this.config.maxMass
    
    // Calculate mass based on hold time (mass is the primary property)
    // Use eased growth: t = clamp(holdDuration / holdToMaxSeconds, 0..1)
    const t = Math.min(1, holdDuration / this.config.holdToMaxSeconds)
    // Use power curve that grows faster initially (easier to make massive stars)
    // x^0.7 grows faster than sqrt, making it easier to reach higher masses
    const eased = Math.pow(t, 0.7)
    const mass = this.config.minMass + (currentMaxMass - this.config.minMass) * eased
    
    // Radius will be automatically calculated as mass^radiusPower * radiusScale
    
    // Calculate launch velocity from FLICK (last flickWindowMs before release)
    let vx = 0
    let vy = 0
    let releaseFlickSpeed = 0
    
    if (this.cursorHistory.length >= 2) {
      // Use only the flick window (last N milliseconds)
      const flickWindowSeconds = this.config.flickWindowMs / 1000
      const flickCutoff = now - flickWindowSeconds
      const flickHistory = this.cursorHistory.filter(point => point.time > flickCutoff)
      
      if (flickHistory.length >= 2) {
        let totalDx = 0
        let totalDy = 0
        let totalDt = 0
        
        for (let i = 1; i < flickHistory.length; i++) {
          const dt = flickHistory[i].time - flickHistory[i - 1].time
          if (dt > 0) {
            totalDx += (flickHistory[i].x - flickHistory[i - 1].x) / dt
            totalDy += (flickHistory[i].y - flickHistory[i - 1].y) / dt
            totalDt += dt
          }
        }
        
        if (totalDt > 0) {
          let rawVx = (totalDx / (flickHistory.length - 1))
          let rawVy = (totalDy / (flickHistory.length - 1))
          let rawSpeed = Math.sqrt(rawVx * rawVx + rawVy * rawVy)
          
          // Clamp release speed to 550px/s max for good behavior across all universes
          const MAX_RELEASE_SPEED = 550
          if (rawSpeed > MAX_RELEASE_SPEED) {
            const scale = MAX_RELEASE_SPEED / rawSpeed
            rawSpeed = MAX_RELEASE_SPEED
            rawVx *= scale
            rawVy *= scale
          }
          
          releaseFlickSpeed = rawSpeed
          
          // Apply speed compressor
          const compressedSpeed = compressSpeed(rawSpeed, this.config.flickS0, this.config.flickVmax)
          
          // Direction
          const direction = rawSpeed > 0 ? { x: rawVx / rawSpeed, y: rawVy / rawSpeed } : { x: 0, y: 0 }
          
          // Apply launch strength
          vx = direction.x * compressedSpeed * this.config.launchStrength
          vy = direction.y * compressedSpeed * this.config.launchStrength
        }
      }
    }
    
    // Apply mass resistance (larger stars launch slower)
    // Reuse currentMaxMass calculated above
    const massResistance = 1 - (mass / currentMaxMass) * this.config.massResistanceFactor
    vx *= massResistance
    vy *= massResistance
    
    // Apply Angular Momentum Guidance (LAUNCH ASSIST ONLY)
    // Hamiltonian-consistent: only rotates velocity direction, preserves magnitude
    // This preserves energy and angular momentum, only shapes initial conditions
    if (this.config.angularGuidanceStrength > 0 && this.stars.length > 0) {
      const position = { x: this.creationX, y: this.creationY }
      const velocity = { x: vx, y: vy }
      
      // Find orbital center (using minimum-image convention for consistency)
      const orbitalCenter = findOrbitalCenter(
        position,
        this.stars,
        this.config.orbitalCenterSearchRadius,
        this.width,
        this.height,
        this.config.enableBoundaryWrapping
      )
      
      if (orbitalCenter) {
        // Rotate velocity toward tangential direction while preserving magnitude
        // This is a projection onto constant-energy manifold, not a force
        const guidedVelocity = rotateVelocityTowardTangential(
          position,
          orbitalCenter.center,
          velocity,
          this.config.angularGuidanceStrength
        )
        
        vx = guidedVelocity.x
        vy = guidedVelocity.y
        
        // Update debug stats (for reference, not used in guidance)
        const r = subtract(position, orbitalCenter.center)
        const rLen = length(r)
        if (rLen > 0 && this.debugStats) {
          const vCirc = Math.sqrt((this.config.gravityConstant * orbitalCenter.totalMass) / rLen)
          const vEsc = Math.sqrt(2 * (this.config.gravityConstant * orbitalCenter.totalMass) / rLen)
          this.debugStats.estimatedVCirc = vCirc
          this.debugStats.estimatedVEsc = vEsc
        }
      }
    }
    
    // Calculate FINAL launch speed AFTER all modifications (this is the actual speed the star gets)
    const finalLaunchSpeed = Math.sqrt(vx * vx + vy * vy)
    
    // Create star (radius is derived from mass automatically)
    const star = new Star(
      this.creationX,
      this.creationY,
      mass,
      vx,
      vy,
      this.config.radiusScale,
      this.config.radiusPower
    )
    this.stars.push(star)
    
    // Create ripple effect
    this.ripples.push({
      x: this.creationX,
      y: this.creationY,
      time: now,
      maxRadius: this.config.creationRippleMaxRadius,
      duration: this.config.creationRippleDuration
    })
    
    // Calculate compressed speed for debug display
    let compressedSpeed = 0
    if (releaseFlickSpeed > 0) {
      compressedSpeed = compressSpeed(releaseFlickSpeed, this.config.flickS0, this.config.flickVmax)
    }
    
    // Update debug stats
    this.debugStats = {
      holdDragSpeed: this.debugStats?.holdDragSpeed || 0,
      releaseFlickSpeed,
      compressedSpeed,
      finalLaunchSpeed,
      estimatedVCirc: this.debugStats?.estimatedVCirc || 0,
      estimatedVEsc: this.debugStats?.estimatedVEsc || 0
    }
    
    // Reset creation state
    this.isCreating = false
    this.cursorHistory = []
    
    return star
  }

  cancelCreation(): void {
    this.isCreating = false
    this.cursorHistory = []
    this.debugStats = null
  }

  /**
   * Clear all stars from the simulation
   */
  clearAllStars(): void {
    this.stars = []
    this.centralSun = null
    this.isCreating = false
    this.cursorHistory = []
    this.debugStats = null
    this.ripples = []
    this.energyStats = null
  }

  // Fixed timestep accumulator for symplectic integration
  private timeAccumulator: number = 0
  
  update(deltaTime: number): void {
    // Update ripples (non-physics updates)
    const now = performance.now() / 1000
    this.ripples = this.ripples.filter(ripple => {
      const age = now - ripple.time
      return age < ripple.duration
    })
    
    // Fixed timestep accumulator pattern for symplectic properties
    // This ensures dt is constant, preserving energy conservation
    const fixedDt = 0.01
    this.timeAccumulator += deltaTime
    
    // Step with fixed dt until accumulator is depleted
    while (this.timeAccumulator >= fixedDt) {
      this.step(fixedDt)
      this.timeAccumulator -= fixedDt
    }
    
    // Update energy diagnostics after all substeps
    this.updateEnergyStats()
  }
  
  /**
   * Single physics step with fixed timestep dt
   * Performs one complete Velocity Verlet integration step
   * 
   * Velocity Verlet algorithm:
   * 1. v(t+dt/2) = v(t) + a(t) * dt/2
   * 2. x(t+dt) = x(t) + v(t+dt/2) * dt
   * 3. Compute a(t+dt) from x(t+dt)
   * 4. v(t+dt) = v(t+dt/2) + a(t+dt) * dt/2
   * 
   * This is symplectic and conserves energy for Hamiltonian systems.
   */
  step(dt: number): void {
    // VELOCITY VERLET INTEGRATOR: Two-pass update
    // Pass 1: Compute accelerations at current positions and apply first half-step
    const accelerations: Array<{ ax: number; ay: number }> = []
    
    for (let i = 0; i < this.stars.length; i++) {
      const starA = this.stars[i]
      let ax = 0
      let ay = 0
      
      // Compute acceleration from all other stars
      // Both modes use full pairwise gravity (no central sun)
      for (let j = 0; j < this.stars.length; j++) {
        if (i === j) continue
        const starB = this.stars[j]
        
        // Use minimum-image convention ONLY if boundary wrapping is enabled
        // WARNING: Wrapping breaks energy conservation - disable for physics validation
        let dx = starB.x - starA.x
        let dy = starB.y - starA.y
        if (this.config.enableBoundaryWrapping) {
          dx = minImageDelta(dx, this.width)
          dy = minImageDelta(dy, this.height)
        }
        
        // Plummer-softened gravity: F = G*m1*m2 * (dx,dy) / (r^2 + eps^2)^(3/2)
        // This is the gradient of U = -G*m1*m2 / sqrt(r^2 + eps^2)
        // Force is conservative and Hamiltonian-consistent
        const r2 = dx * dx + dy * dy + this.config.softeningEpsPx * this.config.softeningEpsPx
        const r = Math.sqrt(r2)
        const invR = 1 / r
        const invR3 = invR * invR * invR
        
        const forceMagnitude = this.config.gravityConstant * starA.mass * starB.mass * invR3
        const fx = dx * forceMagnitude
        const fy = dy * forceMagnitude
        
        // Apply acceleration (no force modification - pure potential gradient)
        ax += fx / starA.mass
        ay += fy / starA.mass
      }
      
      accelerations.push({ ax, ay })
      
      // Apply first half-step: v(t+dt/2) and x(t+dt)
      starA.updateVelocityVerletFirstHalf(dt, ax, ay, this.width, this.height, this.config)
    }
    
    // Pass 2: Recompute accelerations at new positions and apply second half-step
    for (let i = 0; i < this.stars.length; i++) {
      const starA = this.stars[i]
      let ax = 0
      let ay = 0
      
      // Compute acceleration from all other stars at new positions
      for (let j = 0; j < this.stars.length; j++) {
        if (i === j) continue
        const starB = this.stars[j]
        
        // Use minimum-image convention ONLY if boundary wrapping is enabled
        let dx = starB.x - starA.x
        let dy = starB.y - starA.y
        if (this.config.enableBoundaryWrapping) {
          dx = minImageDelta(dx, this.width)
          dy = minImageDelta(dy, this.height)
        }
        
        // Plummer-softened gravity (same as Pass 1)
        const r2 = dx * dx + dy * dy + this.config.softeningEpsPx * this.config.softeningEpsPx
        const r = Math.sqrt(r2)
        const invR = 1 / r
        const invR3 = invR * invR * invR
        
        const forceMagnitude = this.config.gravityConstant * starA.mass * starB.mass * invR3
        const fx = dx * forceMagnitude
        const fy = dy * forceMagnitude
        
        // Apply acceleration
        ax += fx / starA.mass
        ay += fy / starA.mass
      }
      
      // Complete Velocity Verlet with second half-step: v(t+dt)
      starA.updateVelocityVerletSecondHalf(dt, ax, ay, this.config)
    }
    
    // Handle merging (INELASTIC, NON-HAMILTONIAN - gameplay feature)
    // Merging is intentionally inelastic and breaks energy conservation
    // For physics validation, disable merging (enableMerging = false)
    if (this.config.enableMerging) {
      const toRemove: Set<number> = new Set()
      const toAdd: Star[] = []
      
      // Calculate energy before merge (for diagnostics)
      // This separates merge-induced energy loss from integrator drift
      let energyPreMerge: number | null = null
      if (this.energyStats) {
        energyPreMerge = this.energyStats.total
        // Store energy before merge for drift calculation
        if (!this.energyStats.lastEnergyBeforeMerge) {
          this.energyStats.lastEnergyBeforeMerge = energyPreMerge
        }
      } else {
        // Calculate energy on-the-fly if stats not initialized
        energyPreMerge = this.computeTotalEnergy()
      }
      
      for (let i = 0; i < this.stars.length; i++) {
        if (toRemove.has(i)) continue
        
        for (let j = i + 1; j < this.stars.length; j++) {
          if (toRemove.has(j)) continue
          
          // Use minimum-image convention for merge distance (consistent with force calculations)
          const distance = this.stars[i].distanceTo(
            this.stars[j],
            this.width,
            this.height,
            this.config.enableBoundaryWrapping
          )
          // Merge when stars touch: distance between centers < sum of radii
          // This means stars merge as soon as their edges touch
          const r1 = this.stars[i].radius
          const r2 = this.stars[j].radius
          const mergeDistance = r1 + r2 // Merge when stars touch (distance = sum of radii)
          if (distance < mergeDistance) {
            // Merge stars (wrapping-safe)
            const mergedStar = this.stars[i].mergeWith(
              this.stars[j],
              this.width,
              this.height,
              this.config.enableBoundaryWrapping
            )
            toRemove.add(i)
            toRemove.add(j)
            toAdd.push(mergedStar)
            break // Only merge one pair at a time per star
          }
        }
      }
      
      // Remove merged stars (in reverse order to maintain indices)
      const sortedIndices = Array.from(toRemove).sort((a, b) => b - a)
      for (const index of sortedIndices) {
        this.stars.splice(index, 1)
      }
      
      // Add merged stars
      this.stars.push(...toAdd)
      
      // Record merge energy change (if any merges occurred)
      // This is INELASTIC energy loss - expected and intentional
      if (toRemove.size > 0 && energyPreMerge !== null) {
        // Calculate energy after merge
        const energyPostMerge = this.computeTotalEnergy()
        const deltaEnergy = energyPostMerge - energyPreMerge
        
        // Record merge event
        if (!this.energyStats) {
          this.energyStats = {
            kinetic: 0,
            potential: 0,
            total: 0,
            history: [],
            trend: 'stable',
            mergeEvents: [],
            integratorDrift: 0,
            lastEnergyBeforeMerge: null
          }
        }
        if (!this.energyStats.mergeEvents) {
          this.energyStats.mergeEvents = []
        }
        this.energyStats.mergeEvents.push({
          frame: this.energyStats.history.length,
          energyPreMerge,
          energyPostMerge,
          deltaEnergy
        })
        // Keep only last 50 merge events
        if (this.energyStats.mergeEvents.length > 50) {
          this.energyStats.mergeEvents.shift()
        }
        
        // Update integrator drift: energy change from last merge to this merge
        // This excludes merge-induced energy loss
        if (this.energyStats.lastEnergyBeforeMerge !== null) {
          const driftSinceLastMerge = energyPreMerge - this.energyStats.lastEnergyBeforeMerge
          this.energyStats.integratorDrift += driftSinceLastMerge
        }
        this.energyStats.lastEnergyBeforeMerge = energyPostMerge
      }
    }
  }
  
  /**
   * Compute total energy (kinetic + potential)
   * Uses the SAME minimum-image convention as force calculations
   */
  private computeTotalEnergy(): number {
    if (this.stars.length === 0) {
      return 0
    }
    
    // Kinetic energy: K = Σ 0.5 * m * v²
    let kinetic = 0
    for (const star of this.stars) {
      const v2 = star.vx * star.vx + star.vy * star.vy
      kinetic += 0.5 * star.mass * v2
    }
    
    // Potential energy: U = Σ_{i<j} -G * m_i * m_j / r
    // Using the SAME minimum-image convention as force calculations
    let potential = 0
    for (let i = 0; i < this.stars.length; i++) {
      for (let j = i + 1; j < this.stars.length; j++) {
        const starA = this.stars[i]
        const starB = this.stars[j]
        
        // Use minimum-image convention (same as force calculations) - only if wrapping enabled
        let dx = starB.x - starA.x
        let dy = starB.y - starA.y
        if (this.config.enableBoundaryWrapping) {
          dx = minImageDelta(dx, this.width)
          dy = minImageDelta(dy, this.height)
        }
        const r = Math.sqrt(dx * dx + dy * dy + this.config.softeningEpsPx * this.config.softeningEpsPx)
        
        // Potential energy: U = -G * m1 * m2 / r
        potential -= (this.config.gravityConstant * starA.mass * starB.mass) / r
      }
    }
    
    return kinetic + potential
  }
  
  /**
   * Update energy statistics for diagnostics
   * Separates integrator drift (numerical error) from merge-induced energy loss (intentional)
   * 
   * For physics validation:
   * - Disable merging (enableMerging = false)
   * - Disable boundary wrapping (enableBoundaryWrapping = false)
   * - Use fixed timestep (already implemented)
   * - Energy should remain approximately constant (small integrator drift only)
   */
  private updateEnergyStats(): void {
    if (this.stars.length === 0) {
      this.energyStats = null
      return
    }
    
    // Compute total energy
    const total = this.computeTotalEnergy()
    
    // Separate kinetic and potential for display
    let kinetic = 0
    for (const star of this.stars) {
      const v2 = star.vx * star.vx + star.vy * star.vy
      kinetic += 0.5 * star.mass * v2
    }
    
    let potential = total - kinetic
    
    // Initialize or update energy stats
    if (!this.energyStats) {
      this.energyStats = {
        kinetic,
        potential,
        total,
        history: [total],
        trend: 'stable',
        mergeEvents: [],
        integratorDrift: 0,
        lastEnergyBeforeMerge: null
      }
    } else {
      // Update integrator drift (excluding merge events)
      // Only track drift if no merge occurred this step
      if (this.energyStats.lastEnergyBeforeMerge !== null) {
        const drift = total - this.energyStats.lastEnergyBeforeMerge
        this.energyStats.integratorDrift += drift
      } else if (this.energyStats.history.length > 0) {
        // Track drift from last energy measurement
        const lastEnergy = this.energyStats.history[this.energyStats.history.length - 1]
        const drift = total - lastEnergy
        this.energyStats.integratorDrift += drift
      }
      this.energyStats.kinetic = kinetic
      this.energyStats.potential = potential
      this.energyStats.total = total
      this.energyStats.history.push(total)
      
      // Keep only last 100 values for trend analysis
      if (this.energyStats.history.length > 100) {
        this.energyStats.history.shift()
      }
      
      // Detect energy trend (compare recent vs initial)
      if (this.energyStats.history.length > 10) {
        const initial = this.energyStats.history[0]
        const recent = this.energyStats.history[this.energyStats.history.length - 1]
        const changePercent = (recent - initial) / Math.abs(initial)
        
        // If energy decreased by more than 1%, mark as decreasing
        if (changePercent < -0.01) {
          this.energyStats.trend = 'decreasing'
        } else if (changePercent > 0.01) {
          this.energyStats.trend = 'increasing'
        } else {
          this.energyStats.trend = 'stable'
        }
      }
    }
  }
  
  /**
   * Get energy statistics for debug overlay
   */
  getEnergyStats() {
    return this.energyStats
  }

  getCreationState(): { 
    x: number
    y: number
    radius: number
    mass: number
    estimatedVelocity: number
    vCirc?: number
    vEsc?: number
  } | null {
    if (!this.isCreating) return null
    
    const now = performance.now() / 1000
    const holdDuration = now - this.creationStartTime
    
    // Get current scene's largest star mass (rounded to integer), or use default if no stars exist
    const currentMaxMass = this.stars.length > 0
      ? Math.floor(Math.max(...this.stars.map(s => s.mass)))
      : this.config.maxMass
    
    // Calculate mass based on hold time
    const t = Math.min(1, holdDuration / this.config.holdToMaxSeconds)
    // Use power curve that grows faster initially (easier to make massive stars)
    const eased = Math.pow(t, 0.7)
    const mass = this.config.minMass + (currentMaxMass - this.config.minMass) * eased
    
    // Radius is derived from mass (final radius is half of calculated value)
    const radius = (Math.pow(mass, this.config.radiusPower) * this.config.radiusScale) / 2
    
    // Estimate launch velocity from cursor movement
    let estimatedVelocity = 0
    if (this.cursorHistory.length >= 2) {
      const flickWindowSeconds = this.config.flickWindowMs / 1000
      const flickCutoff = now - flickWindowSeconds
      const flickHistory = this.cursorHistory.filter(point => point.time > flickCutoff)
      
      if (flickHistory.length >= 2) {
        let totalDx = 0
        let totalDy = 0
        
        for (let i = 1; i < flickHistory.length; i++) {
          const dt = flickHistory[i].time - flickHistory[i - 1].time
          if (dt > 0) {
            totalDx += (flickHistory[i].x - flickHistory[i - 1].x) / dt
            totalDy += (flickHistory[i].y - flickHistory[i - 1].y) / dt
          }
        }
        
        if (flickHistory.length > 1) {
          const rawVx = totalDx / (flickHistory.length - 1)
          const rawVy = totalDy / (flickHistory.length - 1)
          const rawSpeed = Math.sqrt(rawVx * rawVx + rawVy * rawVy)
          
          // Apply same transformations as actual launch
          const compressedSpeed = Math.min(this.config.flickVmax, this.config.flickVmax * (1 - Math.exp(-Math.min(rawSpeed, 550) / this.config.flickS0)))
          const launchSpeed = compressedSpeed * this.config.launchStrength
          const massResistance = 1 - (mass / currentMaxMass) * this.config.massResistanceFactor
          estimatedVelocity = launchSpeed * massResistance
        }
      }
    }
    
    // Calculate orbital parameters if near other stars
    let vCirc: number | undefined
    let vEsc: number | undefined
    if (this.stars.length > 0) {
      const position = { x: this.creationX, y: this.creationY }
      const orbitalCenter = findOrbitalCenter(
        position,
        this.stars,
        this.config.orbitalCenterSearchRadius,
        this.width,
        this.height,
        this.config.enableBoundaryWrapping
      )
      
      if (orbitalCenter) {
        const r = Math.sqrt(
          Math.pow(position.x - orbitalCenter.center.x, 2) + 
          Math.pow(position.y - orbitalCenter.center.y, 2)
        )
        if (r > 0) {
          vCirc = Math.sqrt((this.config.gravityConstant * orbitalCenter.totalMass) / r)
          vEsc = Math.sqrt(2 * (this.config.gravityConstant * orbitalCenter.totalMass) / r)
        }
      }
    }
    
    return {
      x: this.creationX,
      y: this.creationY,
      radius,
      mass,
      estimatedVelocity,
      vCirc,
      vEsc
    }
  }
  
  getDebugStats() {
    return this.debugStats
  }
}
