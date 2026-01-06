'use client'

import { Genome } from '@/lib/evolution/genome'
import { GenomeDecoder } from '@/lib/evolution/genome'
import styles from './UniverseCard.module.css'

interface UniverseCardProps {
  genome: Genome
  index: number
  isSelected: boolean
  onSelect: () => void
  onDetail: () => void
  onEnter?: () => void
}

export default function UniverseCard({ genome, index, isSelected, onSelect, onDetail, onEnter }: UniverseCardProps) {
  const config = GenomeDecoder.decode(genome)
  const massMin = Math.pow(10, genome.log10MassMin)
  const massMax = massMin * Math.pow(10, genome.log10MassRatio)
  const G = Math.pow(10, genome.log10G)
  
  const fitness = genome.fitness || 0
  const details = genome.fitnessDetails
  
  return (
    <div
      className={`${styles.card} ${isSelected ? styles.selected : ''}`}
      onClick={onSelect}
      onDoubleClick={onDetail}
    >
      <div className={styles.header}>
        <span className={styles.index}>#{index}</span>
        <span className={styles.fitness}>Fitness: {fitness.toFixed(3)}</span>
      </div>
      
      <div className={styles.badges}>
        {details && (
          <>
            <span className={styles.badge} title={`Stars Remaining: ${details.starsRemaining ?? 0}/40`}>
              {(details.starsRemaining ?? 0) >= 20 ? '✓' : '✗'} Stars: {details.starsRemaining ?? 0}
            </span>
            {details.orbitMetrics && (
              <>
                <span className={styles.badge} title={`Radial Variance: ${details.orbitMetrics.radVar.toFixed(3)}`}>
                  RadVar: {details.orbitMetrics.radVar.toFixed(2)}
                </span>
                <span className={styles.badge} title={`Orbital Turns: ${details.orbitMetrics.turns.toFixed(1)}`}>
                  Turns: {details.orbitMetrics.turns.toFixed(1)}
                </span>
                <span className={styles.badge} title={`Tangential Ratio: ${details.orbitMetrics.tanRatio.toFixed(2)}`}>
                  Tan: {details.orbitMetrics.tanRatio.toFixed(2)}
                </span>
              </>
            )}
            <span className={styles.badge} title={`Energy Drift: ${details.energyDrift.toFixed(3)}`}>
              Drift: {(details.energyDrift * 100).toFixed(1)}%
            </span>
          </>
        )}
      </div>
      
      <div className={styles.params}>
        <div className={styles.param}>
          <span className={styles.paramLabel}>G:</span>
          <span className={styles.paramValue}>{G.toFixed(0)}</span>
        </div>
        <div className={styles.param}>
          <span className={styles.paramLabel}>Mass:</span>
          <span className={styles.paramValue}>{massMin.toFixed(1)}-{massMax.toFixed(1)}</span>
        </div>
        <div className={styles.param}>
          <span className={styles.paramLabel}>Flick Vmax:</span>
          <span className={styles.paramValue}>{config.flickVmax.toFixed(0)}</span>
        </div>
      </div>
      
      <div className={styles.actions}>
        <button 
          className={styles.enterButton} 
          onClick={(e) => { 
            e.stopPropagation(); 
            if (onEnter) onEnter(); 
          }}
          title="Enter this universe"
        >
          Enter Universe
        </button>
        <button className={styles.detailButton} onClick={(e) => { e.stopPropagation(); onDetail(); }}>
          Details
        </button>
      </div>
    </div>
  )
}

