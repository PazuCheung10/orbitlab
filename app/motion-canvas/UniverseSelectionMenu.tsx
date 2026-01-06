'use client'

import { useState, useEffect, useRef } from 'react'
import { GravityConfig } from '@/lib/gravity/config'
import { UNIVERSE_PRESETS } from '@/lib/gravity/universe-presets'
import { GravitySimulation } from '@/lib/gravity/simulation'
// @ts-ignore - JSON import
import initialUniverseData from '@/initial-universe.json'
const initialUniverse = initialUniverseData as { width: number; height: number; stars: Array<{ x: number; y: number; mass: number }> }
import styles from './UniverseSelectionMenu.module.css'

interface SavedState {
  stars: Array<{ x: number; y: number; vx: number; vy: number; mass: number; vxHalf: number; vyHalf: number; age: number }>
  config: GravityConfig
  timestamp: number
  name: string
}

interface UniverseSelectionMenuProps {
  onSelectUniverse: (config: GravityConfig, universeKey: string) => void
  currentConfig: GravityConfig
}

export default function UniverseSelectionMenu({ onSelectUniverse, currentConfig }: UniverseSelectionMenuProps) {
  const [savedStates, setSavedStates] = useState<SavedState[]>([])
  const previewRefs = useRef<Array<HTMLCanvasElement | null>>([])
  const simulationRefs = useRef<Array<GravitySimulation | null>>([])
  const animationFrameRefs = useRef<Array<number | null>>([])

  // Load saved states from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gravitySavedStates')
      if (saved) {
        const parsed = JSON.parse(saved) as SavedState[]
        setSavedStates(parsed)
      }
    } catch (e) {
      console.error('Failed to load saved states:', e)
    }
  }, [])

  // Initialize preview simulations
  useEffect(() => {
    previewRefs.current = []
    simulationRefs.current = []
    animationFrameRefs.current = []
    
    const getCanvasSize = () => {
      const isMobile = window.innerWidth <= 768
      return { width: isMobile ? 80 : 160, height: isMobile ? 60 : 120 }
    }
    
    const { width: canvasWidth, height: canvasHeight } = getCanvasSize()
    
    UNIVERSE_PRESETS.forEach((preset, index) => {
      const config: GravityConfig = {
        ...currentConfig,
        ...preset.config
      }
      
      const sim = new GravitySimulation(canvasWidth, canvasHeight, config)
      simulationRefs.current[index] = sim
      
      sim.loadUniverse({
        width: canvasWidth,
        height: canvasHeight,
        stars: initialUniverse.stars.map(s => ({
          x: s.x * (canvasWidth / initialUniverse.width),
          y: s.y * (canvasHeight / initialUniverse.height),
          mass: s.mass
        }))
      })
    })
    
    // Animation loop
    const animate = () => {
      UNIVERSE_PRESETS.forEach((preset, index) => {
        const sim = simulationRefs.current[index]
        const canvas = previewRefs.current[index]
        if (sim && canvas) {
          const { width, height } = getCanvasSize()
          if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width
            canvas.height = height
            sim.resize(width, height)
          }
          
          sim.update(0.016) // ~60fps
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = '#0a0a0a'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            // Scale factor based on canvas height vs original universe height
            const scaleFactor = height / initialUniverse.height
            
            // Render stars - ensure they're visible
            if (sim.stars.length > 0) {
              ctx.fillStyle = '#ffffff'
              for (const star of sim.stars) {
                // Ensure star is within canvas bounds (with some margin for glow)
                if (star.x < -50 || star.x > width + 50 || star.y < -50 || star.y > height + 50) {
                  continue // Skip stars way outside bounds
                }
                
                // For preview, use a more visible radius calculation
                // Don't scale down too much - ensure stars are always visible
                const baseRadius = star.radius
                // Use a minimum radius that's visible on small canvas (3px minimum)
                // Scale up smaller stars more aggressively for visibility
                const minVisibleRadius = 3
                const scaledRadius = baseRadius * scaleFactor
                // Boost radius significantly for visibility, ensure at least 3px
                const displayRadius = Math.max(minVisibleRadius, scaledRadius * 2.5)
                
                // Add glow effect for better visibility (larger glow)
                const glowRadius = Math.max(6, displayRadius * 2.5)
                const glowGradient = ctx.createRadialGradient(
                  star.x, star.y, 0,
                  star.x, star.y, glowRadius
                )
                glowGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
                glowGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)')
                glowGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
                
                ctx.fillStyle = glowGradient
                ctx.beginPath()
                ctx.arc(star.x, star.y, glowRadius, 0, Math.PI * 2)
                ctx.fill()
                
                // Draw bright star core
                ctx.fillStyle = '#ffffff'
                ctx.beginPath()
                ctx.arc(star.x, star.y, displayRadius, 0, Math.PI * 2)
                ctx.fill()
              }
            }
            
            // Render central sun if it exists
            if (sim.centralSun) {
              const sunRadius = Math.max(3, sim.centralSun.radius * scaleFactor)
              ctx.fillStyle = '#ffff00'
              ctx.beginPath()
              ctx.arc(sim.centralSun.x, sim.centralSun.y, sunRadius, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
      })
      animationFrameRefs.current[0] = requestAnimationFrame(animate)
    }
    animate()
    
    return () => {
      animationFrameRefs.current.forEach((frameId) => {
        if (frameId !== null) {
          cancelAnimationFrame(frameId)
        }
      })
    }
  }, [currentConfig])

  const handleSelectPreset = (index: number) => {
    const preset = UNIVERSE_PRESETS[index]
    const config: GravityConfig = {
      ...currentConfig,
      ...preset.config
    }
    onSelectUniverse(config, `preset-${index}`)
  }

  const handleLoadSaved = (savedState: SavedState) => {
    onSelectUniverse(savedState.config, `saved-${savedState.timestamp}`)
  }

  const handleDeleteSaved = (timestamp: number, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = savedStates.filter(s => s.timestamp !== timestamp)
    setSavedStates(updated)
    localStorage.setItem('gravitySavedStates', JSON.stringify(updated))
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.menu}>
        <h2 className={styles.title}>Select Universe</h2>
        <p className={styles.subtitle}>Choose a universe to start. You cannot change it once selected.</p>
        
        <div className={styles.section}>
          <h3>Preset Universes</h3>
          <div className={styles.grid}>
            {UNIVERSE_PRESETS.map((preset, index) => (
              <div
                key={index}
                className={styles.card}
                onClick={() => handleSelectPreset(index)}
              >
                <div className={styles.preview}>
                  <canvas
                    ref={(el) => {
                      if (el) {
                        previewRefs.current[index] = el
                        const isMobile = window.innerWidth <= 768
                        el.width = isMobile ? 80 : 160
                        el.height = isMobile ? 60 : 120
                      }
                    }}
                  />
                </div>
                <div className={styles.cardInfo}>
                  <h4>{preset.name}</h4>
                  <p>{preset.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {savedStates.length > 0 && (
          <div className={styles.section}>
            <h3>Saved States</h3>
            <div className={styles.savedList}>
              {savedStates.map((saved) => (
                <div
                  key={saved.timestamp}
                  className={styles.savedCard}
                  onClick={() => handleLoadSaved(saved)}
                >
                  <div className={styles.savedInfo}>
                    <h4>{saved.name}</h4>
                    <p>{new Date(saved.timestamp).toLocaleString()}</p>
                    <p className={styles.savedMeta}>
                      {saved.stars.length} stars • {saved.config.physicsMode}
                    </p>
                  </div>
                  <button
                    className={styles.deleteButton}
                    onClick={(e) => handleDeleteSaved(saved.timestamp, e)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

