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
          const dpr = window.devicePixelRatio || 1
          
          // Handle devicePixelRatio for Retina/mobile screens
          if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr
            canvas.height = height * dpr
            canvas.style.width = `${width}px`
            canvas.style.height = `${height}px`
            sim.resize(width, height) // Simulation uses logical size
          }
          
          sim.update(0.016) // ~60fps - physics update (DO NOT MODIFY)
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // Scale context for devicePixelRatio
            ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform
            ctx.scale(dpr, dpr)
            
            // Darker background for better contrast
            ctx.fillStyle = '#000000'
            ctx.fillRect(0, 0, width, height)
            
            // Preview-only rendering with exaggerated visibility
            sim.stars.forEach(star => {
              // Force minimum visible radius for thumbnails (preview-only, doesn't affect physics)
              const displayRadius = Math.max(2, star.radius * 1.5)
              
              // Fixed high alpha for visibility (not based on mass)
              ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
              
              // Optional: subtle glow for better visibility
              ctx.shadowBlur = 2
              ctx.shadowColor = 'rgba(255, 255, 255, 0.5)'
              
              ctx.beginPath()
              ctx.arc(star.x, star.y, displayRadius, 0, Math.PI * 2)
              ctx.fill()
              
              // Reset shadow
              ctx.shadowBlur = 0
            })
            
            // Render central sun if it exists (with exaggerated size for preview)
            if (sim.centralSun) {
              const sunRadius = Math.max(3, sim.centralSun.radius * 1.5)
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
                        const width = isMobile ? 80 : 160
                        const height = isMobile ? 60 : 120
                        const dpr = window.devicePixelRatio || 1
                        el.width = width * dpr
                        el.height = height * dpr
                        el.style.width = `${width}px`
                        el.style.height = `${height}px`
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

