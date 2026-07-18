import { create } from 'zustand'
import { Shuttle, StopEta } from './types'

// ============================================
// Zustand Store — Mode IoT (Data dari MQTT Bridge → MySQL → API)
// Tidak ada lagi mock data atau simulator
// ============================================

export interface StopInfo {
  id: number
  name: string
  latitude: number
  longitude: number
}

interface TransitStore {
  shuttles: Shuttle[]
  stopEtas: StopEta[]
  stops: StopInfo[]
  lastUpdate: number

  // Halte yang sedang difokuskan di panel ETA. Diisi otomatis dari halte
  // terdekat (geolocation), atau dipilih manual oleh user lewat peta/picker.
  selectedStopId: number | null
  // true kalau user memilih sendiri — supaya auto-pilih-terdekat tidak
  // menimpa pilihan manualnya saat posisi GPS bergeser.
  stopPickedManually: boolean

  // Bus yang sedang dipilih (klik marker bus). Kalau terisi, panel bawah
  // beralih ke MODE BUS: daftar semua halte yang dilewati bus itu + ETA-nya.
  // null = mode halte (default).
  selectedShuttleId: string | null

  tick: () => void
  selectStop: (stopId: number, manual?: boolean) => void
  selectShuttle: (shuttleId: string) => void
  clearShuttle: () => void
}

export const useTransitStore = create<TransitStore>((set) => ({
  shuttles: [],
  stopEtas: [],
  stops: [],
  lastUpdate: 0,
  selectedStopId: null,
  stopPickedManually: false,
  selectedShuttleId: null,

  tick: async () => {
    // Hanya fetch data terbaru dari MySQL via API.
    // Data lokasi diisi oleh MQTT Bridge (ESP32) atau Dummy Bus Simulator;
    // ETA dihitung on-read oleh /api/live, dikelompokkan per halte.
    try {
      const res = await fetch('/api/live')
      const data = await res.json()

      if (data.shuttles) {
        set({
          shuttles: data.shuttles,
          stopEtas: data.stopEtas || [],
          stops: data.stops || [],
          lastUpdate: Date.now(),
        })
      }
    } catch (error) {
      console.error('Gagal fetch data live:', error)
    }
  },

  selectStop: (stopId, manual = true) =>
    set((state) => ({
      selectedStopId: stopId,
      stopPickedManually: manual || state.stopPickedManually,
      // Memilih halte mengembalikan panel ke mode halte.
      selectedShuttleId: manual ? null : state.selectedShuttleId,
    })),

  selectShuttle: (shuttleId) => set({ selectedShuttleId: shuttleId }),
  clearShuttle: () => set({ selectedShuttleId: null }),
}))
