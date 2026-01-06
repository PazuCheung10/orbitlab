'use client'

import { Genome } from '@/lib/evolution/genome'
import { GenomeDecoder } from '@/lib/evolution/genome'
import styles from './UniverseDetail.module.css'

interface UniverseDetailProps {
  genome: Genome
  onClose: () => void
  onLoad: () => void
}

export default function UniverseDetail({ genome, onClose, onLoad }: UniverseDetailProps) {
  const config = GenomeDecoder.decode(genome)
  const massMin = Math.pow(10, genome.log10MassMin)
  const massMax = massMin * Math.pow(10, genome.log10MassRatio)
  
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Universe Details</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.section}>
            <h3>Fitness</h3>
            <div className={styles.fitness}>
              <div>Overall: {genome.fitness?.toFixed(4) || 'N/A'}</div>
              {genome.fitnessDetails && (
                <>
                  <div>Radial Variance: {genome.fitnessDetails.radialVariance.toFixed(4)}</div>
                  <div>Energy Drift: {genome.fitnessDetails.energyDrift.toFixed(4)}</div>
                  <div>Escapes: {genome.fitnessDetails.escapeCount}</div>
                  <div>Merges: {genome.fitnessDetails.mergeCount}</div>
                  <div>Playability: {genome.fitnessDetails.playabilityScore.toFixed(2)}</div>
                </>
              )}
            </div>
          </div>
          
          <div className={styles.section}>
            <h3>Physics Parameters</h3>
            <div className={styles.params}>
              <div className={styles.paramRow}>
                <span>Gravity Constant (G):</span>
                <span>{config.gravityConstant.toFixed(2)}</span>
                <span className={styles.gene}>(log10: {genome.log10G.toFixed(3)})</span>
              </div>
              <div className={styles.paramRow}>
                <span>Softening Epsilon:</span>
                <span>{config.softeningEpsPx.toFixed(2)} px</span>
                <span className={styles.gene}>(log10: {genome.log10SofteningEps.toFixed(3)})</span>
              </div>
              <div className={styles.paramRow}>
                <span>Max Force:</span>
                <span>{config.maxForceMagnitude > 0 ? config.maxForceMagnitude.toFixed(0) : 'Disabled'}</span>
                <span className={styles.gene}>(log10: {genome.log10ForceCap.toFixed(3)})</span>
              </div>
              <div className={styles.paramRow}>
                <span>Flick Vmax:</span>
                <span>{config.flickVmax.toFixed(0)} px/s</span>
                <span className={styles.gene}>(log10: {genome.log10FlickVmax.toFixed(3)})</span>
              </div>
              <div className={styles.paramRow}>
                <span>Flick S0:</span>
                <span>{config.flickS0.toFixed(0)} px/s</span>
                <span className={styles.gene}>(log10: {genome.log10FlickS0.toFixed(3)})</span>
              </div>
            </div>
          </div>
          
          <div className={styles.section}>
            <h3>Mass Distribution</h3>
            <div className={styles.params}>
              <div className={styles.paramRow}>
                <span>Min Mass:</span>
                <span>{massMin.toFixed(2)}</span>
                <span className={styles.gene}>(log10: {genome.log10MassMin.toFixed(3)})</span>
              </div>
              <div className={styles.paramRow}>
                <span>Max Mass:</span>
                <span>{massMax.toFixed(2)}</span>
                <span className={styles.gene}>(ratio log10: {genome.log10MassRatio.toFixed(3)})</span>
              </div>
              <div className={styles.paramRow}>
                <span>Shape Exponent:</span>
                <span>{genome.massShapeExponent.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className={styles.section}>
            <h3>Launch Parameters</h3>
            <div className={styles.params}>
              <div className={styles.paramRow}>
                <span>Launch Strength:</span>
                <span>{config.launchStrength.toFixed(2)}</span>
              </div>
              <div className={styles.paramRow}>
                <span>Mass Resistance:</span>
                <span>{config.massResistanceFactor.toFixed(2)}</span>
              </div>
              <div className={styles.paramRow}>
                <span>Angular Guidance:</span>
                <span>{config.angularGuidanceStrength.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          <div className={styles.section}>
            <h3>Radius Mapping</h3>
            <div className={styles.params}>
              <div className={styles.paramRow}>
                <span>Radius Scale:</span>
                <span>{config.radiusScale.toFixed(2)}</span>
              </div>
              <div className={styles.paramRow}>
                <span>Radius Power:</span>
                <span>{config.radiusPower.toFixed(3)}</span>
              </div>
            </div>
          </div>
          
          <div className={styles.actions}>
            <button className={styles.loadButton} onClick={onLoad}>
              Load in Main Demo
            </button>
            <button className={styles.exportButton} onClick={() => {
              const json = JSON.stringify({ genome, config }, null, 2)
              const blob = new Blob([json], { type: 'application/json' })
              const url = URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `genome-${genome.fitness?.toFixed(3)}.json`
              a.click()
              URL.revokeObjectURL(url)
            }}>
              Export JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

