// Gravity sim using Velocity Verlet. Fixed timestep keeps energy stable.
// Note: merging breaks energy conservation (inelastic). Wrapping makes it a torus, not free space.
// For physics validation, disable both.

import { GravityConfig, PhysicsMode } from './config'
import { Star } from './star'

// Basic vector ops for velocity guidance
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

// Torus wrapping: find shortest distance across boundaries
function minImageDelta(d: number, size: number): number {
  if (d > size / 2) {
    d -= size
  } else if (d < -size / 2) {
    d += size
  }
  return d
}

// Find what we're orbiting around (nearest star or center of mass if multiple nearby)
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
  
  // Find closest star
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
  
  // If multiple stars nearby, use center of mass instead
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
  
  // Weighted average position
  let totalMass = 0
  let weightedX = 0
  let weightedY = 0
  
  for (const { star, dx, dy } of nearbyStars) {
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

// Split velocity into toward/away from center vs around center
function decomposeVelocity(
  position: Vector2,
  center: Vector2,
  velocity: Vector2
): { radial: Vector2; tangential: Vector2 } {
  const r = subtract(position, center)
  const rLen = length(r)
  
  if (rLen === 0) {
    return { radial: { x: 0, y: 0 }, tangential: velocity }
  }
  
  const rUnit = normalize(r)
  
  // How much velocity points toward/away from center
  const radialMagnitude = dot(velocity, rUnit)
  const radial = scale(rUnit, radialMagnitude)
  
  // Rest is tangential (around the center)
  const tangential = subtract(velocity, radial)
  
  return { radial, tangential }
}

// Rotate velocity toward orbital direction without changing speed
// This keeps energy constant - just shapes the initial launch
function rotateVelocityTowardTangential(
  position: Vector2,
  center: Vector2,
  velocity: Vector2,
  guidanceStrength: number
): Vector2 {
  const EPS = 1e-6
  const speed = length(velocity)
  if (speed < EPS) return velocity
  
  const r = subtract(position, center)
  const rLen = length(r)
  if (rLen < EPS) return velocity
  
  const rHat = normalize(r)
  // Perpendicular to radial (counter-clockwise)
  const tHat = { x: -rHat.y, y: rHat.x }
  
  const vTangential = dot(velocity, tHat)
  const vHat = normalize(velocity)
  
  // Keep the same rotation direction
  const tangentialSign = vTangential >= 0 ? 1 : -1
  const tHatSigned = scale(tHat, tangentialSign)
  
  // Blend between current direction and pure orbital
  const desiredDir = normalize(
    add(
      scale(vHat, 1 - guidanceStrength),
      scale(tHatSigned, guidanceStrength)
    )
  )
  
  return scale(desiredDir, speed)
}

// Exponential speed compression - makes small flicks feel responsive, big ones don't go crazy
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
  centralSun: Star | null = null // Not used anymore - everything uses pairwise gravity now
  
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
  
  // Energy tracking - separates numerical drift from merge losses
  energyStats: {
    kinetic: number
    potential: number
    total: number
    history: number[] // Last 100 frames
    trend: 'stable' | 'decreasing' | 'increasing'
    mergeEvents: Array<{ frame: number; energyPreMerge: number; energyPostMerge: number; deltaEnergy: number }>
    integratorDrift: number // Energy change from numerical error (not merges)
    lastEnergyBeforeMerge: number | null
  } | null = null

  constructor(width: number, height: number, config: GravityConfig) {
    this.width = width
    this.height = height
    this.config = config
    this.initializePhysicsMode()
  }

  initializePhysicsMode(): void {
    // Everything uses pairwise gravity now
    this.centralSun = null
  }

  // Load universe from JSON - positions only, velocities computed for circular orbits
  loadUniverse(universe: { width: number; height: number; stars: Array<{ x: number; y: number; mass: number }> }): void {
    this.stars = []
    
    // Calculate center of mass of all stars (before shifting)
    let totalMass = 0
    let weightedX = 0
    let weightedY = 0
    for (const starData of universe.stars) {
      totalMass += starData.mass
      weightedX += starData.x * starData.mass
      weightedY += starData.y * starData.mass
    }
    
    // Calculate offset to center stars on actual canvas
    const universeCenterX = totalMass > 0 ? weightedX / totalMass : universe.width / 2
    const universeCenterY = totalMass > 0 ? weightedY / totalMass : universe.height / 2
    const canvasCenterX = this.width / 2
    const canvasCenterY = this.height / 2
    const offsetX = canvasCenterX - universeCenterX
    const offsetY = canvasCenterY - universeCenterY
    
    // Use canvas center for velocity calculations
    const centerX = canvasCenterX
    const centerY = canvasCenterY
    
    for (const starData of universe.stars) {
      // Shift star position to center on canvas
      const shiftedX = starData.x + offsetX
      const shiftedY = starData.y + offsetY
      
      // Calculate distance from canvas center
      const dx = shiftedX - centerX
      const dy = shiftedY - centerY
      const r = Math.sqrt(dx * dx + dy * dy)
      
      if (r < 1e-6) continue // Skip if at center
      
      // Circular orbit speed: sqrt(G*M/r)
      const centerMass = this.computeCenterOfMassMass()
      const vCirc = Math.sqrt((this.config.gravityConstant * centerMass) / r)
      const v = vCirc * this.config.orbitFactor
      
      // Perpendicular to radius (tangential)
      const angle = Math.atan2(dy, dx)
      const tangentialAngle = angle + Math.PI / 2
      const randomDeviation = 0 // Was random, disabled for consistency
      const finalAngle = tangentialAngle + randomDeviation
      
      const vx = Math.cos(finalAngle) * v
      const vy = Math.sin(finalAngle) * v
      
      const star = new Star(
        shiftedX,
        shiftedY,
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

  // Rough estimate of central mass for initial velocities
  private computeCenterOfMassMass(): number {
    if (this.stars.length === 0) return 100
    const totalMass = this.stars.reduce((sum, s) => sum + s.mass, 0)
    return totalMass / this.stars.length * 10 // Good enough approximation
  }

  updateConfig(config: GravityConfig): void {
    const oldMode = this.config.physicsMode
    this.config = config
    
    // ORBIT_PLAYGROUND needs zero damping for energy conservation
    if (config.physicsMode === PhysicsMode.ORBIT_PLAYGROUND) {
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
    
    // Mass grows with hold time, eased so it's easier to get big stars
    const t = Math.min(1, holdDuration / this.config.holdToMaxSeconds)
    const eased = Math.pow(t, 0.7) // 0.7 feels better than sqrt
    const mass = this.config.minMass + (currentMaxMass - this.config.minMass) * eased
    
    // Calculate launch velocity from flick gesture
    let vx = 0
    let vy = 0
    let releaseFlickSpeed = 0
    
    if (this.cursorHistory.length >= 2) {
      // Only use the last N ms before release
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
          
          // Cap at 550px/s - prevents crazy launches
          const MAX_RELEASE_SPEED = 550
          if (rawSpeed > MAX_RELEASE_SPEED) {
            const scale = MAX_RELEASE_SPEED / rawSpeed
            rawSpeed = MAX_RELEASE_SPEED
            rawVx *= scale
            rawVy *= scale
          }
          
          releaseFlickSpeed = rawSpeed
          
          const compressedSpeed = compressSpeed(rawSpeed, this.config.flickS0, this.config.flickVmax)
          const direction = rawSpeed > 0 ? { x: rawVx / rawSpeed, y: rawVy / rawSpeed } : { x: 0, y: 0 }
          
          vx = direction.x * compressedSpeed * this.config.launchStrength
          vy = direction.y * compressedSpeed * this.config.launchStrength
        }
      }
    }
    
    // Bigger stars launch slower
    const massResistance = 1 - (mass / currentMaxMass) * this.config.massResistanceFactor
    vx *= massResistance
    vy *= massResistance
    
    // Optional: nudge velocity toward orbital direction (doesn't change speed, just direction)
    if (this.config.angularGuidanceStrength > 0 && this.stars.length > 0) {
      const position = { x: this.creationX, y: this.creationY }
      const velocity = { x: vx, y: vy }
      
      const orbitalCenter = findOrbitalCenter(
        position,
        this.stars,
        this.config.orbitalCenterSearchRadius,
        this.width,
        this.height,
        this.config.enableBoundaryWrapping
      )
      
      if (orbitalCenter) {
        const guidedVelocity = rotateVelocityTowardTangential(
          position,
          orbitalCenter.center,
          velocity,
          this.config.angularGuidanceStrength
        )
        
        vx = guidedVelocity.x
        vy = guidedVelocity.y
        
        // For debug display
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
    
    const finalLaunchSpeed = Math.sqrt(vx * vx + vy * vy)
    
    // Create the star
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

  clearAllStars(): void {
    this.stars = []
    this.centralSun = null
    this.isCreating = false
    this.cursorHistory = []
    this.debugStats = null
    this.ripples = []
    this.energyStats = null
  }

  // Fixed timestep keeps energy stable
  private timeAccumulator: number = 0
  
  update(deltaTime: number): void {
    // Update ripples (non-physics updates)
    const now = performance.now() / 1000
    this.ripples = this.ripples.filter(ripple => {
      const age = now - ripple.time
      return age < ripple.duration
    })
    
    // Fixed timestep - keeps energy stable
    const fixedDt = 0.01
    this.timeAccumulator += deltaTime
    
    while (this.timeAccumulator >= fixedDt) {
      this.step(fixedDt)
      this.timeAccumulator -= fixedDt
    }
    
    // Update energy diagnostics after all substeps
    this.updateEnergyStats()
  }
  
  // Velocity Verlet: update positions and velocities in two passes
  step(dt: number): void {
    // Pass 1: compute forces, update positions
    const accelerations: Array<{ ax: number; ay: number }> = []
    
    for (let i = 0; i < this.stars.length; i++) {
      const starA = this.stars[i]
      let ax = 0
      let ay = 0
      
      // Pairwise gravity
      for (let j = 0; j < this.stars.length; j++) {
        if (i === j) continue
        const starB = this.stars[j]
        
        let dx = starB.x - starA.x
        let dy = starB.y - starA.y
        if (this.config.enableBoundaryWrapping) {
          dx = minImageDelta(dx, this.width)
          dy = minImageDelta(dy, this.height)
        }
        
        // Plummer softening prevents singularities
        const r2 = dx * dx + dy * dy + this.config.softeningEpsPx * this.config.softeningEpsPx
        const r = Math.sqrt(r2)
        const invR = 1 / r
        const invR3 = invR * invR * invR
        
        const forceMagnitude = this.config.gravityConstant * starA.mass * starB.mass * invR3
        const fx = dx * forceMagnitude
        const fy = dy * forceMagnitude
        
        ax += fx / starA.mass
        ay += fy / starA.mass
      }
      
      accelerations.push({ ax, ay })
      starA.updateVelocityVerletFirstHalf(dt, ax, ay, this.width, this.height, this.config)
    }
    
    // Pass 2: recompute forces at new positions, finish velocity update
    for (let i = 0; i < this.stars.length; i++) {
      const starA = this.stars[i]
      let ax = 0
      let ay = 0
      
      for (let j = 0; j < this.stars.length; j++) {
        if (i === j) continue
        const starB = this.stars[j]
        
        let dx = starB.x - starA.x
        let dy = starB.y - starA.y
        if (this.config.enableBoundaryWrapping) {
          dx = minImageDelta(dx, this.width)
          dy = minImageDelta(dy, this.height)
        }
        
        const r2 = dx * dx + dy * dy + this.config.softeningEpsPx * this.config.softeningEpsPx
        const r = Math.sqrt(r2)
        const invR = 1 / r
        const invR3 = invR * invR * invR
        
        const forceMagnitude = this.config.gravityConstant * starA.mass * starB.mass * invR3
        const fx = dx * forceMagnitude
        const fy = dy * forceMagnitude
        
        ax += fx / starA.mass
        ay += fy / starA.mass
      }
      
      starA.updateVelocityVerletSecondHalf(dt, ax, ay, this.config)
    }
    
    // Merging is inelastic - breaks energy conservation but feels good
    if (this.config.enableMerging) {
      const toRemove: Set<number> = new Set()
      const toAdd: Star[] = []
      
      // Track energy before merge for diagnostics
      let energyPreMerge: number | null = null
      if (this.energyStats) {
        energyPreMerge = this.energyStats.total
        if (!this.energyStats.lastEnergyBeforeMerge) {
          this.energyStats.lastEnergyBeforeMerge = energyPreMerge
        }
      } else {
        energyPreMerge = this.computeTotalEnergy()
      }
      
      for (let i = 0; i < this.stars.length; i++) {
        if (toRemove.has(i)) continue
        
        for (let j = i + 1; j < this.stars.length; j++) {
          if (toRemove.has(j)) continue
          
          const distance = this.stars[i].distanceTo(
            this.stars[j],
            this.width,
            this.height,
            this.config.enableBoundaryWrapping
          )
          // Merge when edges touch
          const r1 = this.stars[i].radius
          const r2 = this.stars[j].radius
          const mergeDistance = r1 + r2
          if (distance < mergeDistance) {
            const mergedStar = this.stars[i].mergeWith(
              this.stars[j],
              this.width,
              this.height,
              this.config.enableBoundaryWrapping
            )
            toRemove.add(i)
            toRemove.add(j)
            toAdd.push(mergedStar)
            break
          }
        }
      }
      
      // Remove in reverse order to keep indices valid
      const sortedIndices = Array.from(toRemove).sort((a, b) => b - a)
      for (const index of sortedIndices) {
        this.stars.splice(index, 1)
      }
      
      this.stars.push(...toAdd)
      
      // Track energy loss from merge
      if (toRemove.size > 0 && energyPreMerge !== null) {
        const energyPostMerge = this.computeTotalEnergy()
        const deltaEnergy = energyPostMerge - energyPreMerge
        
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
        if (this.energyStats.mergeEvents.length > 50) {
          this.energyStats.mergeEvents.shift()
        }
        
        // Track numerical drift separately from merge losses
        if (this.energyStats.lastEnergyBeforeMerge !== null) {
          const driftSinceLastMerge = energyPreMerge - this.energyStats.lastEnergyBeforeMerge
          this.energyStats.integratorDrift += driftSinceLastMerge
        }
        this.energyStats.lastEnergyBeforeMerge = energyPostMerge
      }
    }
  }
  
  // Total energy - uses same wrapping logic as forces
  private computeTotalEnergy(): number {
    if (this.stars.length === 0) {
      return 0
    }
    
    let kinetic = 0
    for (const star of this.stars) {
      const v2 = star.vx * star.vx + star.vy * star.vy
      kinetic += 0.5 * star.mass * v2
    }
    
    let potential = 0
    for (let i = 0; i < this.stars.length; i++) {
      for (let j = i + 1; j < this.stars.length; j++) {
        const starA = this.stars[i]
        const starB = this.stars[j]
        
        let dx = starB.x - starA.x
        let dy = starB.y - starA.y
        if (this.config.enableBoundaryWrapping) {
          dx = minImageDelta(dx, this.width)
          dy = minImageDelta(dy, this.height)
        }
        const r = Math.sqrt(dx * dx + dy * dy + this.config.softeningEpsPx * this.config.softeningEpsPx)
        
        potential -= (this.config.gravityConstant * starA.mass * starB.mass) / r
      }
    }
    
    return kinetic + potential
  }
  
  // Track energy over time - separates numerical drift from merge losses
  private updateEnergyStats(): void {
    if (this.stars.length === 0) {
      this.energyStats = null
      return
    }
    
    const total = this.computeTotalEnergy()
    
    let kinetic = 0
    for (const star of this.stars) {
      const v2 = star.vx * star.vx + star.vy * star.vy
      kinetic += 0.5 * star.mass * v2
    }
    
    let potential = total - kinetic
    
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
      // Track numerical drift (not from merges)
      if (this.energyStats.lastEnergyBeforeMerge !== null) {
        const drift = total - this.energyStats.lastEnergyBeforeMerge
        this.energyStats.integratorDrift += drift
      } else if (this.energyStats.history.length > 0) {
        const lastEnergy = this.energyStats.history[this.energyStats.history.length - 1]
        const drift = total - lastEnergy
        this.energyStats.integratorDrift += drift
      }
      this.energyStats.kinetic = kinetic
      this.energyStats.potential = potential
      this.energyStats.total = total
      this.energyStats.history.push(total)
      
      if (this.energyStats.history.length > 100) {
        this.energyStats.history.shift()
      }
      
      // Simple trend detection
      if (this.energyStats.history.length > 10) {
        const initial = this.energyStats.history[0]
        const recent = this.energyStats.history[this.energyStats.history.length - 1]
        const changePercent = (recent - initial) / Math.abs(initial)
        
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
    
    const currentMaxMass = this.stars.length > 0
      ? Math.floor(Math.max(...this.stars.map(s => s.mass)))
      : this.config.maxMass
    
    const t = Math.min(1, holdDuration / this.config.holdToMaxSeconds)
    const eased = Math.pow(t, 0.7)
    const mass = this.config.minMass + (currentMaxMass - this.config.minMass) * eased
    
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
          
          const compressedSpeed = Math.min(this.config.flickVmax, this.config.flickVmax * (1 - Math.exp(-Math.min(rawSpeed, 550) / this.config.flickS0)))
          const launchSpeed = compressedSpeed * this.config.launchStrength
          const massResistance = 1 - (mass / currentMaxMass) * this.config.massResistanceFactor
          estimatedVelocity = launchSpeed * massResistance
        }
      }
    }
    
    // Show orbital speeds if near other stars
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
