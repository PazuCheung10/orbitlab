'use client'

import { useState, useEffect, useRef } from 'react'
import { GravityConfig, PhysicsMode } from '@/lib/gravity/config'
import { generateProceduralUniverse, getPresetConfig, UNIVERSE_PRESETS, randomizeUniverse } from '@/lib/gravity/universe-presets'
import { GravitySimulation } from '@/lib/gravity/simulation'
import styles from './UniverseBrowser.module.css'

interface UniverseBrowserProps {
  onLoadUniverse: (config: GravityConfig, universeKey?: string) => void
  onResetUniverse?: () => void
  currentConfig: GravityConfig
}

export default function UniverseBrowser({ onLoadUniverse, onResetUniverse, currentConfig }: UniverseBrowserProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const previewRefs = useRef<Array<HTMLCanvasElement | null>>([])
  const simulationRefs = useRef<Array<GravitySimulation | null>>([])
  const animationFrameRefs = useRef<Array<number | null>>([])
  const previewSeedRef = useRef<Array<string>>([])

  // Initialize independent simulations for each universe
  useEffect(() => {
    if (isOpen) {
      previewRefs.current = []
      simulationRefs.current = []
      animationFrameRefs.current = []
      previewSeedRef.current = UNIVERSE_PRESETS.map((p, i) => `browser-preview-${i}-${p.name}-${Date.now()}`)
      
      // Sims are created lazily when canvases are laid out (so sizing matches the card)
    }
    
    // Cleanup on unmount or close
    return () => {
      animationFrameRefs.current.forEach((frameId) => {
        if (frameId !== null) {
          cancelAnimationFrame(frameId)
        }
      })
    }
  }, [isOpen, currentConfig])
  
  // Animation loop for each universe
  useEffect(() => {
    if (!isOpen) return
    
    const animate = () => {
      UNIVERSE_PRESETS.forEach((preset, index) => {
        const canvas = previewRefs.current[index]
        let sim = simulationRefs.current[index]
        
        if (canvas) {
          const dpr = window.devicePixelRatio || 1
          const cssW = Math.max(1, Math.floor(canvas.clientWidth || 0))
          const cssH = Math.max(1, Math.floor(canvas.clientHeight || 0))

          if (cssW <= 1 || cssH <= 1) return

          const targetW = Math.floor(cssW * dpr)
          const targetH = Math.floor(cssH * dpr)
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW
            canvas.height = targetH
          }

          if (!sim || sim.width !== cssW || sim.height !== cssH) {
            const config: GravityConfig = {
              ...currentConfig,
              ...getPresetConfig(preset),
              // keep previews lively + visible
              enableMerging: false,
              enableBoundaryWrapping: true,
              enableOrbitTrails: false,
            }

            sim = new GravitySimulation(cssW, cssH, config)
            simulationRefs.current[index] = sim

            const seedKey = previewSeedRef.current[index] ?? `browser-preview-${index}-${preset.name}`
            sim.loadUniverse(
              generateProceduralUniverse({
                width: cssW,
                height: cssH,
                config,
                seed: seedKey,
                starCount: 55,
              })
            )
          }

          sim.update(1 / 60)
          
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            // Draw
            ctx.fillStyle = '#0a0a0a'
            ctx.fillRect(0, 0, cssW, cssH)
            
            ctx.fillStyle = '#ffffff'
            for (const star of sim.stars) {
              ctx.beginPath()
              ctx.arc(star.x, star.y, Math.max(1, star.radius), 0, Math.PI * 2)
              ctx.fill()
            }
            
            if (sim.centralSun) {
              ctx.fillStyle = '#ffff00'
              ctx.beginPath()
              ctx.arc(sim.centralSun.x, sim.centralSun.y, Math.max(2, sim.centralSun.radius), 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
      })
      
      requestAnimationFrame(animate)
    }
    
    const frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [isOpen])
  
  // Reset a specific universe preview (in the browser panel)
  const handleResetPreview = (index: number, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    const sim = simulationRefs.current[index]
    if (sim) {
      // Reseed procedural preview
      const preset = UNIVERSE_PRESETS[index]
      const config: GravityConfig = {
        ...currentConfig,
        ...getPresetConfig(preset),
        enableMerging: false,
        enableBoundaryWrapping: true,
        enableOrbitTrails: false,
      }
      sim.updateConfig(config)
      previewSeedRef.current[index] = `browser-preview-${index}-${preset.name}-${Date.now()}`
      sim.loadUniverse(
        generateProceduralUniverse({
          width: sim.width,
          height: sim.height,
          config,
          seed: previewSeedRef.current[index],
          starCount: 55,
        })
      )
    }
  }
  
  // Reset the main simulation (when reset button is clicked on the currently active universe)
  const handleResetMain = (presetIndex: number, e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    // Only reset main simulation if this is the currently selected universe
    if (selectedPreset === presetIndex && onResetUniverse) {
      onResetUniverse()
    }
    // Always reset the preview
    handleResetPreview(presetIndex, e)
  }

  const handleLoadPreset = (presetIndex: number) => {
    const preset = UNIVERSE_PRESETS[presetIndex]
    const config: GravityConfig = {
      ...currentConfig,
      ...preset.config
    }
    // Pass preset index as universe key to identify which universe this is
    onLoadUniverse(config, `preset-${presetIndex}`)
    setSelectedPreset(presetIndex)
  }

  const handleRandomize = () => {
    const randomConfig = randomizeUniverse()
    const config: GravityConfig = {
      ...currentConfig,
      ...randomConfig
    }
    // Use timestamp as key for random universes (each random is unique)
    onLoadUniverse(config, `random-${Date.now()}`)
    setSelectedPreset(null)
  }

  return (
    <>
      <button 
        className={styles.toggleButton}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '▼' : '▶'} Universe Browser
      </button>
      
      {isOpen && (
        <div className={styles.browser}>
          <div className={styles.header}>
            <h3>Universe Gallery</h3>
            <button onClick={handleRandomize} className={styles.randomButton}>
              Randomize
            </button>
          </div>
          
          <div className={styles.grid}>
            {UNIVERSE_PRESETS.map((preset, index) => (
              <div
                key={index}
                className={`${styles.card} ${selectedPreset === index ? styles.selected : ''}`}
                onClick={() => handleLoadPreset(index)}
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
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
                <div className={styles.cardInfo}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4>{preset.name}</h4>
                    <button
                      onClick={(e) => handleResetMain(index, e)}
                      className={styles.resetButton}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: '#333',
                        color: '#fff',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      Reset
                    </button>
                  </div>
                  <p>{preset.description}</p>
                  <div className={styles.badges}>
                    <span className={styles.badge}>
                      {preset.config.physicsMode === PhysicsMode.ORBIT_PLAYGROUND ? 'Orbit' : 'N-Body'}
                    </span>
                    {preset.config.satellitesAttractEachOther && (
                      <span className={styles.badge}>Sat-Sat</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

