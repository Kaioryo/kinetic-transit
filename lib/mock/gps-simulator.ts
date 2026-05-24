import { Shuttle, GPSPosition } from '../types'
import { MOCK_ROUTES } from './routes'
import {
  haversineDistance,
  interpolatePosition,
  calculateBearing,
} from '../geo-utils'

// ============================================
// GPS Simulator — Simulates shuttle movement
// along predefined waypoints
// ============================================

interface SimulatedShuttle {
  shuttle: Shuttle
  routeIndex: number // index in MOCK_ROUTES
  waypointIndex: number // current waypoint
  progress: number // 0-1 between current and next waypoint
  direction: 1 | -1 // 1 = forward, -1 = reverse (loop back)
  baseSpeed: number // km/h
}

const SHUTTLE_CONFIGS = [
  { id: 'shuttle_001', routeId: 'JTN-01', startWaypoint: 0, speed: 22 },
  { id: 'shuttle_002', routeId: 'JTN-01', startWaypoint: 7, speed: 18 },
  { id: 'shuttle_003', routeId: 'JTN-02', startWaypoint: 2, speed: 20 },
]

let simulatedShuttles: SimulatedShuttle[] = []
let isInitialized = false

function initializeShuttles(): void {
  simulatedShuttles = SHUTTLE_CONFIGS.map((config) => {
    const routeIdx = MOCK_ROUTES.findIndex((r) => r.id === config.routeId)
    const route = MOCK_ROUTES[routeIdx]
    const wp = route.waypoints[config.startWaypoint]

    return {
      shuttle: {
        id: config.id,
        route_id: config.routeId,
        route_name: route.name,
        route_code: route.code,
        latitude: wp.lat,
        longitude: wp.lng,
        speed_kmh: config.speed + (Math.random() * 6 - 3),
        heading: 0,
        timestamp: Date.now(),
        status: 'active' as const,
      },
      routeIndex: routeIdx,
      waypointIndex: config.startWaypoint,
      progress: 0,
      direction: 1 as const,
      baseSpeed: config.speed,
    }
  })
  isInitialized = true
}

/**
 * Advance simulation by one tick (call every 3 seconds)
 * Returns updated shuttle positions
 */
export function tickSimulation(): Shuttle[] {
  if (!isInitialized) {
    initializeShuttles()
  }

  return simulatedShuttles.map((sim) => {
    const route = MOCK_ROUTES[sim.routeIndex]
    const waypoints = route.waypoints
    const totalWaypoints = waypoints.length

    // Calculate movement per tick based on speed
    // At ~20 km/h and waypoints ~100m apart, we move through waypoints progressively
    const speedVariation = (Math.random() * 4 - 2)
    const currentSpeed = Math.max(5, sim.baseSpeed + speedVariation)

    // Progress increment: simulate ~3 seconds of movement
    // Distance per tick = speed * time = (km/h) * (3/3600 h) = speed * 0.000833 km
    const distPerTick = currentSpeed * 0.000833

    // Distance between current and next waypoint
    const nextIdx = sim.waypointIndex + sim.direction
    if (nextIdx < 0 || nextIdx >= totalWaypoints) {
      // Reverse direction at route ends
      sim.direction = (sim.direction * -1) as 1 | -1
      sim.progress = 0
    }

    const safeNextIdx = Math.max(0, Math.min(totalWaypoints - 1, sim.waypointIndex + sim.direction))
    const current = waypoints[sim.waypointIndex]
    const next = waypoints[safeNextIdx]
    const segmentDist = haversineDistance(current.lat, current.lng, next.lat, next.lng)

    if (segmentDist > 0) {
      sim.progress += distPerTick / segmentDist
    } else {
      sim.progress = 1
    }

    // Move to next waypoint if progress exceeds 1
    if (sim.progress >= 1) {
      sim.waypointIndex = safeNextIdx
      sim.progress = 0

      // Check if at the end, reverse
      const checkNext = sim.waypointIndex + sim.direction
      if (checkNext < 0 || checkNext >= totalWaypoints) {
        sim.direction = (sim.direction * -1) as 1 | -1
      }
    }

    // Interpolate position
    const interpNext = Math.max(0, Math.min(totalWaypoints - 1, sim.waypointIndex + sim.direction))
    const pos = interpolatePosition(
      waypoints[sim.waypointIndex],
      waypoints[interpNext],
      Math.min(sim.progress, 1)
    )

    // Calculate bearing
    const bearing = calculateBearing(
      waypoints[sim.waypointIndex],
      waypoints[interpNext]
    )

    // Update shuttle data
    sim.shuttle = {
      ...sim.shuttle,
      latitude: pos.lat,
      longitude: pos.lng,
      speed_kmh: Math.round(currentSpeed * 10) / 10,
      heading: Math.round(bearing),
      timestamp: Date.now(),
    }

    return { ...sim.shuttle }
  })
}

/**
 * Get current shuttle positions without advancing simulation
 */
export function getCurrentPositions(): Shuttle[] {
  if (!isInitialized) {
    initializeShuttles()
  }
  return simulatedShuttles.map((sim) => ({ ...sim.shuttle }))
}
