'use client'

import { useState, useEffect, useCallback } from 'react'
import { GeneticAlgorithm, DEFAULT_GA_PARAMS } from '@/lib/evolution/ga'
import { Genome } from '@/lib/evolution/genome'
import { GenomeDecoder } from '@/lib/evolution/genome'
import UniverseCard from './UniverseCard'
import UniverseDetail from './UniverseDetail'
import styles from './page.module.css'

export default function EvolutionLabPage() {
  const [ga, setGA] = useState<GeneticAlgorithm | null>(null)
  const [selectedGenomes, setSelectedGenomes] = useState<Set<number>>(new Set())
  const [detailGenome, setDetailGenome] = useState<Genome | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluationProgress, setEvaluationProgress] = useState(0)
  const [generation, setGeneration] = useState(0)
  const [autoEvolve, setAutoEvolve] = useState(false)
  const [autoEvolveInterval, setAutoEvolveInterval] = useState(20000) // 20 seconds

  // Initialize GA
  useEffect(() => {
    const newGA = new GeneticAlgorithm(DEFAULT_GA_PARAMS)
    newGA.initialize()
    setGA(newGA)
    setGeneration(0)
  }, [])

  // Auto-evolution loop
  useEffect(() => {
    if (!autoEvolve || !ga) return

    let timeoutId: NodeJS.Timeout | null = null
    let isRunning = true

    const runCycle = async () => {
      if (!isRunning || !ga) return

      // Evaluate if not already evaluated
      if (!ga.getPopulation().some(g => g.fitness !== undefined)) {
        setIsEvaluating(true)
        setEvaluationProgress(0)
        await ga.evaluatePopulation((progress) => {
          if (!isRunning) return
          setEvaluationProgress(progress)
        })
        if (!isRunning) return
        setIsEvaluating(false)
        setGeneration(ga.getGeneration())
      } else {
        // Evolve
        ga.evolve()
        setGeneration(ga.getGeneration())
        setSelectedGenomes(new Set())
        
        // Re-evaluate new generation
        setIsEvaluating(true)
        setEvaluationProgress(0)
        await ga.evaluatePopulation((progress) => {
          if (!isRunning) return
          setEvaluationProgress(progress)
        })
        if (!isRunning) return
        setIsEvaluating(false)
        setGeneration(ga.getGeneration())
      }

      // Schedule next cycle only if still running
      if (isRunning) {
        timeoutId = setTimeout(runCycle, autoEvolveInterval)
      }
    }

    // Start first cycle after a short delay
    timeoutId = setTimeout(runCycle, 1000)

    return () => {
      isRunning = false
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
  }, [autoEvolve, autoEvolveInterval, ga])

  // Evaluate population
  const handleEvaluate = useCallback(async () => {
    if (!ga) return
    
    setIsEvaluating(true)
    setEvaluationProgress(0)
    
    await ga.evaluatePopulation((progress) => {
      setEvaluationProgress(progress)
    })
    
    setIsEvaluating(false)
    setGeneration(ga.getGeneration())
  }, [ga])

  // Evolve to next generation
  const handleEvolve = useCallback(() => {
    if (!ga) return
    
    ga.evolve()
    setGeneration(ga.getGeneration())
    setSelectedGenomes(new Set())
  }, [ga])

  // Breed from selection
  const handleBreed = useCallback(() => {
    if (!ga || selectedGenomes.size < 2) return
    
    ga.setSelectedParents(Array.from(selectedGenomes))
    const children = ga.breedFromSelection()
    
    if (children.length > 0) {
      // Replace population with children
      const newGA = new GeneticAlgorithm(DEFAULT_GA_PARAMS)
      newGA['population'] = children
      newGA['generation'] = ga.getGeneration() + 1
      setGA(newGA)
      setGeneration(newGA.getGeneration())
      setSelectedGenomes(new Set())
    }
  }, [ga, selectedGenomes])

  // Toggle genome selection
  const handleToggleSelection = useCallback((index: number) => {
    setSelectedGenomes(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  // Export best genome
  const handleExportBest = useCallback(() => {
    if (!ga) return
    
    const json = ga.exportBestGenome()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `best-genome-gen${generation}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [ga, generation])

  // Enter universe (load into main demo in new window)
  const handleEnterUniverse = useCallback((genome: Genome) => {
    const config = GenomeDecoder.decode(genome)
    // Store config with a unique key to avoid conflicts
    const configKey = `gravityConfig_${Date.now()}`
    localStorage.setItem(configKey, JSON.stringify(config))
    // Open in new window with config key as query param
    const newWindow = window.open(`/motion-canvas?config=${configKey}`, '_blank')
    if (!newWindow) {
      // Fallback if popup blocked
      localStorage.setItem('gravityConfig', JSON.stringify(config))
      window.location.href = '/motion-canvas'
    }
  }, [])

  if (!ga) {
    return <div className={styles.container}>Initializing...</div>
  }

  const population = ga.getPopulation()
  const bestGenome = ga.getBestGenome()

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Evolution Lab</h1>
        <div className={styles.controls}>
          <button
            onClick={handleEvaluate}
            disabled={isEvaluating || autoEvolve}
            className={styles.button}
          >
            {isEvaluating ? `Evaluating... ${Math.round(evaluationProgress * 100)}%` : 'Evaluate Population'}
          </button>
          <button
            onClick={handleEvolve}
            disabled={isEvaluating || autoEvolve}
            className={styles.button}
          >
            Evolve Next Generation
          </button>
          <button
            onClick={handleBreed}
            disabled={selectedGenomes.size < 2 || isEvaluating || autoEvolve}
            className={styles.button}
          >
            Breed from Selection ({selectedGenomes.size} selected)
          </button>
          <button
            onClick={handleExportBest}
            disabled={!bestGenome || isEvaluating}
            className={styles.button}
          >
            Export Best Genome
          </button>
          <div className={styles.autoControls}>
            <label className={styles.autoLabel}>
              <input
                type="checkbox"
                checked={autoEvolve}
                onChange={(e) => setAutoEvolve(e.target.checked)}
                disabled={isEvaluating}
              />
              Auto Evolve
            </label>
            {autoEvolve && (
              <label className={styles.intervalLabel}>
                Interval (ms):
                <input
                  type="number"
                  min="1000"
                  max="60000"
                  step="1000"
                  value={autoEvolveInterval}
                  onChange={(e) => setAutoEvolveInterval(parseInt(e.target.value) || 5000)}
                  disabled={isEvaluating}
                  className={styles.intervalInput}
                />
              </label>
            )}
          </div>
        </div>
        <div className={styles.info}>
          Generation: {generation} | Population: {population.length} | 
          Best Fitness: {bestGenome?.fitness?.toFixed(3) || 'N/A'}
        </div>
      </div>

      <div className={styles.grid}>
        {population.map((genome, index) => (
          <UniverseCard
            key={index}
            genome={genome}
            index={index}
            isSelected={selectedGenomes.has(index)}
            onSelect={() => handleToggleSelection(index)}
            onDetail={() => setDetailGenome(genome)}
            onEnter={() => handleEnterUniverse(genome)}
          />
        ))}
      </div>

      {detailGenome && (
        <UniverseDetail
          genome={detailGenome}
          onClose={() => setDetailGenome(null)}
          onLoad={() => {
            // Load genome into main demo
            const config = GenomeDecoder.decode(detailGenome)
            localStorage.setItem('gravityConfig', JSON.stringify(config))
            window.location.href = '/motion-canvas'
          }}
        />
      )}
    </div>
  )
}

