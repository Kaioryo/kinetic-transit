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
  /** true kalau bus sudah lama tidak mengirim GPS — posisinya tak bisa dipercaya
   *  dan ETA-nya tidak disertakan. */
  is_stale: boolean
  /** Detik sejak GPS terakhir masuk. null kalau belum pernah ada lokasi. */
  seconds_since_update: number | null
  /** true kalau bus tidak bergerak berkepanjangan (mogok/macet parah). Beda dari
   *  is_stale: di sini GPS-nya justru SEHAT — yang berhenti busnya, bukan sinyalnya. */
  is_stopped: boolean
  /** Sudah berapa lama bus berhenti. null kalau bus sedang jalan. */
  stopped_seconds: number | null
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

// Satu kedatangan bus ke sebuah halte (halte-nya sendiri ada di StopEta).
export interface Arrival {
  shuttle_id: string
  bus_name: string
  route_id: number
  route_code: string
  route_name: string
  route_type: string
  /** null kalau bus berhenti — sengaja tidak menebak angka ketimbang memberi
   *  janji waktu untuk bus yang tidak akan datang. */
  eta_minutes: number | null
  distance_km: number
  shuttle_speed: number
  status: 'on-time' | 'delayed' | 'arriving' | 'stopped'
  is_next: boolean
  just_passed: boolean
  /** Sudah berapa lama bus berhenti; hanya terisi saat status 'stopped'. */
  stopped_seconds: number | null
}

// Satu halte + daftar bus yang akan datang ke situ (bisa lebih dari satu
// bus/rute), diurut dari kedatangan tercepat.
export interface StopEta {
  stop_id: number
  stop_name: string
  latitude: number
  longitude: number
  arrivals: Arrival[]
}
