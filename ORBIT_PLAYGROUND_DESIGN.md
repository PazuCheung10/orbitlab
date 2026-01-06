# ORBIT_PLAYGROUND Design Document

## Core Philosophy

**We are building an interactive gravitational art system, not a scientifically perfect orbital simulator.**

The goal is **visually satisfying, long-lasting curved motion** (circular/elliptical arcs) under human-controllable input, NOT mathematically perfect Newtonian orbits.

## Two Distinct Modes

### 1. ORBIT_PLAYGROUND (Default, User-Facing)
- **Designed for fun, stability, and long arcs**
- **Cheating is allowed if it improves feel**
- Circular/elliptical motion should be **COMMON**
- Optimized for visual satisfaction

### 2. N_BODY_CHAOS (Optional/Debug)
- Physically honest
- No guarantees of stability
- Used only for comparison

---

## Absolute Rules (ORBIT_PLAYGROUND)

### ✅ ENFORCED Rules

1. **NO global velocity damping**
   - `velocityDamping = 0` (enforced in `updateConfig()`)
   - Energy loss destroys orbits

2. **NO mass-dependent speed scaling**
   - Removed: `v *= referenceMass / mass`
   - Circular orbit speed depends **ONLY** on `v_circ = sqrt(G * M / r)`

3. **NO random direction mixing > 20%**
   - Initial velocity is **mostly tangential** (perpendicular to radius)
   - Randomness limited to **±10%** deviation from tangential

4. **NO satellite-satellite gravity**
   - `satellitesAttractEachOther = false` (enforced in `updateConfig()`)
   - Only dominant central mass affects satellites
   - Prevents chaotic perturbations

5. **NO force clamping**
   - `maxForceMagnitude = 0` (enforced in `updateConfig()`)
   - Allow natural orbital forces

6. **Small softening parameter**
   - `softeningEpsPx = 1.5` (reduced from 3)
   - Softening exists ONLY to avoid singularities, not to reshape orbits

7. **Strict time step**
   - `dt ≤ 0.01s` for ORBIT_PLAYGROUND (vs 0.1s for N_BODY_CHAOS)
   - Better numerical accuracy

---

## Correct Orbital Model

For a satellite orbiting a dominant center:

```
v_circ = sqrt(G * M / r)
```

**Implementation:**
- Velocity direction = **perpendicular to radius** (tangential)
- Velocity magnitude = `v_circ * orbitFactor`
- `orbitFactor` defaults to 1.0 (circular)
- Small deviation allowed: **±10%** random angle

**Location**: `lib/gravity/simulation.ts:208-230` (`loadUniverse()`)

---

## Physics Implementation

### Force Calculation (ORBIT_PLAYGROUND)
**Location**: `lib/gravity/simulation.ts:549-641` (Pass 1) and `621-641` (Pass 2)

- Satellites **ONLY** feel central sun
- No satellite-satellite interactions
- No force clamping
- Softened gravity: `r² = dx² + dy² + eps²` (eps = 1.5)

### Integration
- **Leapfrog** (Velocity Verlet) - energy-conserving
- `dt ≤ 0.01s` for ORBIT_PLAYGROUND
- Speed limit: 1500 px/s (safety ceiling only)

### Boundaries
- Boundary wrapping breaks energy conservation
- Current: Uses wrapping (may need improvement)
- Future: Consider fade-out or larger invisible bounds

---

## Mass → Radius Mapping

**Formula**: `radius = radiusScale * mass^radiusPower`

Where:
- `radiusPower ∈ [0.33, 0.5]`
  - 0.33 = 3D-like density (current: 0.333)
  - 0.5 = 2D-like density
- `radiusScale` is visual only

**Collision & merge detection** MUST use this radius (not glow radius).

**Location**: `lib/gravity/star.ts:45-47` (radius getter)

---

## Merging Rules

- Merging is **OPTIONAL** (`enableMerging` config)
- If enabled:
  - Uses **momentum conservation**: `v_new = (m1*v1 + m2*v2) / (m1 + m2)`
  - No energy injection
  - **Location**: `lib/gravity/star.ts:124-142` (`mergeWith()`)

---

## Angular Momentum Guidance (Launch Assist)

**Rules:**
- Apply guidance **ONLY at creation time** (on release)
- **NEVER** apply during natural simulation
- Guidance does:
  - Reduce excessive outward radial velocity
  - Inject tangential component if missing

This is a **player assist**, not physics.

**Location**: `lib/gravity/simulation.ts:301-454` (`finishCreation()`)

---

## Visual Parameters (Fixed)

- **Glow Radius Multiplier**: 0.06 (fixed)
- **Opacity Multiplier**: 0.02 (fixed)
- Glow scales with mass: `glow = baseGlow + mass^1.2 × 0.06`
- Glow is **purely visual** - does NOT affect physics

---

## Summary of Changes Made

1. ✅ **Removed mass-dependent velocity scaling** - `loadUniverse()` now uses pure `v_circ`
2. ✅ **Reduced random direction to ≤10%** - Changed from 30-70% to ±10% deviation
3. ✅ **Disabled satellite-satellite gravity** - Enforced `false` in `updateConfig()`
4. ✅ **Reduced softening epsilon** - Changed from 3 to 1.5
5. ✅ **Removed force clamping** - Enforced `maxForceMagnitude = 0` in ORBIT_PLAYGROUND
6. ✅ **Ensured tangential velocity** - Velocity is perpendicular to radius by construction
7. ✅ **Verified mass → radius mapping** - Already correct (`radius = mass^0.333 * radiusScale`)
8. ✅ **Strict time step** - `dt ≤ 0.01s` for ORBIT_PLAYGROUND
9. ✅ **Enforced rules in `updateConfig()`** - Automatically applies ORBIT_PLAYGROUND constraints

---

## Key Files

- **`lib/gravity/simulation.ts`**: Main physics loop, force calculation, universe loading
- **`lib/gravity/star.ts`**: Leapfrog integration, merging (momentum conservation)
- **`lib/gravity/config.ts`**: Configuration defaults and enforcement
- **`lib/gravity/universe-presets.ts`**: Preset configurations

---

## Result

ORBIT_PLAYGROUND mode is now optimized for **stable, long-lasting orbital motion** with:
- Pure tangential initial velocities
- No mass-dependent speed scaling
- No satellite-satellite perturbations
- No force clamping
- Small softening (singularity prevention only)
- Strict numerical accuracy (small dt)

This should produce **common, stable circular/elliptical motion** that feels satisfying and lasts.

