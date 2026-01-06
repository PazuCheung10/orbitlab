'use client'

import { useState, useEffect, useRef } from 'react'
import { GravityConfig, PhysicsMode } from '@/lib/gravity/config'
import { UNIVERSE_PRESETS, randomizeUniverse } from '@/lib/gravity/universe-presets'
import { GravitySimulation } from '@/lib/gravity/simulation'
// @ts-ignore - JSON import
import initialUniverseData from '@/initial-universe.json'
const initialUniverse = initialUniverseData as { width: number; height: number; stars: Array<{ x: number; y: number; mass: number }> }
import styles from './UniverseBrowser.module.css'

interface UniverseBrowserProps {
  onLoadUniverse: (config: GravityConfig) => void
  currentConfig: GravityConfig
}

export default function UniverseBrowser({ onLoadUniverse, currentConfig }: UniverseBrowserProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const previewRefs = useRef<Array<HTMLCanvasElement | null>>([])

  useEffect(() => {
    // Create preview simulations for each preset
    if (isOpen) {
      previewRefs.current = []
      UNIVERSE_PRESETS.forEach((preset, index) => {
        const canvas = document.createElement('canvas')
        canvas.width = 160
        canvas.height = 120
        previewRefs.current[index] = canvas
        
        // Create config
        const config: GravityConfig = {
          ...currentConfig,
          ...preset.config
        }
        
        // Create simulation
        const sim = new GravitySimulation(160, 120, config)
        sim.loadUniverse({
          width: 160,
          height: 120,
          stars: initialUniverse.stars.map(s => ({
            x: s.x * (160 / initialUniverse.width),
            y: s.y * (120 / initialUniverse.height),
            mass: s.mass
          }))
        })
        
        // Run preview for 3 seconds
        const ctx = canvas.getContext('2d')!
        let startTime = performance.now()
        const animate = () => {
          const now = performance.now()
          const elapsed = (now - startTime) / 1000
          
          if (elapsed < 3) {
            sim.update(1/60)
            
            // Draw
            ctx.fillStyle = '#0a0a0a'
            ctx.fillRect(0, 0, 160, 120)
            
            ctx.fillStyle = '#ffffff'
            for (const star of sim.stars) {
              ctx.beginPath()
              ctx.arc(star.x, star.y, Math.max(1, star.radius * (120 / initialUniverse.height)), 0, Math.PI * 2)
              ctx.fill()
            }
            
            if (sim.centralSun) {
              ctx.fillStyle = '#ffff00'
              ctx.beginPath()
              ctx.arc(sim.centralSun.x, sim.centralSun.y, Math.max(2, sim.centralSun.radius * (120 / initialUniverse.height)), 0, Math.PI * 2)
              ctx.fill()
            }
            
            requestAnimationFrame(animate)
          }
        }
        animate()
      })
    }
  }, [isOpen, currentConfig])

  const handleLoadPreset = (presetIndex: number) => {
    const preset = UNIVERSE_PRESETS[presetIndex]
    const config: GravityConfig = {
      ...currentConfig,
      ...preset.config
    }
    onLoadUniverse(config)
    setSelectedPreset(presetIndex)
  }

  const handleRandomize = () => {
    const randomConfig = randomizeUniverse()
    const config: GravityConfig = {
      ...currentConfig,
      ...randomConfig
    }
    onLoadUniverse(config)
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
                  {previewRefs.current[index] && (
                    <img 
                      src={previewRefs.current[index]!.toDataURL()} 
                      alt={preset.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  )}
                </div>
                <div className={styles.cardInfo}>
                  <h4>{preset.name}</h4>
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

