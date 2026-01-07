'use client'

import { useState, useEffect, useRef } from 'react'
import { GravityConfig } from '@/lib/gravity/config'
import { generateProceduralUniverse, getPresetConfig, UNIVERSE_PRESETS } from '@/lib/gravity/universe-presets'
import { GravitySimulation } from '@/lib/gravity/simulation'
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
  const previewSeedRef = useRef<Array<string>>([])

  const buildPreviewConfig = (presetConfig: Partial<GravityConfig>): GravityConfig => {
    const baseGravityConstant = (presetConfig.gravityConstant ?? currentConfig.gravityConstant)
    const baseMinMass = (presetConfig.minMass ?? currentConfig.minMass)
    const baseMaxMass = (presetConfig.maxMass ?? currentConfig.maxMass)
    // In thumbnails: reduce max mass by 1/3 so huge stars don't dominate the preview
    const previewMinMass = Math.max(0.001, baseMinMass * 0.85)
    const previewMaxMass = Math.max(previewMinMass + 0.001, (baseMaxMass * (2 / 3)) * 0.85)
    const baseRadiusScale = (presetConfig.radiusScale ?? currentConfig.radiusScale)
    // In thumbnails: shrink physical radii so the whole "universe" reads at tiny scale
    const previewRadiusScale = baseRadiusScale * 0.55
    const mergeStopMass = previewMaxMass * 1.4

    return {
      ...currentConfig,
      ...presetConfig,

      // Preview-only stability overrides
      enableMerging: true,
      enableOrbitTrails: false,
      // Keep stars visible in tiny previews
      enableBoundaryWrapping: true,

      gravityConstant: baseGravityConstant * 0.5,
      potentialEnergyDegree: 1.7,
      minMass: previewMinMass,
      maxMass: previewMaxMass,
      radiusScale: previewRadiusScale,
      mergeStopMass,
    }
  }

  const seedPreviewUniverse = (sim: GravitySimulation, seedKey: string, starCount?: number) => {
    const universe = generateProceduralUniverse({
      width: sim.width,
      height: sim.height,
      config: sim.config,
      seed: seedKey,
      // thumbnails look better denser
      starCount: starCount ?? Math.round(60 * 1.3),
    })
    sim.loadUniverse(universe)

    // Thumbnail universe is tiny; scale initial velocities down proportionally to size.
    const minDim = Math.min(sim.width, sim.height)
    const speedScale = Math.max(0.1, Math.min(1.0, minDim / 600))
    if (speedScale !== 1.0) {
      sim.stars.forEach((star) => {
        star.vx *= speedScale
        star.vy *= speedScale
        star.vxHalf *= speedScale
        star.vyHalf *= speedScale
      })
    }
  }

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

    // DON'T wipe previewRefs here — React owns ref timing.
    // Lazily initialize sims when canvases are available + measured.
    simulationRefs.current = new Array(UNIVERSE_PRESETS.length).fill(null)
    previewSeedRef.current = UNIVERSE_PRESETS.map((preset, index) => {
      const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
      return `selection-preview-${index}-${preset.name}-${nonce}`
    })
    
    // Animation loop - safe handling of missing refs
    const animate = () => {
      UNIVERSE_PRESETS.forEach((_, index) => {
        const canvas = previewRefs.current[index]
        
        // Skip this frame if refs not ready (they'll be available next frame)
        if (!canvas) return

        const dpr = window.devicePixelRatio || 1
        const cssW = Math.max(1, Math.floor(canvas.clientWidth || 0))
        const cssH = Math.max(1, Math.floor(canvas.clientHeight || 0))

        // If layout isn't ready yet, skip this frame.
        if (cssW <= 1 || cssH <= 1) return

        // Ensure backing store matches CSS size
        const targetW = Math.floor(cssW * dpr)
        const targetH = Math.floor(cssH * dpr)
        if (canvas.width !== targetW || canvas.height !== targetH) {
          canvas.width = targetW
          canvas.height = targetH
        }

        let sim = simulationRefs.current[index]
        // Recreate sim if missing or size changed (keeps "universe" fitting the box)
        if (!sim || sim.width !== cssW || sim.height !== cssH) {
          const preset = UNIVERSE_PRESETS[index]
          const config = buildPreviewConfig(getPresetConfig(preset))
          sim = new GravitySimulation(cssW, cssH, config)
          simulationRefs.current[index] = sim
          const seedKey = previewSeedRef.current[index] ?? `selection-preview-${index}-${preset.name}`
          seedPreviewUniverse(sim, seedKey)
        }
        
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        
        // Normal speed for thumbnails
        sim.update(0.008) // Normal preview speed

        // If everything merged down to ~nothing, reset with a fresh mini-universe
        if (sim.stars.length <= 1) {
          const nonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
          const seedKey = `selection-preview-${index}-respawn-${nonce}`
          previewSeedRef.current[index] = seedKey
          seedPreviewUniverse(sim, seedKey, 30)
        }
        
        // Clear and draw background
        ctx.fillStyle = '#000'
        ctx.fillRect(0, 0, cssW, cssH)
        
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
          // Thumbnail tuning: keep stars small but still readable
          const r = Math.max(1.2, Math.min(6, 0.8 + Math.pow(baseRadius, 0.75) * 0.9))
          
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

