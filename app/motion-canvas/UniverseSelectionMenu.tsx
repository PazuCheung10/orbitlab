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
    
    // Use fixed canvas size like the original working version
    const canvasWidth = 160
    const canvasHeight = 120
    
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
    
    // Animation loop - simplified like original, but with visibility improvements
    const animate = () => {
      UNIVERSE_PRESETS.forEach((preset, index) => {
        const sim = simulationRefs.current[index]
        const canvas = previewRefs.current[index]
        if (sim && canvas) {
          // Ensure canvas has correct size (should be set by JSX, but double-check)
          if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
            canvas.width = canvasWidth
            canvas.height = canvasHeight
          }
          
          sim.update(0.016) // ~60fps - physics update (DO NOT MODIFY)
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.fillStyle = '#000000' // Darker background for better contrast
            ctx.fillRect(0, 0, canvasWidth, canvasHeight)
            
            // Debug: Force a red pixel to verify canvas is drawing
            ctx.fillStyle = '#ff0000'
            ctx.fillRect(0, 0, 4, 4)
            
            // Bulletproof preview star rendering - guard against NaN/undefined
            sim.stars.forEach((star) => {
              // Guard positions against NaN/undefined
              const x = Number.isFinite(star.x) ? star.x : 0
              const y = Number.isFinite(star.y) ? star.y : 0
              
              // Guard radius against NaN/undefined
              const baseRadius = Number.isFinite(star.radius) ? star.radius : 1
              const r = Math.max(2, baseRadius * 1.5)
              
              // Boost star brightness with stronger glow for contrast
              ctx.fillStyle = '#ffffff'
              ctx.shadowBlur = 6
              ctx.shadowColor = 'rgba(255, 255, 255, 0.9)'
              
              ctx.beginPath()
              ctx.arc(x, y, r, 0, Math.PI * 2)
              ctx.fill()
            })
            
            // Reset shadow after stars
            ctx.shadowBlur = 0
            
            // Render central sun if it exists (with guards)
            if (sim.centralSun) {
              const sunX = Number.isFinite(sim.centralSun.x) ? sim.centralSun.x : canvasWidth / 2
              const sunY = Number.isFinite(sim.centralSun.y) ? sim.centralSun.y : canvasHeight / 2
              const baseSunRadius = Number.isFinite(sim.centralSun.radius) ? sim.centralSun.radius : 2
              const sunRadius = Math.max(3, baseSunRadius * 1.5)
              
              ctx.fillStyle = '#ffff00'
              ctx.beginPath()
              ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2)
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
                      }
                    }}
                    width={160}
                    height={120}
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

