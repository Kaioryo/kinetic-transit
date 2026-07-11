import { create } from 'zustand'
import { Shuttle, ETAInfo } from './types'

// ============================================
// Zustand Store — Mode IoT (Data dari MQTT Bridge → MySQL → API)
// Tidak ada lagi mock data atau simulator
// ============================================

interface StopInfo {
  id: string
  name: string
  latitude: number
  longitude: number
}

interface TransitStore {
  shuttles: Shuttle[]
  etas: ETAInfo[]
  stops: StopInfo[]
  lastUpdate: number
  tick: () => void
}

export const useTransitStore = create<TransitStore>((set) => ({
  shuttles: [],
  etas: [],
  stops: [],
  lastUpdate: 0,

  tick: async () => {
    // Hanya fetch data terbaru dari MySQL via API.
    // Data lokasi diisi oleh MQTT Bridge (ESP32) atau Dummy Bus Simulator;
    // ETA dihitung on-read oleh /api/live.
    try {
      const res = await fetch('/api/live')
      const data = await res.json()

      if (data.shuttles) {
        set({
          shuttles: data.shuttles,
          etas: data.etas || [],
          stops: data.stops || [],
          lastUpdate: Date.now(),
        })
      }
    } catch (error) {
      console.error('Gagal fetch data live:', error)
    }
  },
}))
