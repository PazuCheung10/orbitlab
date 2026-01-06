import { GravitySimulation } from './simulation'

export class GravityInteraction {
  private canvas: HTMLCanvasElement
  private simulation: GravitySimulation
  private cursorX: number = -9999
  private cursorY: number = -9999
  private isPointerDown: boolean = false

  constructor(canvas: HTMLCanvasElement, simulation: GravitySimulation) {
    this.canvas = canvas
    this.simulation = simulation
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    // Track cursor everywhere so it's always visible
    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      this.cursorX = x
      this.cursorY = y
    })

    this.canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      const rect = this.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      this.cursorX = x
      this.cursorY = y
      this.isPointerDown = true
      this.simulation.startCreation(x, y)
    })

    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      this.cursorX = x
      this.cursorY = y
      

      if (this.isPointerDown) {
        this.simulation.updateCreation(x, y)
      }
    })

    this.canvas.addEventListener('pointerup', (e) => {
      e.preventDefault()
      if (this.isPointerDown) {
        this.simulation.finishCreation()
        this.isPointerDown = false
      }
    })

    this.canvas.addEventListener('pointercancel', (e) => {
      e.preventDefault()
      if (this.isPointerDown) {
        this.simulation.cancelCreation()
        this.isPointerDown = false
      }
    })

    this.canvas.addEventListener('mouseleave', () => {
      if (this.isPointerDown) {
        this.simulation.cancelCreation()
        this.isPointerDown = false
      }
    })

    // Touch support
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault()
      const rect = this.canvas.getBoundingClientRect()
      const touch = e.touches[0]
      if (touch) {
        const x = touch.clientX - rect.left
        const y = touch.clientY - rect.top
        this.cursorX = x
        this.cursorY = y
        this.isPointerDown = true
        this.simulation.startCreation(x, y)
      }
    }, { passive: false })

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault()
      const rect = this.canvas.getBoundingClientRect()
      const touch = e.touches[0]
      if (touch) {
        const x = touch.clientX - rect.left
        const y = touch.clientY - rect.top
        this.cursorX = x
        this.cursorY = y

        if (this.isPointerDown) {
          this.simulation.updateCreation(x, y)
        }
      }
    }, { passive: false })

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault()
      if (this.isPointerDown) {
        this.simulation.finishCreation()
        this.isPointerDown = false
      }
    }, { passive: false })
  }

  getCursorPosition(): { x: number; y: number } {
    return { x: this.cursorX, y: this.cursorY }
  }

  destroy(): void {
    // Cleanup handled by browser when canvas is removed
  }
}

