'use client'

import { useEffect, useRef, useState } from 'react'
import { GravitySystem } from '@/lib/gravity/gravity'
import { GRAVITY_CONFIG, GravityConfig } from '@/lib/gravity/config'
import { Star } from '@/lib/gravity/star'
import GravityDebugPanel from './GravityDebugPanel'
import UniverseBrowser from './UniverseBrowser'
import UniverseSelectionMenu from './UniverseSelectionMenu'
import { generateProceduralUniverse } from '@/lib/gravity/universe-presets'
import { generateGaussianStars } from '@/lib/gravity/starfield'
import styles from './page.module.css'

export default function MotionCanvasPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const systemRef = useRef<GravitySystem | null>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  // Check for loaded genome from Evolution Lab
  const loadConfigFromStorage = (): GravityConfig => {
    try {
      // Check URL params first (for new window)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        const configKey = params.get('config')
        if (configKey) {
          const stored = localStorage.getItem(configKey)
          if (stored) {
            const parsed = JSON.parse(stored)
            localStorage.removeItem(configKey) // Clear after loading
            return { ...GRAVITY_CONFIG, ...parsed }
          }
        }
        // Fallback to old method
        const stored = localStorage.getItem('gravityConfig')
        if (stored) {
          const parsed = JSON.parse(stored)
          localStorage.removeItem('gravityConfig') // Clear after loading
          return { ...GRAVITY_CONFIG, ...parsed }
        }
      }
    } catch (e) {
      console.error('Failed to load config from storage:', e)
    }
    return GRAVITY_CONFIG
  }
  
  const [config, setConfig] = useState<GravityConfig>(loadConfigFromStorage())
  const [currentUniverseKey, setCurrentUniverseKey] = useState<string | null>(null)
  const currentUniverseKeyRef = useRef<string | null>(null) // Ref for accessing in intervals
  const [starCount, setStarCount] = useState(0)
  const [showSelectionMenu, setShowSelectionMenu] = useState(true) // Show menu on first load
  
  // Store universe states (like TV channels - each maintains its own independent state)
  // Key: universe identifier (e.g., "preset-0", "preset-1")
  // Value: array of star states (positions, velocities, etc.)
  const universeStatesRef = useRef<Map<string, Array<{ x: number; y: number; vx: number; vy: number; mass: number; vxHalf: number; vyHalf: number; age: number }>>>(new Map())

  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize gravity system
    systemRef.current = new GravitySystem(canvasRef.current, config)

    // Update star count periodically
    // Also save current universe state periodically (like auto-saving TV channel state)
    const countInterval = setInterval(() => {
      if (systemRef.current && currentUniverseKeyRef.current !== null) {
        setStarCount(systemRef.current.simulation.stars.length)
        
        // Auto-save current universe state (like pausing a TV channel)
        const currentStars = systemRef.current.simulation.stars.map(star => ({
          x: star.x,
          y: star.y,
          vx: star.vx,
          vy: star.vy,
          mass: star.mass,
          vxHalf: star.vxHalf,
          vyHalf: star.vyHalf,
          age: star.age
        }))
        universeStatesRef.current.set(currentUniverseKeyRef.current, currentStars)
      }
    }, 100)

    // Fade title after delay
    const timer = setTimeout(() => {
      if (titleRef.current) {
        titleRef.current.classList.add(styles.fadeOut)
      }
    }, 3000)

    return () => {
      clearTimeout(timer)
      clearInterval(countInterval)
      if (systemRef.current) {
        systemRef.current.destroy()
      }
    }
  }, []) // Only initialize once

  // Update config when it changes (but don't reload universe automatically)
  // Universe reloading is handled explicitly by handleLoadUniverse
  useEffect(() => {
    if (systemRef.current) {
      systemRef.current.updateConfig(config)
    }
  }, [config])
  
  // Don't load initial universe automatically - wait for user selection

  const handleConfigChange = (newConfig: GravityConfig) => {
    setConfig(newConfig)
  }

  const handleLoadUniverse = (newConfig: GravityConfig, universeKey?: string) => {
    // Generate a unique key for this universe config
    const key = universeKey || JSON.stringify(newConfig)
    
    if (systemRef.current) {
      // Check if this is a saved state (starts with "saved-")
      if (key.startsWith('saved-')) {
        // Load from localStorage
        try {
          const saved = localStorage.getItem('gravitySavedStates')
          if (saved) {
            const savedStates = JSON.parse(saved) as Array<{
              stars: Array<{ x: number; y: number; vx: number; vy: number; mass: number; vxHalf: number; vyHalf: number; age: number }>
              config: GravityConfig
              timestamp: number
              name: string
            }>
            const timestamp = parseInt(key.replace('saved-', ''))
            const savedState = savedStates.find(s => s.timestamp === timestamp)
            if (savedState) {
              // Restore stars
              systemRef.current.simulation.stars = savedState.stars.map(starData => {
                const star = new Star(
                  starData.x,
                  starData.y,
                  starData.mass,
                  starData.vx,
                  starData.vy,
                  savedState.config.radiusScale,
                  savedState.config.radiusPower
                )
                star.vxHalf = starData.vxHalf
                star.vyHalf = starData.vyHalf
                star.age = starData.age
                return star
              })
              // Use saved config
              setConfig(savedState.config)
              setCurrentUniverseKey(key)
              currentUniverseKeyRef.current = key
              setShowSelectionMenu(false) // Hide menu after selection
              return
            }
          }
        } catch (e) {
          console.error('Failed to load saved state:', e)
        }
      }
      
      // For non-saved universes, procedurally generate stars (no JSON baseline)
      const w = systemRef.current.simulation.width
      const h = systemRef.current.simulation.height
      systemRef.current.loadUniverse(
        generateProceduralUniverse({
          width: w,
          height: h,
          config: newConfig,
          seed: key,
        })
      )
    }
    
    setCurrentUniverseKey(key)
    currentUniverseKeyRef.current = key // Keep ref in sync
    setConfig(newConfig)
    setShowSelectionMenu(false) // Hide menu after selection
  }
  
  // Handler for reset button - explicitly restarts the current universe
  const handleResetUniverse = () => {
    if (systemRef.current && currentUniverseKey !== null) {
      // Clear saved state for this universe
      universeStatesRef.current.delete(currentUniverseKey)
      // Reload procedural stars deterministically for this universe key
      const w = systemRef.current.simulation.width
      const h = systemRef.current.simulation.height
      systemRef.current.loadUniverse(
        generateProceduralUniverse({
          width: w,
          height: h,
          config,
          seed: currentUniverseKey,
        })
      )
    }
  }

  // Handler for saving current state
  const handleSaveState = () => {
    if (!systemRef.current) return
    
    const stars = systemRef.current.simulation.stars.map(star => ({
      x: star.x,
      y: star.y,
      vx: star.vx,
      vy: star.vy,
      mass: star.mass,
      vxHalf: star.vxHalf,
      vyHalf: star.vyHalf,
      age: star.age
    }))
    
    const savedState = {
      stars,
      config: { ...config },
      timestamp: Date.now(),
      name: `Saved ${new Date().toLocaleString()}`
    }
    
    try {
      const existing = localStorage.getItem('gravitySavedStates')
      const savedStates = existing ? JSON.parse(existing) : []
      savedStates.push(savedState)
      localStorage.setItem('gravitySavedStates', JSON.stringify(savedStates))
      alert(`State saved! (${stars.length} stars)`)
    } catch (e) {
      console.error('Failed to save state:', e)
      alert('Failed to save state')
    }
  }

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div ref={titleRef} className={styles.title}>
        Orbit Lab
      </div>
      
      {showSelectionMenu && (
        <UniverseSelectionMenu
          onSelectUniverse={handleLoadUniverse}
          currentConfig={config}
        />
      )}
      
      {!showSelectionMenu && (
        <>
          <GravityDebugPanel
            config={config}
            onConfigChange={handleConfigChange}
            starCount={starCount}
            onSaveState={handleSaveState}
            onRandomizeStars={() => {
              if (!systemRef.current) return
              const sim = systemRef.current.simulation
              const w = sim.width
              const h = sim.height

              const remaining = Math.max(0, config.maxStars - sim.stars.length)
              if (remaining <= 0) return

              // Request 10-30, but never exceed remaining capacity
              const requested = 10 + Math.floor(Math.random() * 21) // 10..30
              const count = Math.min(requested, remaining)

              const newStars = generateGaussianStars({
                width: w,
                height: h,
                config,
                count,
              })

              // Estimate "central mass" like simulation does, but based on current state
              const existingCount = sim.stars.length
              const existingTotalMass = existingCount > 0 ? sim.stars.reduce((sum, s) => sum + s.mass, 0) : 0
              const meanMass = existingCount > 0 ? existingTotalMass / existingCount : 100
              const centerMassEstimate = meanMass * 10

              for (const s of newStars) {
                // Tangential-ish velocity for immediate interesting motion (like loadUniverse)
                const dx = s.x - w / 2
                const dy = s.y - h / 2
                const r = Math.sqrt(dx * dx + dy * dy)

                let vx = 0
                let vy = 0
                if (r > 1e-6) {
                  const vCirc = Math.sqrt((config.gravityConstant * centerMassEstimate) / r)
                  const v = vCirc * config.orbitFactor
                  const angle = Math.atan2(dy, dx)
                  const tangentialAngle = angle + Math.PI / 2
                  vx = Math.cos(tangentialAngle) * v
                  vy = Math.sin(tangentialAngle) * v
                }

                const star = new Star(s.x, s.y, s.mass, vx, vy, config.radiusScale, config.radiusPower)
                star.vxHalf = vx
                star.vyHalf = vy
                sim.stars.push(star)
              }
            }}
            onClearStars={() => {
              if (systemRef.current && typeof systemRef.current.clearAllStars === 'function') {
                systemRef.current.clearAllStars()
                setStarCount(0)
              } else if (systemRef.current?.simulation) {
                // Fallback: call directly on simulation if method doesn't exist yet
                systemRef.current.simulation.clearAllStars()
                setStarCount(0)
              }
            }}
          />
        </>
      )}
    </div>
  )
}

