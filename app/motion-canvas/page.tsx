'use client'

import { useEffect, useRef, useState } from 'react'
import { GravitySystem } from '@/lib/gravity/gravity'
import { GRAVITY_CONFIG, GravityConfig } from '@/lib/gravity/config'
import GravityDebugPanel from './GravityDebugPanel'
import UniverseBrowser from './UniverseBrowser'
// @ts-ignore - JSON import
import initialUniverseData from '@/initial-universe.json'
const initialUniverse = initialUniverseData as { width: number; height: number; stars: Array<{ x: number; y: number; mass: number }> }
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
  const [starCount, setStarCount] = useState(0)
  const [debugStats, setDebugStats] = useState<{
    holdDragSpeed: number
    releaseFlickSpeed: number
    compressedSpeed: number
    finalLaunchSpeed: number
    estimatedVCirc: number
    estimatedVEsc: number
  } | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Initialize gravity system
    systemRef.current = new GravitySystem(canvasRef.current, config)

    // Update star count and debug stats periodically
    const lastStatsTimeRef = { current: 0 }
    const countInterval = setInterval(() => {
      if (systemRef.current) {
        setStarCount(systemRef.current.simulation.stars.length)
        const stats = systemRef.current.simulation.getDebugStats()
        if (stats) {
          const now = Date.now()
          // Only update stats if they're new (avoid unnecessary re-renders)
          if (now - lastStatsTimeRef.current > 50) { // Throttle to max 20fps for stats
            setDebugStats(stats)
            lastStatsTimeRef.current = now
            // Clear stats after 3 seconds
            setTimeout(() => setDebugStats(null), 3000)
          }
        }
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

  // Track previous physics mode to detect mode changes
  const prevPhysicsModeRef = useRef(config.physicsMode)
  
  // Update config when it changes
  useEffect(() => {
    if (systemRef.current) {
      systemRef.current.updateConfig(config)
      
      // Only reload universe if physics mode changed (not for every config change)
      if (prevPhysicsModeRef.current !== config.physicsMode) {
        systemRef.current.loadUniverse(initialUniverse)
        prevPhysicsModeRef.current = config.physicsMode
      }
    }
  }, [config])
  
  // Load initial universe
  useEffect(() => {
    if (systemRef.current) {
      systemRef.current.loadUniverse(initialUniverse)
    }
  }, [])

  const handleConfigChange = (newConfig: GravityConfig) => {
    setConfig(newConfig)
  }

  const handleLoadUniverse = (newConfig: GravityConfig) => {
    setConfig(newConfig)
  }

  return (
    <div className={styles.container}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div ref={titleRef} className={styles.title}>
        Gravity Stars
      </div>
      <UniverseBrowser
        onLoadUniverse={handleLoadUniverse}
        currentConfig={config}
      />
      <GravityDebugPanel
        config={config}
        onConfigChange={handleConfigChange}
        starCount={starCount}
        onClearStars={() => {
          if (systemRef.current) {
            systemRef.current.clearAllStars()
            setStarCount(0)
            setDebugStats(null)
          }
        }}
        debugStats={debugStats}
      />
    </div>
  )
}

