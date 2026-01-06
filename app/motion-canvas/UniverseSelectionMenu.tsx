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
  const animationFrameRef = useRef<number | null>(null)

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
    // React StrictMode runs effects twice in dev — guard so you don't start 2 RAF loops
    if (animationFrameRef.current !== null) return
    
    const canvasWidth = 160
    const canvasHeight = 120
    
    // DON'T wipe previewRefs here — React owns ref timing.
    // Just rebuild sims.
    simulationRefs.current = new Array(UNIVERSE_PRESETS.length).fill(null)
    
    UNIVERSE_PRESETS.forEach((preset, index) => {
      const config: GravityConfig = {
        ...currentConfig,
        ...preset.config,
        
        // Preview-only stability overrides (keep these to prevent collapse)
        enableMerging: false,
        enableBoundaryWrapping: false,
        // Don't override gravityConstant or softeningEpsPx - let presets show their differences
      }
      
      const sim = new GravitySimulation(canvasWidth, canvasHeight, config)
      simulationRefs.current[index] = sim
      
      // Dedicated preview universe - vary based on preset to show differences
      const centerX = canvasWidth / 2
      const centerY = canvasHeight / 2
      
      // Adjust preview universe based on preset type to show visual differences
      let centralMass = 200
      let starDistances = [30, 45, 35, 40]
      
      if (preset.name === 'Tight Orbits') {
        centralMass = 300
        starDistances = [20, 30, 25, 28] // Closer orbits
      } else if (preset.name === 'Wide Orbits') {
        centralMass = 150
        starDistances = [40, 55, 45, 50] // Farther orbits
      } else if (preset.name === 'N-Body Chaos') {
        centralMass = 200
        starDistances = [25, 35, 30, 32] // Different arrangement for chaos
      }
      
      sim.loadUniverse({
        width: canvasWidth,
        height: canvasHeight,
        stars: [
          {
            // Central mass - offset slightly so it's not skipped by loadUniverse
            x: centerX + 0.1,
            y: centerY + 0.1,
            mass: centralMass
          },
          {
            x: centerX + starDistances[0],
            y: centerY,
            mass: 5
          },
          {
            x: centerX,
            y: centerY + starDistances[1],
            mass: 8
          },
          {
            x: centerX - starDistances[2],
            y: centerY,
            mass: 6
          },
          {
            x: centerX,
            y: centerY - starDistances[3],
            mass: 7
          }
        ]
      })
      
      // After loadUniverse, manually adjust velocities for visible orbits (preview-only)
      // loadUniverse calculates velocities, but we override for better visibility
      sim.stars.forEach((star, i) => {
        // Find the central mass (largest mass, closest to center)
        const isCentral = star.mass > 100
        if (isCentral) {
          // Keep central mass at center with no velocity
          star.x = centerX
          star.y = centerY
          star.vx = 0
          star.vy = 0
          star.vxHalf = 0
          star.vyHalf = 0
        } else {
        // Give orbiting stars visible orbital velocities
        const dx = star.x - centerX
        const dy = star.y - centerY
        const angle = Math.atan2(dy, dx)
        const speed = 25 + i * 2 // Vary speeds for visual interest
        // Perpendicular velocity for circular orbit
        star.vx = -Math.sin(angle) * speed
        star.vy = Math.cos(angle) * speed
        star.vxHalf = star.vx
        star.vyHalf = star.vy
        }
      })
    })
    
    // Animation loop - safe handling of missing refs
    const animate = () => {
      UNIVERSE_PRESETS.forEach((_, index) => {
        const sim = simulationRefs.current[index]
        const canvas = previewRefs.current[index]
        
        // Skip this frame if refs not ready (they'll be available next frame)
        if (!sim || !canvas) return
        
        // Match DPR so it's visible/crisp
        const dpr = window.devicePixelRatio || 1
        const w = canvasWidth
        const h = canvasHeight
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr
          canvas.height = h * dpr
          canvas.style.width = `${w}px`
          canvas.style.height = `${h}px`
        }
        
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        
        sim.update(0.016) // ~60fps - physics update (DO NOT MODIFY)
        
        // Clear and draw background
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, w, h)
        
        // Render stars
        ctx.fillStyle = '#fff'
        ctx.shadowBlur = 6
        ctx.shadowColor = 'rgba(255,255,255,0.9)'
        
        sim.stars.forEach((star) => {
          // Guard positions against NaN/undefined
          const x = Number.isFinite(star.x) ? star.x : 0
          const y = Number.isFinite(star.y) ? star.y : 0
          
          // Guard radius against NaN/undefined
          const baseRadius = Number.isFinite(star.radius) ? star.radius : 1
          const r = Math.max(2, baseRadius * 1.5)
          
          ctx.beginPath()
          ctx.arc(x, y, r, 0, Math.PI * 2)
          ctx.fill()
        })
        
        // Reset shadow after stars
        ctx.shadowBlur = 0
      })
      
      animationFrameRef.current = requestAnimationFrame(animate)
    }
    
    animationFrameRef.current = requestAnimationFrame(animate)
    
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
    // Do NOT depend on currentConfig - previews should be independent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
                      previewRefs.current[index] = el
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

