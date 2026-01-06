import { GRAVITY_CONFIG, GravityConfig } from './config'
import { GravitySimulation } from './simulation'
import { GravityRenderer } from './renderer'
import { GravityInteraction } from './interaction'

export class GravitySystem {
  private canvas: HTMLCanvasElement
  public simulation: GravitySimulation
  public renderer: GravityRenderer
  private interaction: GravityInteraction
  private animationFrameId: number | null = null
  private lastTime: number = performance.now()
  private isRunning: boolean = false
  private config: GravityConfig

  constructor(canvas: HTMLCanvasElement, config: GravityConfig = GRAVITY_CONFIG) {
    this.canvas = canvas
    this.config = { ...config }
    
    // Initialize components
    const width = window.innerWidth
    const height = window.innerHeight
    
    this.simulation = new GravitySimulation(width, height, this.config)
    this.renderer = new GravityRenderer(canvas, this.config)
    this.renderer.resize(width, height)
    this.interaction = new GravityInteraction(canvas, this.simulation)
    
    // Handle resize
    this.handleResize()
    window.addEventListener('resize', () => this.handleResize())
    
    // Start animation loop
    this.start()
  }

  updateConfig(config: GravityConfig): void {
    this.config = { ...config }
    this.simulation.updateConfig(this.config)
    this.renderer.updateConfig(this.config)
  }

  loadUniverse(universe: { width: number; height: number; stars: Array<{ x: number; y: number; mass: number }> }): void {
    this.simulation.loadUniverse(universe)
  }

  clearAllStars(): void {
    this.simulation.clearAllStars()
  }

  getConfig(): GravityConfig {
    return { ...this.config }
  }

  private handleResize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    this.renderer.resize(width, height)
    this.simulation.resize(width, height)
  }

  private start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.lastTime = performance.now()
    this.animate()
  }

  private animate = (): void => {
    if (!this.isRunning) return

    const currentTime = performance.now()
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1) // Cap at 100ms
    this.lastTime = currentTime

    // Update simulation
    this.simulation.update(deltaTime)

    // Update cursor trail
    const cursorPos = this.interaction.getCursorPosition()
    this.renderer.updateCursorTrail(cursorPos.x, cursorPos.y)

    // Render
    this.renderer.render(this.simulation, cursorPos.x, cursorPos.y)

    this.animationFrameId = requestAnimationFrame(this.animate)
  }

  destroy(): void {
    this.isRunning = false
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
    }
    this.interaction.destroy()
    window.removeEventListener('resize', () => this.handleResize())
  }
}

