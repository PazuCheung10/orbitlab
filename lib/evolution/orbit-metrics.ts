// ============================================================================
// ORBIT METRICS: Compute orbital stability metrics
// ============================================================================

function unwrapDeltaAngle(d: number): number {
  while (d > Math.PI) d -= 2 * Math.PI
  while (d < -Math.PI) d += 2 * Math.PI
  return d
}

export interface OrbitMetrics {
  radVar: number // Radial variance (normalized)
  turns: number // Number of orbital turns
  tanRatio: number // Tangential velocity ratio (0-1, higher = more circular)
}

export function computeOrbitMetrics(
  positions: Array<{x: number; y: number}>,
  velocities: Array<{x: number; y: number}>,
  center: {x: number; y: number}
): OrbitMetrics | null {
  const n = positions.length
  if (n < 3) return null

  const rs: number[] = []
  const thetas: number[] = []
  const tanRatios: number[] = []

  for (let i = 0; i < n; i++) {
    const px = positions[i].x - center.x
    const py = positions[i].y - center.y
    const r = Math.hypot(px, py)
    rs.push(r)
    thetas.push(Math.atan2(py, px))

    const vx = velocities[i].x
    const vy = velocities[i].y
    const v = Math.hypot(vx, vy)

    if (r > 1e-6 && v > 1e-6) {
      const rx = px / r
      const ry = py / r
      const vr = vx * rx + vy * ry
      const vt = Math.sqrt(Math.max(0, v * v - vr * vr))
      tanRatios.push(vt / (v + 1e-6))
    }
  }

  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length
  const variance = (a: number[]) => {
    const m = mean(a)
    return mean(a.map(x => (x - m) * (x - m)))
  }

  const rMean = mean(rs)
  const radVar = variance(rs) / Math.max(1e-6, rMean * rMean)

  let totalAbsDtheta = 0
  for (let i = 1; i < n; i++) {
    const d = unwrapDeltaAngle(thetas[i] - thetas[i - 1])
    totalAbsDtheta += Math.abs(d)
  }
  const turns = totalAbsDtheta / (2 * Math.PI)

  const tanRatio = tanRatios.length ? mean(tanRatios) : 0

  return { radVar, turns, tanRatio }
}

