import { GravityConfig } from './config'
import { GravitySimulation } from './simulation'
import { Star } from './star'

export class GravityRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private config: GravityConfig
  private cursorTrail: Array<{ x: number; y: number; opacity: number }> = []

  constructor(canvas: HTMLCanvasElement, config: GravityConfig) {
    this.canvas = canvas
    this.config = config
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to get 2D context')
    }
    this.ctx = context
    
    // Hide native cursor
    this.canvas.style.cursor = 'none'
  }

  updateConfig(config: GravityConfig): void {
    this.config = config
  }

  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
  }

  updateCursorTrail(x: number, y: number): void {
    // Add new point with full opacity
    this.cursorTrail.push({ x, y, opacity: 1.0 })
    
    // Apply exponential decay to all points (fast to slow)
    for (let i = 0; i < this.cursorTrail.length; i++) {
      this.cursorTrail[i].opacity *= (1 - this.config.cometTailFadeRate)
    }
    
    // Remove points that are too faint
    this.cursorTrail = this.cursorTrail.filter(point => point.opacity > 0.01)
    
    // Limit trail length
    if (this.cursorTrail.length > this.config.cometTailLength) {
      this.cursorTrail = this.cursorTrail.slice(-this.config.cometTailLength)
    }
  }

  render(simulation: GravitySimulation, cursorX: number, cursorY: number): void {
    // Clear canvas FIRST
    this.ctx.fillStyle = '#0a0a0a'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    
    // Draw central sun if in ORBIT_PLAYGROUND mode (after clearing)
    if (simulation.centralSun) {
      this.drawStar(simulation.centralSun)
    }

    // Draw star trails (behind stars)
    for (const star of simulation.stars) {
      if (star.trail.length > 1) {
        this.drawStarTrail(star.trail)
      }
    }

    // Draw stars
    for (const star of simulation.stars) {
      this.drawStar(star)
    }

    // Draw creation ripple
    const now = performance.now() / 1000
    for (const ripple of simulation.ripples) {
      this.drawRipple(ripple, now)
    }

    // Draw star being created (if any)
    const creationState = simulation.getCreationState()
    if (creationState) {
      this.drawCreatingStar(creationState, cursorX, cursorY)
    }

    // Draw comet cursor (on top)
    this.drawCometCursor(cursorX, cursorY)
  }

  private drawStar(star: Star): void {
    // Glow radius scales with mass (purely visual, doesn't affect physics)
    // Base glow + mass-dependent scaling (linear)
    const baseGlow = star.radius * 1.5 // Start from physical radius
    const massGlow = star.mass * this.config.glowRadiusMultiplier // Linear scaling with mass
    const glowRadius = baseGlow + massGlow
    
    // Opacity scales with mass: opacity = mass * opacityMultiplier (clamped 0-1)
    const opacity = Math.min(1.0, star.mass * this.config.opacityMultiplier)

    // Draw glow (purely visual, larger for more massive stars)
    const gradient = this.ctx.createRadialGradient(
      star.x, star.y, 0,
      star.x, star.y, glowRadius
    )
    gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`)
    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${opacity * 0.4})`)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    this.ctx.fillStyle = gradient
    this.ctx.beginPath()
    this.ctx.arc(star.x, star.y, glowRadius, 0, Math.PI * 2)
    this.ctx.fill()

    // Star core (physical radius - used for collision/merging)
    // This is the actual star.radius, not the glow radius
    this.ctx.globalAlpha = opacity
    this.ctx.fillStyle = '#ffffff'
    this.ctx.beginPath()
    this.ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.globalAlpha = 1.0
  }

  private drawStarTrail(trail: Array<{ x: number; y: number; time: number }>): void {
    if (trail.length < 2) return

    const now = performance.now() / 1000
    this.ctx.strokeStyle = '#ffffff'
    this.ctx.lineWidth = 1
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    this.ctx.beginPath()
    for (let i = 0; i < trail.length; i++) {
      const point = trail[i]
      const age = now - point.time
      const fade = Math.max(0, 1 - (age / this.config.starTrailFadeTime))
      const opacity = fade * 0.3

      if (i === 0) {
        this.ctx.moveTo(point.x, point.y)
      } else {
        this.ctx.lineTo(point.x, point.y)
      }
    }

    // Draw with gradient
    const gradient = this.ctx.createLinearGradient(
      trail[0].x, trail[0].y,
      trail[trail.length - 1].x, trail[trail.length - 1].y
    )
    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.1})`)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    this.ctx.strokeStyle = gradient
    this.ctx.globalAlpha = 1.0
    this.ctx.stroke()
  }

  private drawCreatingStar(state: { x: number; y: number; radius: number }, cursorX: number, cursorY: number): void {
    // Draw growing star with subtle pulse
    const pulse = 1 + Math.sin(performance.now() / 100) * 0.1
    let radius = state.radius * pulse
    
    // Calculate mass from radius (reverse of radius = (mass^radiusPower * radiusScale) / 2)
    // mass = ((radius * 2) / radiusScale)^(1/radiusPower)
    const radiusPower = this.config.radiusPower || 0.5
    const mass = Math.pow((radius * 2) / this.config.radiusScale, 1 / radiusPower)
    
    // Glow radius scales with mass (purely visual)
    // Base glow + mass-dependent scaling (linear)
    const baseGlow = radius * 1.5 // Start from physical radius
    const massGlow = mass * this.config.glowRadiusMultiplier // Linear scaling with mass
    const glowRadius = baseGlow + massGlow
    
    // Opacity scales with mass (same as regular stars): opacity = mass * opacityMultiplier
    const opacity = Math.min(1.0, mass * this.config.opacityMultiplier)

    // Draw glow (purely visual)
    const gradient = this.ctx.createRadialGradient(
      state.x, state.y, 0,
      state.x, state.y, glowRadius
    )
    gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`)
    gradient.addColorStop(0.5, `rgba(255, 255, 255, ${opacity * 0.4})`)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    this.ctx.fillStyle = gradient
    this.ctx.beginPath()
    this.ctx.arc(state.x, state.y, glowRadius, 0, Math.PI * 2)
    this.ctx.fill()

    // Star core (physical radius - used for collision/merging)
    this.ctx.globalAlpha = opacity
    this.ctx.fillStyle = '#ffffff'
    this.ctx.beginPath()
    this.ctx.arc(state.x, state.y, radius, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.globalAlpha = 1.0

    // Show launch direction hint if cursor has moved
    if (this.cursorTrail.length > 1) {
      const lastPoint = this.cursorTrail[this.cursorTrail.length - 1]
      const prevPoint = this.cursorTrail[this.cursorTrail.length - 2]
      const dx = lastPoint.x - prevPoint.x
      const dy = lastPoint.y - prevPoint.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      if (dist > 2) {
        // Draw subtle direction indicator
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        this.ctx.lineWidth = 1
        this.ctx.beginPath()
        this.ctx.moveTo(state.x, state.y)
        this.ctx.lineTo(state.x + dx * 0.5, state.y + dy * 0.5)
        this.ctx.stroke()
      }
    }
  }

  private drawRipple(ripple: { x: number; y: number; time: number; maxRadius: number; duration: number }, now: number): void {
    const age = now - ripple.time
    const progress = age / ripple.duration
    if (progress >= 1) return

    const radius = ripple.maxRadius * progress
    const opacity = (1 - progress) * 0.4

    this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2)
    this.ctx.stroke()
  }

  private drawCometCursor(x: number, y: number): void {
    if (x < 0 || y < 0) return // Cursor not initialized

    // Draw tail (with exponential fade)
    if (this.cursorTrail.length > 1) {
      this.ctx.strokeStyle = '#ffffff'
      this.ctx.lineWidth = 2
      this.ctx.lineCap = 'round'
      this.ctx.lineJoin = 'round'

      this.ctx.beginPath()
      for (let i = 0; i < this.cursorTrail.length; i++) {
        const point = this.cursorTrail[i]
        this.ctx.globalAlpha = point.opacity * this.config.cometTailOpacity

        if (i === 0) {
          this.ctx.moveTo(point.x, point.y)
        } else {
          this.ctx.lineTo(point.x, point.y)
        }
      }
      // Connect to current cursor position
      this.ctx.lineTo(x, y)
      this.ctx.stroke()
    }

    // Draw comet head (glowing dot)
    const headGradient = this.ctx.createRadialGradient(
      x, y, 0,
      x, y, this.config.cometHeadGlow
    )
    headGradient.addColorStop(0, `rgba(255, 255, 255, ${this.config.cometTailOpacity})`)
    headGradient.addColorStop(0.5, `rgba(255, 255, 255, ${this.config.cometTailOpacity * 0.5})`)
    headGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    this.ctx.fillStyle = headGradient
    this.ctx.beginPath()
    this.ctx.arc(x, y, this.config.cometHeadGlow, 0, Math.PI * 2)
    this.ctx.fill()

    // Comet core
    this.ctx.globalAlpha = 1.0
    this.ctx.fillStyle = '#ffffff'
    this.ctx.beginPath()
    this.ctx.arc(x, y, this.config.cometHeadSize, 0, Math.PI * 2)
    this.ctx.fill()
  }
}

