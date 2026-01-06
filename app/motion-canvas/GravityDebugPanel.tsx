'use client'

import { useState, useEffect } from 'react'
import { GravityConfig, GRAVITY_CONFIG } from '@/lib/gravity/config'
import styles from './GravityDebugPanel.module.css'

interface GravityDebugPanelProps {
  config: GravityConfig
  onConfigChange: (config: GravityConfig) => void
  starCount: number
  onClearStars?: () => void
  debugStats?: {
    holdDragSpeed: number
    releaseFlickSpeed: number
    compressedSpeed: number
    finalLaunchSpeed: number
    estimatedVCirc: number
    estimatedVEsc: number
  } | null
  energyStats?: {
    kinetic: number
    potential: number
    total: number
    history: number[]
    trend: 'stable' | 'decreasing' | 'increasing'
  } | null
}

export default function GravityDebugPanel({ config, onConfigChange, starCount, onClearStars, debugStats, energyStats }: GravityDebugPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [localConfig, setLocalConfig] = useState<GravityConfig>({ ...config })

  useEffect(() => {
    setLocalConfig({ ...config })
  }, [config])

  const updateConfig = (key: keyof GravityConfig, value: number | boolean) => {
    const newConfig = { ...localConfig, [key]: value }
    setLocalConfig(newConfig)
    onConfigChange(newConfig)
  }

  return (
    <div className={styles.panelContainer}>
      <button 
        className={styles.toggleButton}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? '▼' : '▲'} Debug
      </button>
      
      {isOpen && (
        <div className={styles.panel}>
          <div className={styles.info}>
            <strong>Stars:</strong> {starCount} / {config.maxStars}
          </div>

          {/* Energy Debug Overlay */}
          {energyStats && (
            <div className={styles.debugStats} style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: '8px', borderRadius: '4px', marginBottom: '12px' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#ffff00' }}>Energy Debug</div>
              <div className={styles.debugStatsContent}>
                <div className={styles.debugStatRow}>
                  <span className={styles.debugStatLabel}>Kinetic (K):</span>
                  <span className={styles.debugStatValue}>{energyStats.kinetic.toFixed(2)}</span>
                </div>
                <div className={styles.debugStatRow}>
                  <span className={styles.debugStatLabel}>Potential (U):</span>
                  <span className={styles.debugStatValue}>{energyStats.potential.toFixed(2)}</span>
                </div>
                <div className={styles.debugStatRow}>
                  <span className={styles.debugStatLabel}>Total (E=K+U):</span>
                  <span className={styles.debugStatValue} style={{ 
                    color: energyStats.trend === 'decreasing' ? '#ff0000' : 
                           energyStats.trend === 'increasing' ? '#00ff00' : '#ffffff'
                  }}>
                    {energyStats.total.toFixed(2)}
                  </span>
                </div>
                {energyStats.history.length > 10 && (
                  <div className={styles.debugStatRow} style={{ fontSize: '0.85em', marginTop: '4px' }}>
                    <span className={styles.debugStatLabel}>Trend:</span>
                    <span className={styles.debugStatValue} style={{
                      color: energyStats.trend === 'decreasing' ? '#ff0000' : 
                             energyStats.trend === 'increasing' ? '#00ff00' : '#ffff00'
                    }}>
                      {energyStats.trend === 'decreasing' ? '↓ DECREASING' : 
                       energyStats.trend === 'increasing' ? '↑ INCREASING' : '→ STABLE'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Debug Stats Overlay - Always reserve space to prevent layout shift */}
          <div className={styles.debugStatsContainer}>
            {debugStats && (
              <div className={styles.debugStats} style={{ backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '8px', borderRadius: '4px', marginBottom: '12px' }}>
                <h3 style={{ marginTop: 0, fontSize: '12px' }}>Launch Stats</h3>
                <div className={styles.debugStatsContent}>
                  <div className={styles.debugStatRow}>
                    <span>Hold Drag:</span>
                    <span className={styles.debugStatValue}>{debugStats.holdDragSpeed.toFixed(1)} px/s</span>
                  </div>
                  <div className={styles.debugStatRow}>
                    <span>Release Flick:</span>
                    <span className={styles.debugStatValue}>{debugStats.releaseFlickSpeed.toFixed(1)} px/s</span>
                  </div>
                  <div className={styles.debugStatRow}>
                    <span>Compressed:</span>
                    <span className={styles.debugStatValue}>{debugStats.compressedSpeed.toFixed(1)} px/s</span>
                  </div>
                  <div className={styles.debugStatRow}>
                    <span>Final Launch (actual):</span>
                    <span className={styles.debugStatValue}>{debugStats.finalLaunchSpeed.toFixed(1)} px/s</span>
                  </div>
                  {debugStats.estimatedVCirc > 0 && (
                    <>
                      <div className={styles.debugStatRow}>
                        <span>v_circ:</span>
                        <span className={styles.debugStatValue}>{debugStats.estimatedVCirc.toFixed(1)} px/s</span>
                      </div>
                      <div className={styles.debugStatRow}>
                        <span>v_esc:</span>
                        <span className={styles.debugStatValue}>{debugStats.estimatedVEsc.toFixed(1)} px/s</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className={styles.section}>
            <h3>Controls</h3>
            {onClearStars && (
              <button
                onClick={onClearStars}
                style={{
                  width: '100%',
                  padding: '8px',
                  marginBottom: '12px',
                  backgroundColor: '#ff4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ff6666'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ff4444'}
              >
                Clear All Stars ({starCount})
              </button>
            )}
          </div>

          <div className={styles.section}>
            <h3>Physics Mode</h3>
            <label>
              Mode:
              <select
                value={localConfig.physicsMode}
                onChange={(e) => updateConfig('physicsMode', e.target.value as any)}
              >
                <option value="ORBIT_PLAYGROUND">Orbit Playground</option>
                <option value="N_BODY_CHAOS">N-Body Chaos</option>
              </select>
            </label>
            {localConfig.physicsMode === 'ORBIT_PLAYGROUND' && (
              <>
                <label>
                  Sun Mass: {localConfig.sunMass.toFixed(1)}
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="10"
                    value={localConfig.sunMass}
                    onChange={(e) => updateConfig('sunMass', parseFloat(e.target.value))}
                  />
                </label>
                <div className={styles.info} style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '4px' }}>
                  Satellites attract each other: <strong>Disabled</strong> (enforced in ORBIT_PLAYGROUND)
                </div>
                <label>
                  Orbit Factor: {localConfig.orbitFactor.toFixed(2)}
                  <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                    Multiplier for initial orbital velocity (0.7-1.3, 1.0 = circular)
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.3"
                    step="0.05"
                    value={localConfig.orbitFactor}
                    onChange={(e) => updateConfig('orbitFactor', parseFloat(e.target.value))}
                  />
                </label>
              </>
            )}
          </div>

          <div className={styles.section}>
            <h3>Core Physics</h3>
            <label>
              Launch Strength: {localConfig.launchStrength.toFixed(2)}
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                1.0 = compressed speed is final speed (before mass resistance)
              </div>
              <input
                type="range"
                min="0.1"
                max="2.0"
                step="0.1"
                value={localConfig.launchStrength}
                onChange={(e) => updateConfig('launchStrength', parseFloat(e.target.value))}
              />
            </label>
            <label>
              Mass Resistance: {localConfig.massResistanceFactor.toFixed(2)}
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={localConfig.massResistanceFactor}
                onChange={(e) => updateConfig('massResistanceFactor', parseFloat(e.target.value))}
              />
            </label>
            <label>
              Gravity Constant: {localConfig.gravityConstant}
              <input
                type="range"
                min="10000"
                max="40000"
                step="500"
                value={localConfig.gravityConstant}
                onChange={(e) => updateConfig('gravityConstant', parseInt(e.target.value))}
              />
            </label>
            <label>
              Velocity Damping: {localConfig.velocityDamping.toFixed(6)}
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                Set to 0 for energy conservation
              </div>
              <input
                type="range"
                min="0"
                max="0.0001"
                step="0.000001"
                value={localConfig.velocityDamping}
                onChange={(e) => updateConfig('velocityDamping', parseFloat(e.target.value))}
              />
            </label>
          </div>

          <div className={styles.section}>
            <h3>Gravity Softening</h3>
            <label>
              Softening Epsilon: {localConfig.softeningEpsPx.toFixed(1)} px
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                Plummer softening parameter (prevents near-distance explosions)
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={localConfig.softeningEpsPx}
                onChange={(e) => updateConfig('softeningEpsPx', parseFloat(e.target.value))}
              />
            </label>
            <label>
              Max Force: {localConfig.maxForceMagnitude}
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                Clamp force magnitude (0 = disabled)
              </div>
              <input
                type="range"
                min="0"
                max="5000"
                step="100"
                value={localConfig.maxForceMagnitude}
                onChange={(e) => updateConfig('maxForceMagnitude', parseInt(e.target.value))}
              />
            </label>
          </div>

          <div className={styles.section}>
            <h3>Launch Velocity (Flick)</h3>
            <label>
              Flick Window: {localConfig.flickWindowMs} ms
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                Time window to measure flick speed before release
              </div>
              <input
                type="range"
                min="30"
                max="150"
                step="10"
                value={localConfig.flickWindowMs}
                onChange={(e) => updateConfig('flickWindowMs', parseInt(e.target.value))}
              />
            </label>
            <label>
              Flick S0: {localConfig.flickS0}
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                Speed compressor scale parameter (px/s)
              </div>
              <input
                type="range"
                min="100"
                max="1000"
                step="50"
                value={localConfig.flickS0}
                onChange={(e) => updateConfig('flickS0', parseInt(e.target.value))}
              />
            </label>
            <label>
              Flick Vmax: {localConfig.flickVmax}
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                Maximum compressed speed (px/s) - allows natural interaction speeds
              </div>
              <input
                type="range"
                min="200"
                max="1600"
                step="50"
                value={localConfig.flickVmax}
                onChange={(e) => updateConfig('flickVmax', parseInt(e.target.value))}
              />
            </label>
          </div>

          <div className={styles.section}>
            <h3>Mass Growth</h3>
            <label>
              Hold to Max: {localConfig.holdToMaxSeconds.toFixed(1)}s
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={localConfig.holdToMaxSeconds}
                onChange={(e) => updateConfig('holdToMaxSeconds', parseFloat(e.target.value))}
              />
            </label>
            <label>
              Min Mass: {localConfig.minMass.toFixed(1)}
              <input
                type="range"
                min="0.5"
                max="5"
                step="0.5"
                value={localConfig.minMass}
                onChange={(e) => updateConfig('minMass', parseFloat(e.target.value))}
              />
            </label>
            <label>
              Max Mass: {localConfig.maxMass.toFixed(1)}
              <input
                type="range"
                min="5"
                max="20"
                step="1"
                value={localConfig.maxMass}
                onChange={(e) => updateConfig('maxMass', parseFloat(e.target.value))}
              />
            </label>
            <label>
              Radius Scale: {localConfig.radiusScale.toFixed(2)}
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                radius = mass^{localConfig.radiusPower.toFixed(2)} × radiusScale
              </div>
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.1"
                value={localConfig.radiusScale}
                onChange={(e) => updateConfig('radiusScale', parseFloat(e.target.value))}
              />
            </label>
            <label>
              Radius Power: {localConfig.radiusPower.toFixed(3)}
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                0.5 = sqrt (2D area), 0.333 = cbrt (3D volume)
              </div>
              <input
                type="range"
                min="0.3"
                max="0.7"
                step="0.01"
                value={localConfig.radiusPower}
                onChange={(e) => updateConfig('radiusPower', parseFloat(e.target.value))}
              />
            </label>
          </div>

          <div className={styles.section}>
            <h3>Angular Guidance (Launch Assist Only)</h3>
            <label>
              Guidance Strength: {localConfig.angularGuidanceStrength.toFixed(2)}
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                Only applied at star creation
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={localConfig.angularGuidanceStrength}
                onChange={(e) => updateConfig('angularGuidanceStrength', parseFloat(e.target.value))}
              />
            </label>
            <label>
              Radial Clamp: {localConfig.radialClampFactor.toFixed(2)}
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                How much to clamp excessive radial velocity at launch
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={localConfig.radialClampFactor}
                onChange={(e) => updateConfig('radialClampFactor', parseFloat(e.target.value))}
              />
            </label>
            <label>
              Search Radius: {localConfig.orbitalCenterSearchRadius}
              <input
                type="range"
                min="100"
                max="600"
                step="50"
                value={localConfig.orbitalCenterSearchRadius}
                onChange={(e) => updateConfig('orbitalCenterSearchRadius', parseInt(e.target.value))}
              />
            </label>
          </div>

          <div className={styles.section}>
            <h3>Visual</h3>
            <label>
              Glow Radius Multiplier: {localConfig.glowRadiusMultiplier.toFixed(3)}
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                Controls glow size: glow = baseGlow + mass^1.2 × multiplier
              </div>
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.01"
                value={localConfig.glowRadiusMultiplier}
                onChange={(e) => updateConfig('glowRadiusMultiplier', parseFloat(e.target.value))}
              />
            </label>
            <label>
              Opacity Multiplier: {localConfig.opacityMultiplier.toFixed(3)}
              <div className={styles.info} style={{ fontSize: '9px', marginTop: '2px' }}>
                Controls star opacity: opacity = mass × multiplier (clamped 0-1)
              </div>
              <input
                type="range"
                min="0"
                max="0.1"
                step="0.001"
                value={localConfig.opacityMultiplier}
                onChange={(e) => updateConfig('opacityMultiplier', parseFloat(e.target.value))}
              />
            </label>
          </div>

          <div className={styles.section}>
            <h3>Merging</h3>
            <label>
              <input
                type="checkbox"
                checked={localConfig.enableMerging}
                onChange={(e) => updateConfig('enableMerging', e.target.checked)}
              />
              Enable Merging (stars merge when smaller star is inside larger star)
            </label>
          </div>

          <div className={styles.section}>
            <button 
              className={styles.resetButton}
              onClick={() => {
                const defaultConfig = { ...GRAVITY_CONFIG }
                onConfigChange(defaultConfig)
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
