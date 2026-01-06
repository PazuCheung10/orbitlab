import { GravityConfig } from './config'

export interface TrailPoint {
  x: number
  y: number
  time: number
}

export class Star {
  x: number
  y: number
  vx: number // velocity x
  vy: number // velocity y
  mass: number
  age: number // Time since creation
  trail: TrailPoint[] = []
  creationTime: number
  isMerging: boolean = false
  private _radiusScale: number // Visual scale for radius calculation
  private _radiusPower: number // Power for radius calculation

  // For Leapfrog integrator: store half-step velocity
  vxHalf: number = 0
  vyHalf: number = 0

  constructor(x: number, y: number, mass: number, vx: number = 0, vy: number = 0, radiusScale: number = 1.2, radiusPower: number = 0.5) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    // Initialize half-step velocity for Leapfrog
    // For proper Leapfrog, v_half should be v - a*dt/2, but at creation we don't have acceleration yet
    // So we start with v_half = v, and the first kick will correct it
    this.vxHalf = vx
    this.vyHalf = vy
    this.mass = mass
    this._radiusScale = radiusScale
    this._radiusPower = radiusPower
    this.age = 0
    this.creationTime = performance.now() / 1000
  }

  // Radius is derived from mass: radius = (mass^radiusPower * radiusScale) / 2
  // radiusPower = 0.5 for 2D (area ∝ r²), 0.333 for 3D (volume ∝ r³)
  // Final radius is half of the calculated value
  get radius(): number {
    return (Math.pow(this.mass, this._radiusPower) * this._radiusScale) / 2
  }

  // Leapfrog integrator: kick-drift-kick
  // This conserves energy much better than explicit Euler
  updateLeapfrog(deltaTime: number, ax: number, ay: number, width: number, height: number, config: GravityConfig): void {
    // KICK 1: v_half = v + a * (dt/2)
    this.vxHalf += ax * (deltaTime / 2)
    this.vyHalf += ay * (deltaTime / 2)
    
    // DRIFT: x = x + v_half * dt
    this.x += this.vxHalf * deltaTime
    this.y += this.vyHalf * deltaTime
    
    // Apply minimal damping only if configured (default is 0)
    if (config.velocityDamping > 0) {
      this.vxHalf *= (1 - config.velocityDamping)
      this.vyHalf *= (1 - config.velocityDamping)
    }
    
    // Limit max speed to 1000 px/s (natural speed, not release speed)
    // NOTE: This can cause energy loss if stars hit the limit during close encounters
    // Consider increasing limit or removing for stable orbits
    const currentSpeed = Math.sqrt(this.vxHalf * this.vxHalf + this.vyHalf * this.vyHalf)
    if (currentSpeed > 1000) {
      const scale = 1000 / currentSpeed
      this.vxHalf *= scale
      this.vyHalf *= scale
    }
    
    // Periodic boundary conditions
    // WARNING: Boundary wrapping breaks energy conservation in orbital mechanics
    // For stable orbits, consider disabling wrapping or using larger invisible bounds
    // Current implementation wraps position but this causes energy loss
    while (this.x < 0) this.x += width
    while (this.x >= width) this.x -= width
    while (this.y < 0) this.y += height
    while (this.y >= height) this.y -= height
    
    // Update age
    this.age += deltaTime
    
    // Update trail for fast-moving stars
    const speed = Math.sqrt(this.vxHalf * this.vxHalf + this.vyHalf * this.vyHalf)
    if (speed > 10) {
      const now = performance.now() / 1000
      this.trail.push({ x: this.x, y: this.y, time: now })
      
      // Remove old trail points
      const cutoff = now - config.starTrailFadeTime
      this.trail = this.trail.filter(point => point.time > cutoff)
      
      // Limit trail length
      if (this.trail.length > config.starTrailLength) {
        this.trail = this.trail.slice(-config.starTrailLength)
      }
    } else {
      // Clear trail if moving slowly
      this.trail = []
    }
    
    // Sync full velocity for external access
    this.vx = this.vxHalf
    this.vy = this.vyHalf
  }

  // Complete the leapfrog step with second kick
  completeLeapfrog(deltaTime: number, ax: number, ay: number): void {
    // KICK 2: v = v_half + a_new * (dt/2)
    this.vxHalf += ax * (deltaTime / 2)
    this.vyHalf += ay * (deltaTime / 2)
    
    // Limit max speed to 1000 px/s (natural speed, not release speed)
    const finalSpeed = Math.sqrt(this.vxHalf * this.vxHalf + this.vyHalf * this.vyHalf)
    if (finalSpeed > 1000) {
      const scale = 1000 / finalSpeed
      this.vxHalf *= scale
      this.vyHalf *= scale
    }
    
    // Sync full velocity
    this.vx = this.vxHalf
    this.vy = this.vyHalf
  }

  distanceTo(other: Star): number {
    const dx = this.x - other.x
    const dy = this.y - other.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  distanceToPoint(x: number, y: number): number {
    const dx = this.x - x
    const dy = this.y - y
    return Math.sqrt(dx * dx + dy * dy)
  }

  mergeWith(other: Star): Star {
    // Combine masses (conservation of mass)
    const totalMass = this.mass + other.mass
    
    // Center of mass position
    const totalMassInv = 1 / totalMass
    const newX = (this.x * this.mass + other.x * other.mass) * totalMassInv
    const newY = (this.y * this.mass + other.y * other.mass) * totalMassInv
    
    // Conservation of momentum
    const newVx = (this.vx * this.mass + other.vx * other.mass) * totalMassInv
    const newVy = (this.vy * this.mass + other.vy * other.mass) * totalMassInv
    
    // Radius automatically follows from mass^radiusPower * radiusScale
    // Use the radiusScale and radiusPower from the larger star
    const radiusScale = this.mass >= other.mass ? this._radiusScale : other._radiusScale
    const radiusPower = this.mass >= other.mass ? this._radiusPower : other._radiusPower
    
    return new Star(newX, newY, totalMass, newVx, newVy, radiusScale, radiusPower)
  }
}
