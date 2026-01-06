# GA Evolution Parameters

## Fixed (Same for ALL Universes)

### Initial Star Configuration (from `initial-universe.json`)
- **40 stars** with **fixed positions** (3 rings: 12 inner, 16 middle, 12 outer)
- **Fixed masses**: Linear distribution from **5 to 15** (star 0 = 5.00, star 39 = 15.00)
- **Fixed speeds**: Linear distribution from **50 to 600** px/s (star 0 = 50, star 39 = 600)
- **Fixed velocities**: Tangential (perpendicular to radius) for orbital motion
- **Canvas size**: 800×600

### Fixed Physics Constants
- `velocityDamping`: Always **0** (energy conservation)
- `flickWindowMs`: Always **70ms** (flick measurement window)
- `orbitalCenterSearchRadius`: Always **300px**
- `holdToMaxSeconds`: Always **0.8s** (mass growth time)

### Fixed Visual Parameters
- `glowRadiusMultiplier`: 2.5
- `opacityMultiplier`: 0.08
- `starTrailLength`: 15
- `starTrailFadeTime`: 0.5
- `cometHeadSize`: 4
- `cometHeadGlow`: 15
- `cometTailLength`: 25
- `cometTailOpacity`: 0.6
- `cometTailFadeRate`: 0.15
- `creationRippleDuration`: 0.3
- `creationRippleMaxRadius`: 50
- `maxStars`: 60

---

## Evolvable Parameters (GA Can Change These)

### 1. Core Gravity Physics

#### `log10G` → `gravityConstant`
- **Gene**: `log10G` (log-space)
- **Decoded**: `G = 10^log10G`
- **Range**: log10(5000) to log10(50000) = **3.699 to 4.699**
- **Actual G**: **5000 to 50000**
- **What it does**: Controls strength of gravitational attraction between stars
- **Impact**: Higher G = stronger gravity = tighter orbits, faster orbital speeds

#### `log10SofteningEps` → `softeningEpsPx`
- **Gene**: `log10SofteningEps` (log-space)
- **Decoded**: `eps = 10^log10SofteningEps`
- **Range**: **-2 to 2** (log10)
- **Actual eps**: **0.01 to 100 pixels**
- **What it does**: Plummer softening parameter - prevents infinite forces at very close distances
- **Impact**: Higher eps = smoother forces at close range, prevents numerical explosions

#### `log10ForceCap` → `maxForceMagnitude`
- **Gene**: `log10ForceCap` (log-space)
- **Decoded**: `maxForce = 10^log10ForceCap` (0 if log10ForceCap < -0.5)
- **Range**: **-1 to 5** (log10)
- **Actual maxForce**: **0.1 to 100,000** (0 = disabled)
- **What it does**: Clamps maximum force magnitude to prevent extreme accelerations
- **Impact**: Prevents stars from being ejected too violently, stabilizes close encounters

#### `log10DtClamp` → `log10DtClamp`
- **Gene**: `log10DtClamp` (log-space)
- **Decoded**: `dtClamp = 10^log10DtClamp`
- **Range**: **-3 to -1** (log10)
- **Actual dtClamp**: **0.001 to 0.1 seconds**
- **What it does**: Maximum time step for numerical integration (prevents large jumps)
- **Impact**: Smaller dt = more accurate but slower simulation

---

### 2. Launch Velocity (Flick Physics)

#### `log10FlickVmax` → `flickVmax`
- **Gene**: `log10FlickVmax` (log-space)
- **Decoded**: `flickVmax = 10^log10FlickVmax`
- **Range**: log10(100) to log10(550) = **2 to 2.740**
- **Actual flickVmax**: **100 to 550 px/s**
- **What it does**: Maximum compressed launch speed from flick gesture
- **Impact**: Higher = allows faster star launches, affects orbital dynamics

#### `log10FlickS0` → `flickS0`
- **Gene**: `log10FlickS0` (log-space)
- **Decoded**: `flickS0 = 10^log10FlickS0`
- **Range**: **1 to 4** (log10)
- **Actual flickS0**: **10 to 10,000 px/s**
- **What it does**: Speed compressor scale parameter (controls compression curve)
- **Impact**: Affects how raw flick speed maps to launch speed (forgiving vs sensitive)

---

### 3. Mass Distribution (Universe Definition)

#### `log10MassMin` → `minMass`
- **Gene**: `log10MassMin` (log-space)
- **Decoded**: `minMass = 10^log10MassMin`
- **Range**: **0.5 to 2** (log10)
- **Actual minMass**: **~3.16 to 100**
- **What it does**: Minimum mass for user-created stars (hold-to-grow)
- **Impact**: Affects how small stars can be created, affects orbital dynamics

#### `log10MassRatio` → `maxMass` (via `maxMass = minMass * 10^log10MassRatio`)
- **Gene**: `log10MassRatio` (log-space)
- **Decoded**: `maxMass = minMass * 10^log10MassRatio`
- **Range**: **0 to 2** (log10)
- **Actual ratio**: **1x to 100x** (maxMass can be 1x to 100x larger than minMass)
- **What it does**: Controls the mass range for user-created stars
- **Impact**: Wider range = more variety in star sizes, affects orbital stability

#### `massShapeExponent` → `k` (in mass sampling)
- **Gene**: `massShapeExponent` (linear)
- **Range**: **0.3 to 3**
- **What it does**: Controls distribution shape: `mass = massMin + (massMax-massMin) * (u^k)`
  - `k < 1`: Bias toward smaller masses
  - `k = 1`: Uniform distribution
  - `k > 1`: Bias toward larger masses
- **Impact**: Affects how often large vs small stars appear in the universe

---

### 4. Radius Mapping (Mass → Visual Size)

#### `radiusScale` → `radiusScale`
- **Gene**: `radiusScale` (linear)
- **Range**: **0.1 to 5**
- **What it does**: Visual scale multiplier: `radius = mass^radiusPower * radiusScale`
- **Impact**: Larger = bigger visual stars for same mass, affects collision detection

#### `radiusPower` → `radiusPower`
- **Gene**: `radiusPower` (linear)
- **Range**: **0.33 to 0.6**
- **What it does**: Power in radius formula: `radius = mass^radiusPower * radiusScale`
  - `0.33` = cubic root (3D volume: mass ∝ r³)
  - `0.5` = square root (2D area: mass ∝ r²)
  - `0.6` = between 2D and 3D
- **Impact**: Affects density model, collision distances, visual appearance

---

### 5. Launch Physics

#### `launchStrength` → `launchStrength`
- **Gene**: `launchStrength` (linear)
- **Range**: **0.1 to 2.0**
- **What it does**: Multiplier for final launch velocity: `finalSpeed = compressedSpeed * launchStrength`
- **Impact**: Higher = faster launches, affects orbital dynamics and escape velocity

#### `massResistanceFactor` → `massResistanceFactor`
- **Gene**: `massResistanceFactor` (linear)
- **Range**: **0 to 1**
- **What it does**: How much mass resists acceleration: `v *= (1 - (mass/maxMass) * massResistanceFactor)`
- **Impact**: Higher = larger stars launch slower (more realistic inertia)

---

### 6. Angular Momentum Guidance (Launch Assist)

#### `angularGuidanceStrength` → `angularGuidanceStrength`
- **Gene**: `angularGuidanceStrength` (linear)
- **Range**: **0 to 1**
- **What it does**: How strongly to bias launch velocity toward circular orbit
- **Impact**: Higher = more orbital motion, lower = more free-form trajectories

#### `radialClampFactor` → `radialClampFactor`
- **Gene**: `radialClampFactor` (linear)
- **Range**: **0 to 1**
- **What it does**: How much to clamp excessive **outward** radial velocity at launch
- **Impact**: Higher = prevents escape, promotes bound orbits

---

## Summary

**Total Evolvable Parameters**: **15 genes**

- **6 log-space physics parameters** (gravity, softening, force cap, flick physics, dt clamp)
- **3 mass distribution parameters** (min, ratio, shape)
- **2 radius mapping parameters** (scale, power)
- **2 launch physics parameters** (strength, mass resistance)
- **2 angular guidance parameters** (strength, radial clamp)

**All other parameters are fixed** to ensure consistent testing conditions across all universes.

