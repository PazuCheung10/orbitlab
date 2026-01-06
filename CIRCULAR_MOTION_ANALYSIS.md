# Circular Motion Stability Analysis

## Core Logic Files

### Primary Physics Engine
- **`lib/gravity/simulation.ts`**: Main physics update loop
  - Lines 522-750: `update()` method with Leapfrog integration
  - Lines 537-746: Force calculation (ORBIT_PLAYGROUND vs N_BODY_CHAOS)
  - Lines 752-776: Merging logic

- **`lib/gravity/star.ts`**: Star physics and integration
  - Lines 49-99: `updateLeapfrog()` - First kick + drift
  - Lines 102-110: `completeLeapfrog()` - Second kick
  - Lines 124-142: `mergeWith()` - Momentum-conserving merge

## What Makes Circular Motion Hard to Achieve Stably

### 1. **Initial Velocity Mismatch**
**Location**: `lib/gravity/simulation.ts:208-230` (loadUniverse)
- Problem: Initial velocities are computed from `v_circ = sqrt(G*M/r) * orbitFactor`
- Issue: `orbitFactor` and random direction mixing (30-70% random) can create non-circular trajectories
- Impact: Stars start with velocities that don't match perfect circular orbits

### 2. **Mass-Dependent Speed Scaling**
**Location**: `lib/gravity/simulation.ts:214-215`
- Problem: Smaller stars get speed boost: `v = v_circ * orbitFactor * (referenceMass/mass)`
- Impact: This breaks the circular orbit velocity relationship, making orbits elliptical or unstable

### 3. **Plummer Softening**
**Location**: `lib/gravity/simulation.ts:547-549` (force calculation)
- Formula: `r² = dx² + dy² + eps²` (softening parameter)
- Problem: Softening changes the effective gravitational potential, making perfect circular orbits impossible
- Impact: Orbits precess and decay slightly over time

### 4. **Force Clamping**
**Location**: `lib/gravity/simulation.ts:554-567` (maxForceMagnitude)
- Problem: Force clamping can suppress necessary accelerations for tight orbits
- Impact: Stars in close orbits may not experience correct centripetal force

### 5. **Numerical Integration Errors**
**Location**: `lib/gravity/star.ts:51-99` (Leapfrog)
- Problem: Even symplectic integrators accumulate small errors over time
- Impact: Energy drift causes orbits to slowly decay or expand

### 6. **Boundary Wrapping**
**Location**: `lib/gravity/star.ts:69-72` (periodic boundaries)
- Problem: Wrapping positions can break energy conservation
- Impact: Orbits near boundaries lose energy when wrapped

### 7. **Satellite-Satellite Interactions** (if enabled)
**Location**: `lib/gravity/simulation.ts:570-586`
- Problem: Additional gravitational forces from other satellites perturb orbits
- Impact: Multi-body interactions make stable circular orbits nearly impossible

### 8. **Speed Limiting**
**Location**: `lib/gravity/star.ts:78-82` (NEW: max speed 1500)
- Problem: Speed clamping can prevent stars from reaching necessary orbital velocities
- Impact: High-speed circular orbits may be artificially limited

## Core Logic Summary

**Circular orbit requires**: `v = sqrt(G*M/r)` exactly, with velocity perpendicular to radius

**Current system**:
1. Computes approximate `v_circ` but applies mass-dependent scaling
2. Adds 30-70% random direction component
3. Uses softened gravity (not true 1/r²)
4. Applies force clamping that can suppress accelerations
5. Accumulates numerical errors over time

**Result**: Orbits are elliptical at best, and often unstable or decaying.

## Momentum Conservation

**YES** - Momentum is conserved in merging:
- **Location**: `lib/gravity/star.ts:133-135`
- Formula: `v_new = (m1*v1 + m2*v2) / (m1 + m2)`
- This correctly conserves total momentum: `p_total = m1*v1 + m2*v2 = (m1+m2)*v_new`

## Recommendations for More Stable Circular Motion

1. **Remove mass-dependent speed scaling** in initial velocity
2. **Reduce random direction component** (maybe 10-20% instead of 30-70%)
3. **Use smaller softening parameter** (eps = 1-2 instead of 3)
4. **Disable force clamping** for ORBIT_PLAYGROUND mode
5. **Ensure orbitFactor = 1.0** for circular orbits
6. **Disable satellite-satellite gravity** for pure circular motion
7. **Use smaller time steps** (dt < 0.01) for better accuracy

