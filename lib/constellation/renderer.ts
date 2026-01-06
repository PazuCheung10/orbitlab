import { RuntimeConfig } from './config'
import { Simulation, ConnectionType } from './simulation'

export class Renderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private config: RuntimeConfig

  constructor(canvas: HTMLCanvasElement, config: RuntimeConfig) {
    this.canvas = canvas
    this.config = config
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to get 2D context')
    }
    this.ctx = context
  }

  updateConfig(config: RuntimeConfig): void {
    this.config = config
    // Update cursor visibility
    this.canvas.style.cursor = config.showNativeCursor ? 'default' : 'none'
  }

  resize(width: number, height: number): void {
    this.canvas.width = width
    this.canvas.height = height
  }

  render(simulation: Simulation): void {
    // Clear canvas
    this.ctx.fillStyle = '#0a0a0a'
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // 3) TRAIL MEMORY: Draw cursor trail (subtle, behind everything)
    if (this.config.trailLength > 0 && simulation.cursorTrail.length > 1) {
      this.drawTrail(simulation.cursorTrail)
    }

    // 2) LOCAL CONSTELLATION LINES: Draw constellation connections
    this.ctx.strokeStyle = '#ffffff'
    this.ctx.lineWidth = this.config.lineWidth
    this.ctx.lineCap = 'round'

    for (const connType of simulation.connections) {
      if (connType.type === 'constellation') {
        const conn = connType.connection
      if (conn.strength > 0.05) {
          this.ctx.globalAlpha = conn.getOpacity(this.config, 'constellation')
        this.ctx.beginPath()
        this.ctx.moveTo(conn.nodeA.x, conn.nodeA.y)
        this.ctx.lineTo(conn.nodeB.x, conn.nodeB.y)
        this.ctx.stroke()
        }
      }
    }

    // 1) CURSOR TETHER: Draw tether lines (strongest, most visible)
    this.ctx.lineWidth = this.config.lineWidth * 1.2
    for (const connType of simulation.connections) {
      if (connType.type === 'tether' && connType.connection.tetherTarget) {
        const conn = connType.connection
        const target = conn.tetherTarget
        if (target && conn.strength > 0.05 && target.energy > 0.1) {
          this.ctx.globalAlpha = conn.getOpacity(this.config, 'tether')
          this.ctx.beginPath()
          this.ctx.moveTo(simulation.cursorX, simulation.cursorY)
          this.ctx.lineTo(target.x, target.y)
          this.ctx.stroke()
        }
      }
    }

    // Draw nodes
    for (const node of simulation.nodes) {
      const size = node.size * node.pulseIntensity
      const opacity = node.currentOpacity * node.pulseIntensity

      // Glow effect
      const gradient = this.ctx.createRadialGradient(
        node.x, node.y, 0,
        node.x, node.y, this.config.nodeGlowRadius * node.pulseIntensity
      )
      gradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`)
      gradient.addColorStop(0.5, `rgba(255, 255, 255, ${opacity * 0.3})`)
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

      this.ctx.fillStyle = gradient
      this.ctx.beginPath()
      this.ctx.arc(node.x, node.y, this.config.nodeGlowRadius * node.pulseIntensity, 0, Math.PI * 2)
      this.ctx.fill()

      // Node core
      this.ctx.globalAlpha = opacity
      this.ctx.fillStyle = '#ffffff'
      this.ctx.beginPath()
      this.ctx.arc(node.x, node.y, size, 0, Math.PI * 2)
      this.ctx.fill()
    }

    // Draw comet cursor (on top of everything)
    if (this.config.showCometCursor && simulation.cursorX > -9999) {
      this.drawComet(simulation.cursorX, simulation.cursorY, simulation.cursorTrail)
    }

    this.ctx.globalAlpha = 1.0
  }

  private drawTrail(trail: Array<{ x: number; y: number; time: number }>): void {
    if (trail.length < 2) return

    const now = performance.now() / 1000
    this.ctx.strokeStyle = '#ffffff'
    this.ctx.lineWidth = this.config.lineWidth * 0.5
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'

    this.ctx.beginPath()
    for (let i = 0; i < trail.length; i++) {
      const point = trail[i]
      const age = now - point.time
      const fade = Math.max(0, 1 - (age / this.config.trailFadeTime))
      const opacity = fade * this.config.trailTailOpacity * 0.3 // Very subtle

      if (i === 0) {
        this.ctx.moveTo(point.x, point.y)
      } else {
        this.ctx.lineTo(point.x, point.y)
      }
    }

    // Draw with gradient opacity
    const gradient = this.ctx.createLinearGradient(
      trail[0].x, trail[0].y,
      trail[trail.length - 1].x, trail[trail.length - 1].y
    )
    gradient.addColorStop(0, `rgba(255, 255, 255, ${this.config.trailTailOpacity * 0.1})`)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    this.ctx.strokeStyle = gradient
    this.ctx.globalAlpha = 1.0
    this.ctx.stroke()
  }

  private drawComet(cursorX: number, cursorY: number, trail: Array<{ x: number; y: number; time: number }>): void {
    // Draw tail (short, based on recent positions)
    if (trail.length > 1) {
      const tailLength = Math.min(this.config.cometTailLength, trail.length)
      const tailPoints = trail.slice(-tailLength)
      
      if (tailPoints.length > 1) {
        this.ctx.strokeStyle = '#ffffff'
        this.ctx.lineWidth = this.config.lineWidth
        this.ctx.lineCap = 'round'
        this.ctx.lineJoin = 'round'
        
        const gradient = this.ctx.createLinearGradient(
          tailPoints[0].x, tailPoints[0].y,
          cursorX, cursorY
        )
        gradient.addColorStop(0, `rgba(255, 255, 255, ${this.config.cometTailOpacity * 0.3})`)
        gradient.addColorStop(1, `rgba(255, 255, 255, ${this.config.cometTailOpacity})`)
        
        this.ctx.strokeStyle = gradient
        this.ctx.globalAlpha = 1.0
        this.ctx.beginPath()
        this.ctx.moveTo(tailPoints[0].x, tailPoints[0].y)
        for (let i = 1; i < tailPoints.length; i++) {
          this.ctx.lineTo(tailPoints[i].x, tailPoints[i].y)
        }
        this.ctx.lineTo(cursorX, cursorY)
        this.ctx.stroke()
      }
    }

    // Draw comet head (glowing dot)
    const headGradient = this.ctx.createRadialGradient(
      cursorX, cursorY, 0,
      cursorX, cursorY, this.config.cometHeadGlow
    )
    headGradient.addColorStop(0, `rgba(255, 255, 255, ${this.config.cometTailOpacity})`)
    headGradient.addColorStop(0.5, `rgba(255, 255, 255, ${this.config.cometTailOpacity * 0.5})`)
    headGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

    this.ctx.fillStyle = headGradient
    this.ctx.beginPath()
    this.ctx.arc(cursorX, cursorY, this.config.cometHeadGlow, 0, Math.PI * 2)
    this.ctx.fill()

    // Comet core
    this.ctx.globalAlpha = 1.0
    this.ctx.fillStyle = '#ffffff'
    this.ctx.beginPath()
    this.ctx.arc(cursorX, cursorY, this.config.cometHeadSize, 0, Math.PI * 2)
    this.ctx.fill()
  }
}
