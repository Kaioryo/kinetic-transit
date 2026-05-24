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
  isLive: boolean
  lastUpdate: number
  isSeeded: boolean
  tick: () => void
  seedDatabase: () => Promise<void>
}

export const useTransitStore = create<TransitStore>((set, get) => ({
  shuttles: [],
  etas: [],
  stops: [],
  isLive: true,
  lastUpdate: 0,
  isSeeded: false,

  tick: async () => {
    // Hanya fetch data terbaru dari MySQL via API
    // Data sudah diisi oleh MQTT Bridge dari ESP32
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

  seedDatabase: async () => {
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        set({ isSeeded: true })
        console.log('Database seeded:', data)
      }
    } catch (error) {
      console.error('Seed error:', error)
    }
  },
}))
