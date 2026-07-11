// ============================================
// Kinetic Transit — TypeScript Interfaces
// ============================================

export interface GPSPosition {
  lat: number
  lng: number
}

export interface Shuttle {
  id: string
  trip_id: number
  bus_name: string
  license_plate: string
  route_id: number
  route_name: string
  route_code: string
  latitude: number
  longitude: number
  speed_kmh: number
  heading: number
  timestamp: number
  status: 'active' | 'inactive' | 'maintenance'
}

export interface Stop {
  id: string
  name: string
  latitude: number
  longitude: number
  routes: string[]
}

export interface Route {
  id: string
  name: string
  code: string
  type: 'Main Line' | 'Express' | 'Local'
  color: string
  stops: string[]
  waypoints: GPSPosition[]
}

export interface ETAInfo {
  shuttle_id: string
  route_id: number
  route_code: string
  route_name: string
  route_type: string
  stop_id: number
  stop_name: string
  eta_minutes: number
  distance_km: number
  shuttle_speed: number
  status: 'on-time' | 'delayed' | 'arriving'
}
