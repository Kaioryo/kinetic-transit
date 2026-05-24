import { Shuttle, Stop, Route, ETAInfo } from './types'
import {
  haversineDistance,
  findClosestWaypointIndex,
  distanceAlongWaypoints,
} from './geo-utils'

// ============================================
// ETA Calculator
// Calculates estimated time of arrival for
// shuttles to reach each stop on their route
// ============================================

/**
 * Calculate ETA from a shuttle to a specific stop
 * @returns ETAInfo or null if the stop is not on the shuttle's route
 */
export function calculateETAToStop(
  shuttle: Shuttle,
  stop: Stop,
  route: Route
): ETAInfo | null {
  // Check if stop is on this route
  if (!route.stops.includes(stop.id)) {
    return null
  }

  const shuttlePos = { lat: shuttle.latitude, lng: shuttle.longitude }
  const stopPos = { lat: stop.latitude, lng: stop.longitude }

  // Find closest waypoint to shuttle
  const shuttleWpIdx = findClosestWaypointIndex(shuttlePos, route.waypoints)

  // Find closest waypoint to stop
  const stopWpIdx = findClosestWaypointIndex(stopPos, route.waypoints)

  // Calculate distance along route
  let distanceKm: number

  if (stopWpIdx > shuttleWpIdx) {
    // Stop is ahead on the route
    distanceKm = distanceAlongWaypoints(route.waypoints, shuttleWpIdx)
    // Subtract distance past the stop
    const pastStopDist = distanceAlongWaypoints(route.waypoints, stopWpIdx)
    distanceKm = distanceKm - pastStopDist

    // Add direct distance from shuttle to nearest waypoint
    distanceKm += haversineDistance(
      shuttle.latitude,
      shuttle.longitude,
      route.waypoints[shuttleWpIdx].lat,
      route.waypoints[shuttleWpIdx].lng
    )
  } else {
    // Stop is behind — shuttle needs to reach end and come back
    // For simplicity, use direct haversine distance
    distanceKm = haversineDistance(
      shuttle.latitude,
      shuttle.longitude,
      stop.latitude,
      stop.longitude
    )
    // Multiply by 1.4 to account for road winding
    distanceKm *= 1.4
  }

  // Calculate ETA in minutes
  const speed = Math.max(shuttle.speed_kmh, 5) // minimum 5 km/h
  const etaHours = distanceKm / speed
  const etaMinutes = Math.round(etaHours * 60)

  // Determine status
  let status: 'on-time' | 'delayed' | 'arriving' = 'on-time'
  if (etaMinutes <= 1) {
    status = 'arriving'
  } else if (shuttle.speed_kmh < 8) {
    status = 'delayed'
  }

  return {
    shuttle_id: shuttle.id,
    route_id: route.id,
    route_code: route.code,
    route_name: route.name,
    route_type: route.type,
    stop_id: stop.id,
    stop_name: stop.name,
    eta_minutes: Math.max(1, etaMinutes),
    distance_km: Math.round(distanceKm * 100) / 100,
    shuttle_speed: shuttle.speed_kmh,
    status,
  }
}

/**
 * Calculate ETAs from all shuttles to all stops they serve
 * Returns a flat list sorted by ETA ascending
 */
export function calculateAllETAs(
  shuttles: Shuttle[],
  stops: Stop[],
  routes: Route[]
): ETAInfo[] {
  const etas: ETAInfo[] = []

  for (const shuttle of shuttles) {
    if (shuttle.status !== 'active') continue

    const route = routes.find((r) => r.id === shuttle.route_id)
    if (!route) continue

    for (const stop of stops) {
      const eta = calculateETAToStop(shuttle, stop, route)
      if (eta) {
        etas.push(eta)
      }
    }
  }

  // Sort by ETA ascending
  etas.sort((a, b) => a.eta_minutes - b.eta_minutes)

  // Deduplicate: keep only the closest shuttle per stop
  const seen = new Set<string>()
  const deduped: ETAInfo[] = []

  for (const eta of etas) {
    const key = `${eta.stop_id}-${eta.route_id}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(eta)
    }
  }

  return deduped
}
