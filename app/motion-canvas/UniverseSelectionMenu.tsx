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
      
      // Generate random stars with random positions and masses
      const numStars = 40 + Math.floor(Math.random() * 30) // 40-70 stars - way more random stars
      const stars: Array<{ x: number; y: number; mass: number }> = []
      const margin = 10 // Smaller margin to allow more stars
      
      for (let i = 0; i < numStars; i++) {
        // Random position with margin
        const x = margin + Math.random() * (canvasWidth - 2 * margin)
        const y = margin + Math.random() * (canvasHeight - 2 * margin)
        
        // Random mass between 5 and 50
        const mass = 5 + Math.random() * 45
        
        stars.push({ x, y, mass })
      }
      
      sim.loadUniverse({
        width: canvasWidth,
        height: canvasHeight,
        stars: stars
      })
      
      // Give stars random initial velocities for interesting motion
      sim.stars.forEach((star) => {
        // Random velocity direction and magnitude
        const angle = Math.random() * Math.PI * 2
        const speed = 10 + Math.random() * 30 // Random speed between 10-40
        star.vx = Math.cos(angle) * speed
        star.vy = Math.sin(angle) * speed
        star.vxHalf = star.vx
        star.vyHalf = star.vy
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
        
        // Normal speed for thumbnails
        sim.update(0.008) // Normal preview speed
        
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

