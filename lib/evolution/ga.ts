// ============================================================================
// GENETIC ALGORITHM: Population management and evolution
// ============================================================================

import { Genome, RangeExpansion, GENOME_CLAMPS } from './genome'
import { GenomeDecoder } from './genome'
import { evaluateFitness, FitnessResult } from './fitness'

export interface GAParameters {
  populationSize: number
  eliteCount: number
  mutationRate: number
  mutationStrength: number
  enableRangeExpansion: boolean
}

export const DEFAULT_GA_PARAMS: GAParameters = {
  populationSize: 16,
  eliteCount: 2,
  mutationRate: 0.1,
  mutationStrength: 0.1,
  enableRangeExpansion: true,
}

export class GeneticAlgorithm {
  private population: Genome[] = []
  private generation: number = 0
  private parameters: GAParameters
  private rangeExpansions: Map<string, RangeExpansion> = new Map()
  private clamps = { ...GENOME_CLAMPS }
  
  constructor(parameters: GAParameters = DEFAULT_GA_PARAMS) {
    this.parameters = parameters
  }
  
  /**
   * Initialize population with random genomes
   */
  initialize(): void {
    this.population = []
    for (let i = 0; i < this.parameters.populationSize; i++) {
      this.population.push(GenomeDecoder.random())
    }
    this.generation = 0
  }
  
  /**
   * Evaluate all genomes in population
   */
  async evaluatePopulation(progressCallback?: (progress: number) => void): Promise<void> {
    const total = this.population.length
    let completed = 0
    
    for (let i = 0; i < this.population.length; i++) {
      const genome = this.population[i]
      const result = evaluateFitness(genome)
      genome.fitness = result.fitness
      genome.fitnessDetails = result
      
      completed++
      if (progressCallback) {
        progressCallback(completed / total)
      }
      
      // Yield to prevent blocking
      if (i % 2 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }
  }
  
  /**
   * Sort population by fitness
   */
  sortPopulation(): void {
    this.population.sort((a, b) => (b.fitness || 0) - (a.fitness || 0))
  }
  
  /**
   * Check for range expansion needs
   */
  checkRangeExpansion(): void {
    if (!this.parameters.enableRangeExpansion) return
    
    this.sortPopulation()
    const elites = this.population.slice(0, this.parameters.eliteCount)
    
    // Check each gene in elites (only numeric genes that have clamps)
    const geneKeys = Object.keys(GENOME_CLAMPS) as Array<keyof typeof GENOME_CLAMPS>
    for (const geneKey of geneKeys) {
      const gene = geneKey as keyof Genome
      if (typeof elites[0][gene] !== 'number') continue
      
      const clamp = this.clamps[geneKey]
      if (!clamp || typeof clamp !== 'object' || !('min' in clamp) || !('max' in clamp)) continue
      
      // Check min boundary
      const nearMin = elites.some(g => {
        const value = g[gene] as number
        const range = clamp.max - clamp.min
        return value <= clamp.min + range * 0.02
      })
      
      if (nearMin) {
        const key = `${String(geneKey)}_min`
        const exp = this.rangeExpansions.get(key) || { gene: geneKey, boundary: 'min' as const, generationsAtBoundary: 0 }
        exp.generationsAtBoundary++
        this.rangeExpansions.set(key, exp)
        
        if (exp.generationsAtBoundary >= 2) {
          clamp.min -= 1.0 // Expand by 10x in log space
          exp.generationsAtBoundary = 0 // Reset
        }
      } else {
        this.rangeExpansions.delete(`${String(geneKey)}_min`)
      }
      
      // Check max boundary
      const nearMax = elites.some(g => {
        const value = g[gene] as number
        const range = clamp.max - clamp.min
        return value >= clamp.max - range * 0.02
      })
      
      if (nearMax) {
        const key = `${String(geneKey)}_max`
        const exp = this.rangeExpansions.get(key) || { gene: geneKey, boundary: 'max' as const, generationsAtBoundary: 0 }
        exp.generationsAtBoundary++
        this.rangeExpansions.set(key, exp)
        
        if (exp.generationsAtBoundary >= 2) {
          clamp.max += 1.0 // Expand by 10x in log space
          exp.generationsAtBoundary = 0 // Reset
        }
      } else {
        this.rangeExpansions.delete(`${String(geneKey)}_max`)
      }
    }
  }
  
  /**
   * Create next generation
   */
  evolve(): void {
    this.sortPopulation()
    
    // Check for range expansion
    this.checkRangeExpansion()
    
    const newPopulation: Genome[] = []
    
    // Elitism: keep top genomes
    for (let i = 0; i < this.parameters.eliteCount; i++) {
      newPopulation.push({ ...this.population[i] })
    }
    
    // Fill rest with crossover + mutation
    while (newPopulation.length < this.parameters.populationSize) {
      // Select parents (tournament selection)
      const parent1 = this.tournamentSelect(3)
      const parent2 = this.tournamentSelect(3)
      
      // Crossover
      let child = GenomeDecoder.crossover(parent1, parent2)
      
      // Mutation
      child = GenomeDecoder.mutate(child, this.parameters.mutationRate, this.parameters.mutationStrength)
      
      // Apply clamps
      child = this.applyClamps(child)
      
      newPopulation.push(child)
    }
    
    this.population = newPopulation
    this.generation++
  }
  
  /**
   * Tournament selection
   */
  private tournamentSelect(tournamentSize: number): Genome {
    const tournament: Genome[] = []
    for (let i = 0; i < tournamentSize; i++) {
      const index = Math.floor(Math.random() * this.population.length)
      tournament.push(this.population[index])
    }
    tournament.sort((a, b) => (b.fitness || 0) - (a.fitness || 0))
    return tournament[0]
  }
  
  /**
   * Apply clamps to genome
   */
  private applyClamps(genome: Genome): Genome {
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
    
    return {
      ...genome,
      log10G: clamp(genome.log10G, this.clamps.log10G.min, this.clamps.log10G.max),
      log10SofteningEps: clamp(genome.log10SofteningEps, this.clamps.log10SofteningEps.min, this.clamps.log10SofteningEps.max),
      log10ForceCap: clamp(genome.log10ForceCap, this.clamps.log10ForceCap.min, this.clamps.log10ForceCap.max),
      log10FlickVmax: clamp(genome.log10FlickVmax, this.clamps.log10FlickVmax.min, this.clamps.log10FlickVmax.max),
      log10FlickS0: clamp(genome.log10FlickS0, this.clamps.log10FlickS0.min, this.clamps.log10FlickS0.max),
      log10DtClamp: clamp(genome.log10DtClamp, this.clamps.log10DtClamp.min, this.clamps.log10DtClamp.max),
      log10MassMin: clamp(genome.log10MassMin, this.clamps.log10MassMin.min, this.clamps.log10MassMin.max),
      log10MassRatio: clamp(genome.log10MassRatio, this.clamps.log10MassRatio.min, this.clamps.log10MassRatio.max),
      massShapeExponent: clamp(genome.massShapeExponent, this.clamps.massShapeExponent.min, this.clamps.massShapeExponent.max),
      radiusScale: clamp(genome.radiusScale, this.clamps.radiusScale.min, this.clamps.radiusScale.max),
      radiusPower: clamp(genome.radiusPower, this.clamps.radiusPower.min, this.clamps.radiusPower.max),
      launchStrength: clamp(genome.launchStrength, this.clamps.launchStrength.min, this.clamps.launchStrength.max),
      massResistanceFactor: clamp(genome.massResistanceFactor, this.clamps.massResistanceFactor.min, this.clamps.massResistanceFactor.max),
      angularGuidanceStrength: clamp(genome.angularGuidanceStrength, this.clamps.angularGuidanceStrength.min, this.clamps.angularGuidanceStrength.max),
      radialClampFactor: clamp(genome.radialClampFactor, this.clamps.radialClampFactor.min, this.clamps.radialClampFactor.max),
    }
  }
  
  /**
   * Get current population
   */
  getPopulation(): Genome[] {
    return this.population
  }
  
  /**
   * Get current generation
   */
  getGeneration(): number {
    return this.generation
  }
  
  /**
   * Get best genome
   */
  getBestGenome(): Genome | null {
    this.sortPopulation()
    return this.population[0] || null
  }
  
  /**
   * Set selected parents for breeding
   */
  setSelectedParents(indices: number[]): void {
    // Store selection for breeding
    this.selectedParentIndices = indices
  }
  
  private selectedParentIndices: number[] = []
  
  /**
   * Breed from selected parents
   */
  breedFromSelection(): Genome[] {
    if (this.selectedParentIndices.length < 2) {
      return []
    }
    
    const parents = this.selectedParentIndices.map(i => this.population[i]).filter(Boolean)
    if (parents.length < 2) return []
    
    const children: Genome[] = []
    for (let i = 0; i < this.parameters.populationSize; i++) {
      const parent1 = parents[Math.floor(Math.random() * parents.length)]
      const parent2 = parents[Math.floor(Math.random() * parents.length)]
      let child = GenomeDecoder.crossover(parent1, parent2)
      child = GenomeDecoder.mutate(child, this.parameters.mutationRate, this.parameters.mutationStrength)
      child = this.applyClamps(child)
      children.push(child)
    }
    
    return children
  }
  
  /**
   * Export best genome as JSON
   */
  exportBestGenome(): string {
    const best = this.getBestGenome()
    if (!best) return ''
    
    const config = GenomeDecoder.decode(best)
    return JSON.stringify({
      genome: best,
      config,
      fitness: best.fitness,
      fitnessDetails: best.fitnessDetails,
    }, null, 2)
  }
  
  /**
   * Import genome from JSON
   */
  importGenome(json: string): Genome | null {
    try {
      const data = JSON.parse(json)
      return data.genome || data
    } catch {
      return null
    }
  }
}

