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
    // Track cursor globally (not just on canvas) so it's always visible
    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      this.cursorX = x
      this.cursorY = y
    })

    // Pointer down (start creation)
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

    // Pointer move (update creation or cursor)
    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      this.cursorX = x
      this.cursorY = y
      

      if (this.isPointerDown) {
        // Update creation position
        this.simulation.updateCreation(x, y)
      }
    })

    // Pointer up (finish creation)
    this.canvas.addEventListener('pointerup', (e) => {
      e.preventDefault()
      if (this.isPointerDown) {
        this.simulation.finishCreation()
        this.isPointerDown = false
      }
    })

    // Pointer cancel (cancel creation)
    this.canvas.addEventListener('pointercancel', (e) => {
      e.preventDefault()
      if (this.isPointerDown) {
        this.simulation.cancelCreation()
        this.isPointerDown = false
      }
    })

    // Mouse leave (cancel creation if dragging)
    this.canvas.addEventListener('mouseleave', () => {
      if (this.isPointerDown) {
        this.simulation.cancelCreation()
        this.isPointerDown = false
      }
    })

    // Touch events (for mobile)
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
    // Event listeners will be cleaned up when canvas is removed
  }
}

