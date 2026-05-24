import { GPSPosition, Stop } from './types'

// ============================================
// Geo Utilities — Haversine, Bearing, Distance
// ============================================

const EARTH_RADIUS_KM = 6371

/** Convert degrees to radians */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

/**
 * Calculate the distance between two GPS coordinates using Haversine formula
 * @returns Distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return EARTH_RADIUS_KM * c
}

/**
 * Calculate bearing from point A to point B
 * @returns Bearing in degrees (0-360)
 */
export function calculateBearing(
  from: GPSPosition,
  to: GPSPosition
): number {
  const dLng = toRad(to.lng - from.lng)
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat))
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng)
  const bearing = (Math.atan2(y, x) * 180) / Math.PI
  return (bearing + 360) % 360
}

/**
 * Find the nearest stop to a given position
 */
export function findNearestStop(
  position: GPSPosition,
  stops: Stop[]
): Stop | null {
  if (stops.length === 0) return null

  let nearest = stops[0]
  let minDist = haversineDistance(
    position.lat,
    position.lng,
    nearest.latitude,
    nearest.longitude
  )

  for (let i = 1; i < stops.length; i++) {
    const dist = haversineDistance(
      position.lat,
      position.lng,
      stops[i].latitude,
      stops[i].longitude
    )
    if (dist < minDist) {
      minDist = dist
      nearest = stops[i]
    }
  }

  return nearest
}

/**
 * Calculate total distance along a series of waypoints from a given index
 */
export function distanceAlongWaypoints(
  waypoints: GPSPosition[],
  fromIndex: number
): number {
  let total = 0
  for (let i = fromIndex; i < waypoints.length - 1; i++) {
    total += haversineDistance(
      waypoints[i].lat,
      waypoints[i].lng,
      waypoints[i + 1].lat,
      waypoints[i + 1].lng
    )
  }
  return total
}

/**
 * Find the closest waypoint index to a given position
 */
export function findClosestWaypointIndex(
  position: GPSPosition,
  waypoints: GPSPosition[]
): number {
  let minDist = Infinity
  let closestIdx = 0

  for (let i = 0; i < waypoints.length; i++) {
    const dist = haversineDistance(
      position.lat,
      position.lng,
      waypoints[i].lat,
      waypoints[i].lng
    )
    if (dist < minDist) {
      minDist = dist
      closestIdx = i
    }
  }

  return closestIdx
}

/**
 * Interpolate between two GPS positions
 * @param t - interpolation factor (0 to 1)
 */
export function interpolatePosition(
  from: GPSPosition,
  to: GPSPosition,
  t: number
): GPSPosition {
  return {
    lat: from.lat + (to.lat - from.lat) * t,
    lng: from.lng + (to.lng - from.lng) * t,
  }
}
