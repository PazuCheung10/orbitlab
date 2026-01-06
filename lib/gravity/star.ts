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

  // Velocity Verlet uses half-step velocities internally
  // vx/vy are just for display/external access
  vxHalf: number = 0
  vyHalf: number = 0

  constructor(x: number, y: number, mass: number, vx: number = 0, vy: number = 0, radiusScale: number = 1.2, radiusPower: number = 0.5) {
    this.x = x
    this.y = y
    this.vx = vx
    this.vy = vy
    // Start with half-step = full velocity (gets corrected on first step)
    this.vxHalf = vx
    this.vyHalf = vy
    this.mass = mass
    this._radiusScale = radiusScale
    this._radiusPower = radiusPower
    this.age = 0
    this.creationTime = performance.now() / 1000
  }

  // Radius from mass - divide by 2 so stars aren't too big
  get radius(): number {
    return (Math.pow(this.mass, this._radiusPower) * this._radiusScale) / 2
  }

  // First half of Velocity Verlet: update velocity, then position
  updateVelocityVerletFirstHalf(dt: number, ax: number, ay: number, width: number, height: number, config: GravityConfig): void {
    this.vxHalf += ax * (dt / 2)
    this.vyHalf += ay * (dt / 2)
    
    this.x += this.vxHalf * dt
    this.y += this.vyHalf * dt
    
    // Damping only in chaos mode
    if (config.velocityDamping > 0 && config.physicsMode !== 'ORBIT_PLAYGROUND') {
      this.vxHalf *= (1 - config.velocityDamping)
      this.vyHalf *= (1 - config.velocityDamping)
    }
    
    // Speed cap for chaos mode only
    if (config.physicsMode !== 'ORBIT_PLAYGROUND') {
      const currentSpeed = Math.sqrt(this.vxHalf * this.vxHalf + this.vyHalf * this.vyHalf)
      if (currentSpeed > 1000) {
        const scale = 1000 / currentSpeed
        this.vxHalf *= scale
        this.vyHalf *= scale
      }
    }
    
    // Torus wrapping
    if (config.enableBoundaryWrapping) {
      while (this.x < 0) this.x += width
      while (this.x >= width) this.x -= width
      while (this.y < 0) this.y += height
      while (this.y >= height) this.y -= height
    }
    
    this.age += dt
    
    // Trail for fast stars only
    const speed = Math.sqrt(this.vxHalf * this.vxHalf + this.vyHalf * this.vyHalf)
    if (speed > 10) {
      const now = performance.now() / 1000
      this.trail.push({ x: this.x, y: this.y, time: now })
      
      const cutoff = now - config.starTrailFadeTime
      this.trail = this.trail.filter(point => point.time > cutoff)
      
      if (this.trail.length > config.starTrailLength) {
        this.trail = this.trail.slice(-config.starTrailLength)
      }
    } else {
      this.trail = []
    }
  }

  // Second half: finish velocity update, sync for display
  updateVelocityVerletSecondHalf(dt: number, ax: number, ay: number, config?: GravityConfig): void {
    this.vxHalf += ax * (dt / 2)
    this.vyHalf += ay * (dt / 2)
    
    if (config && config.physicsMode !== 'ORBIT_PLAYGROUND') {
      const finalSpeed = Math.sqrt(this.vxHalf * this.vxHalf + this.vyHalf * this.vyHalf)
      if (finalSpeed > 1000) {
        const scale = 1000 / finalSpeed
        this.vxHalf *= scale
        this.vyHalf *= scale
      }
    }
    
    // Sync for external access
    this.vx = this.vxHalf
    this.vy = this.vyHalf
  }

  distanceTo(other: Star, width?: number, height?: number, enableWrapping?: boolean): number {
    let dx = this.x - other.x
    let dy = this.y - other.y
    
    if (enableWrapping && width !== undefined && height !== undefined) {
      if (dx > width / 2) dx -= width
      else if (dx < -width / 2) dx += width
      if (dy > height / 2) dy -= height
      else if (dy < -height / 2) dy += height
    }
    
    return Math.sqrt(dx * dx + dy * dy)
  }

  distanceToPoint(x: number, y: number, width?: number, height?: number, enableWrapping?: boolean): number {
    let dx = this.x - x
    let dy = this.y - y
    
    if (enableWrapping && width !== undefined && height !== undefined) {
      if (dx > width / 2) dx -= width
      else if (dx < -width / 2) dx += width
      if (dy > height / 2) dy -= height
      else if (dy < -height / 2) dy += height
    }
    
    return Math.sqrt(dx * dx + dy * dy)
  }

  // Merge two stars - inelastic, loses energy but feels good
  mergeWith(other: Star, width?: number, height?: number, enableWrapping?: boolean): Star {
    const totalMass = this.mass + other.mass
    
    let otherX = other.x
    let otherY = other.y
    
    if (enableWrapping && width !== undefined && height !== undefined) {
      // Unwrap position for proper center-of-mass calculation
      let dx = other.x - this.x
      let dy = other.y - this.y
      
      if (dx > width / 2) dx -= width
      else if (dx < -width / 2) dx += width
      if (dy > height / 2) dy -= height
      else if (dy < -height / 2) dy += height
      
      otherX = this.x + dx
      otherY = this.y + dy
      
      const totalMassInv = 1 / totalMass
      let comX = (this.x * this.mass + otherX * other.mass) * totalMassInv
      let comY = (this.y * this.mass + otherY * other.mass) * totalMassInv
      
      // Wrap back
      while (comX < 0) comX += width
      while (comX >= width) comX -= width
      while (comY < 0) comY += height
      while (comY >= height) comY -= height
      
      const newX = comX
      const newY = comY
      
      // Momentum conserved
      const newVx = (this.vx * this.mass + other.vx * other.mass) * totalMassInv
      const newVy = (this.vy * this.mass + other.vy * other.mass) * totalMassInv
      
      const radiusScale = this.mass >= other.mass ? this._radiusScale : other._radiusScale
      const radiusPower = this.mass >= other.mass ? this._radiusPower : other._radiusPower
      
      return new Star(newX, newY, totalMass, newVx, newVy, radiusScale, radiusPower)
    }
    
    // No wrapping - simple case
    const totalMassInv = 1 / totalMass
    const newX = (this.x * this.mass + otherX * other.mass) * totalMassInv
    const newY = (this.y * this.mass + otherY * other.mass) * totalMassInv
    
    const newVx = (this.vx * this.mass + other.vx * other.mass) * totalMassInv
    const newVy = (this.vy * this.mass + other.vy * other.mass) * totalMassInv
    
    const radiusScale = this.mass >= other.mass ? this._radiusScale : other._radiusScale
    const radiusPower = this.mass >= other.mass ? this._radiusPower : other._radiusPower
    
    return new Star(newX, newY, totalMass, newVx, newVy, radiusScale, radiusPower)
  }
}
