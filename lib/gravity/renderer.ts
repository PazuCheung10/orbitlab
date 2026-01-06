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
    // Clear background
    this.ctx.fillStyle = '#0a0a0a'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    
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
    // Glow size based on mass - bigger stars glow more
    const baseGlow = star.radius * 1.5
    const glowMultiplier = this.config.radiusScale !== 1.0 
      ? this.config.glowRadiusMultiplier / this.config.radiusScale 
      : this.config.glowRadiusMultiplier
    const massGlow = star.mass * glowMultiplier
    const glowRadius = baseGlow + massGlow
    
    const opacity = Math.min(1.0, star.mass * this.config.opacityMultiplier)
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

    // Actual star (this is what collides)
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

    // Fade from start to end
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

  private drawCreatingStar(state: { 
    x: number
    y: number
    radius: number
    mass: number
    estimatedVelocity: number
    vCirc?: number
    vEsc?: number
  }, cursorX: number, cursorY: number): void {
    const radius = state.radius
    
    // Reverse the radius calculation to get mass for glow
    const radiusPower = this.config.radiusPower || 0.5
    const mass = Math.pow((radius * 2) / this.config.radiusScale, 1 / radiusPower)
    
    const baseGlow = radius * 1.5
    const glowMultiplier = this.config.radiusScale !== 1.0 
      ? this.config.glowRadiusMultiplier / this.config.radiusScale 
      : this.config.glowRadiusMultiplier
    const massGlow = mass * glowMultiplier
    const glowRadius = baseGlow + massGlow
    
    const opacity = Math.min(1.0, mass * this.config.opacityMultiplier)
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

    this.ctx.globalAlpha = opacity
    this.ctx.fillStyle = '#ffffff'
    this.ctx.beginPath()
    this.ctx.arc(state.x, state.y, radius, 0, Math.PI * 2)
    this.ctx.fill()
    this.ctx.globalAlpha = 1.0

    // Show launch direction arrow
    if (this.cursorTrail.length > 1) {
      const lastPoint = this.cursorTrail[this.cursorTrail.length - 1]
      const prevPoint = this.cursorTrail[this.cursorTrail.length - 2]
      const dx = lastPoint.x - prevPoint.x
      const dy = lastPoint.y - prevPoint.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      
      if (dist > 2) {
        const dirLen = Math.min(50, state.estimatedVelocity * 0.1)
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        this.ctx.lineWidth = 2
        this.ctx.beginPath()
        this.ctx.moveTo(state.x, state.y)
        this.ctx.lineTo(state.x + (dx / dist) * dirLen, state.y + (dy / dist) * dirLen)
        this.ctx.stroke()
        
        // Arrowhead
        const arrowLen = 8
        const angle = Math.atan2(dy, dx)
        this.ctx.beginPath()
        this.ctx.moveTo(
          state.x + (dx / dist) * dirLen,
          state.y + (dy / dist) * dirLen
        )
        this.ctx.lineTo(
          state.x + (dx / dist) * dirLen - arrowLen * Math.cos(angle - Math.PI / 6),
          state.y + (dy / dist) * dirLen - arrowLen * Math.sin(angle - Math.PI / 6)
        )
        this.ctx.moveTo(
          state.x + (dx / dist) * dirLen,
          state.y + (dy / dist) * dirLen
        )
        this.ctx.lineTo(
          state.x + (dx / dist) * dirLen - arrowLen * Math.cos(angle + Math.PI / 6),
          state.y + (dy / dist) * dirLen - arrowLen * Math.sin(angle + Math.PI / 6)
        )
        this.ctx.stroke()
      }
    }
    
    // Debug info
    this.ctx.save()
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    this.ctx.font = '12px monospace'
    this.ctx.textAlign = 'left'
    this.ctx.textBaseline = 'top'
    
    const infoY = state.y + radius + 15
    let lineHeight = 16
    let currentY = infoY
    
    // Mass
    this.ctx.fillText(`Mass: ${state.mass.toFixed(1)}`, state.x + radius + 10, currentY)
    currentY += lineHeight
    
    // Estimated velocity
    if (state.estimatedVelocity > 0) {
      this.ctx.fillText(`Velocity: ${state.estimatedVelocity.toFixed(1)} px/s`, state.x + radius + 10, currentY)
      currentY += lineHeight
      
      // Orbital speeds
      if (state.vCirc !== undefined) {
        const ratio = state.estimatedVelocity / state.vCirc
        let color = 'rgba(255, 255, 255, 0.9)'
        if (ratio < 0.8) color = 'rgba(255, 200, 0, 0.9)' // Too slow
        else if (ratio > 1.2) color = 'rgba(255, 100, 100, 0.9)' // Too fast
        else color = 'rgba(100, 255, 100, 0.9)' // Good
        
        this.ctx.fillStyle = color
        this.ctx.fillText(`v_circ: ${state.vCirc.toFixed(1)} px/s`, state.x + radius + 10, currentY)
        currentY += lineHeight
        
        if (state.vEsc !== undefined) {
          this.ctx.fillText(`v_esc: ${state.vEsc.toFixed(1)} px/s`, state.x + radius + 10, currentY)
          currentY += lineHeight
          
          this.ctx.fillStyle = 'rgba(200, 200, 255, 0.9)'
          this.ctx.fillText(`Ratio: ${ratio.toFixed(2)}x`, state.x + radius + 10, currentY)
        }
      }
    }
    
    this.ctx.restore()
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
    if (x < 0 || y < 0) return

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

    // Cursor head
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

    this.ctx.globalAlpha = 1.0
    this.ctx.fillStyle = '#ffffff'
    this.ctx.beginPath()
    this.ctx.arc(x, y, this.config.cometHeadSize, 0, Math.PI * 2)
    this.ctx.fill()
  }
}

