import { computeEtas, etaMinutesFor, haversineKm } from './eta-engine.mjs'

const MAX_ROUTE_CLOSURE_KM = 0.075
const PROJECTION_TOLERANCE_KM = 0.015
const MAX_SNAP_KM = 0.075
const BACKTRACK_TOLERANCE_KM = 0.012
const MIN_DISTINCT_PROGRESS_KM = 0.035
const AMBIGUITY_COST_KM = 0.008
const MAX_SAMPLE_GAP_MS = 45_000

function measureRoute(points) {
  const cumulative = [0]
  for (let i = 1; i < points.length; i++) {
    const { lat, lng } = points[i - 1]
    cumulative.push(cumulative[i - 1] + haversineKm(lat, lng, points[i].lat, points[i].lng))
  }
  return cumulative
}

// Match each visit, in stop_order, to one position along the route. The same
// stop ID may have a different route position on the return leg.
function locateStopVisits(stops, points, cumulative) {
  if (stops.length > points.length) return null
  const errors = stop => points.map(point => haversineKm(stop.lat, stop.lng, point.lat, point.lng))
  let costs = errors(stops[0])
  const previous = []
  for (const stop of stops.slice(1)) {
    let best = Infinity
    let bestIndex = -1
    const predecessors = []
    const next = errors(stop).map((error, index) => {
      if (index > 0 && costs[index - 1] < best) {
        best = costs[index - 1]
        bestIndex = index - 1
      }
      predecessors.push(bestIndex)
      return best + error
    })
    previous.push(predecessors)
    costs = next
  }
  let index = costs.reduce((best, cost, i) => cost < costs[best] ? i : best, 0)
  const indices = [index]
  for (const predecessors of previous.reverse()) {
    index = predecessors[index]
    indices.unshift(index)
  }
  return stops.map((stop, i) => ({ ...stop, progress: cumulative[indices[i]] }))
}

function projectLocation(location, points, cumulative) {
  const candidates = []
  // Local planar projection for the fraction along a campus road segment.
  const lngScale = Math.cos(location.lat * Math.PI / 180)
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1]
    const end = points[i]
    const dx = (end.lng - start.lng) * lngScale
    const dy = end.lat - start.lat
    const lengthSquared = dx * dx + dy * dy
    if (lengthSquared === 0) continue
    const fraction = Math.min(1, Math.max(0,
      (((location.lng - start.lng) * lngScale) * dx + (location.lat - start.lat) * dy) / lengthSquared,
    ))
    const distance = haversineKm(location.lat, location.lng, start.lat + fraction * dy,
      start.lng + fraction * (end.lng - start.lng))
    candidates.push({ distance, progress: cumulative[i - 1] + fraction * (cumulative[i] - cumulative[i - 1]) })
  }
  candidates.sort((a, b) => a.distance - b.distance)
  if (!candidates.length || candidates[0].distance > MAX_SNAP_KM) return []
  const closest = candidates[0].distance
  const distinct = []
  for (const candidate of candidates) {
    if (candidate.distance > closest + PROJECTION_TOLERANCE_KM) break
    if (!distinct.some(other => Math.abs(other.progress - candidate.progress) < BACKTRACK_TOLERANCE_KM)) {
      distinct.push(candidate)
    }
  }
  return distinct
}

function routeAdvance(from, to, total) {
  const displacement = to - from
  if (displacement < -total / 2) return displacement + total
  if (displacement > total / 2) return displacement - total
  return displacement
}

function matchRouteProgress(locations, points, cumulative) {
  const total = cumulative[cumulative.length - 1]
  let previous = []
  let lastLocation = null
  for (const location of locations) {
    const matches = projectLocation(location, points, cumulative)
    const elapsed = lastLocation ? location.time - lastLocation.time : 0
    let current = matches.map(candidate => ({ ...candidate, cost: candidate.distance }))
    if (previous.length && elapsed > 0 && elapsed <= MAX_SAMPLE_GAP_MS) {
      const displacement = haversineKm(lastLocation.lat, lastLocation.lng, location.lat, location.lng)
      // Allow GPS noise and curved roads. Reject jumps to distant parts of the same loop.
      const maxAdvance = Math.max(displacement * 2.5 + 0.025, elapsed * 0.000018 + 0.025)
      const linked = []
      for (const candidate of matches) {
        let cost = Infinity
        for (const before of previous) {
          const advance = routeAdvance(before.progress, candidate.progress, total)
          if (advance < -BACKTRACK_TOLERANCE_KM || advance > maxAdvance) continue
          const penalty = Math.abs(advance - displacement) * 0.35 + Math.max(0, -advance)
          cost = Math.min(cost, before.cost + candidate.distance + penalty)
        }
        if (Number.isFinite(cost)) linked.push({ ...candidate, cost })
      }
      if (linked.length) current = linked
    }
    previous = current
    lastLocation = location
  }
  if (!previous.length) return null
  previous.sort((a, b) => a.cost - b.cost)
  const best = previous[0]
  const uncertain = previous.some(candidate => candidate.cost - best.cost <= AMBIGUITY_COST_KM &&
      Math.abs(routeAdvance(best.progress, candidate.progress, total)) >= MIN_DISTINCT_PROGRESS_KM)
  return { progress: best.progress, uncertain }
}

/** ETA for each stop visit and the stop labels used by the passenger API. */
export function getLiveStopEtas({ latestLocation, recentLocations, speedKmh, stops, waypoints }) {
  const { lat, lng } = latestLocation
  const fallback = () => ({
    etas: computeEtas({ busLat: lat, busLng: lng, speedKmh, stops, waypoints }),
    nextStopId: null,
    passedStopId: null,
  })
  if (!waypoints || !stops.length) return fallback()
  const first = waypoints[0]
  const last = waypoints[waypoints.length - 1]
  const closure = haversineKm(first.lat, first.lng, last.lat, last.lng)
  if (closure > MAX_ROUTE_CLOSURE_KM || !Number.isFinite(closure)) return fallback()
  const points = closure === 0 ? waypoints : [...waypoints, first]
  const cumulative = measureRoute(points)
  const total = cumulative[cumulative.length - 1]
  if (!Number.isFinite(total) || total <= 0) return fallback()
  const visits = locateStopVisits(stops, waypoints, cumulative)
  if (!visits) return fallback()

  // Recorded times have second precision. When samples share a timestamp, use
  // the latest inserted sample for that second instead of inferring movement.
  const history = new Map()
  for (const sample of recentLocations) {
    if (Number.isFinite(sample.lat) && Number.isFinite(sample.lng) && sample.time < latestLocation.time) {
      history.set(sample.time, sample)
    }
  }
  const match = matchRouteProgress([...history.values(), latestLocation], points, cumulative)
  if (!match) return fallback()

  const nextIndex = visits.findIndex(visit => visit.progress >= match.progress)
  const upcoming = nextIndex < 0 ? 0 : nextIndex
  const nextStopId = match.uncertain ? null : visits[upcoming].stop_id
  const previousVisit = visits[(upcoming + visits.length - 1) % visits.length]
  const passedStopId = match.uncertain || previousVisit.stop_id === nextStopId ? null : previousVisit.stop_id
  const etas = visits.map(({ stop_id, name, progress }) => {
    const delta = progress - match.progress
    const distanceKm = delta < 0 ? delta + total : delta
    return { stop_id, name, distanceKm, etaMinutes: etaMinutesFor(distanceKm, speedKmh) }
  })
  return { etas, nextStopId, passedStopId }
}
