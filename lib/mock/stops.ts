import { Stop } from '../types'

// ============================================
// Mock Halte Data — Kampus Jatinangor Unpad
// Koordinat approximate mengikuti area kampus
// ============================================

export const MOCK_STOPS: Stop[] = [
  {
    id: 'stop_001',
    name: 'Halte Rektorat',
    latitude: -6.9271,
    longitude: 107.7712,
    routes: ['JTN-01', 'JTN-02'],
  },
  {
    id: 'stop_002',
    name: 'Halte Kandaga',
    latitude: -6.9265,
    longitude: 107.7735,
    routes: ['JTN-01', 'JTN-02'],
  },
  {
    id: 'stop_003',
    name: 'Halte FEB',
    latitude: -6.9255,
    longitude: 107.7760,
    routes: ['JTN-01'],
  },
  {
    id: 'stop_004',
    name: 'Halte FMIPA',
    latitude: -6.9240,
    longitude: 107.7785,
    routes: ['JTN-01', 'JTN-02'],
  },
  {
    id: 'stop_005',
    name: 'Halte GKU',
    latitude: -6.9225,
    longitude: 107.7810,
    routes: ['JTN-01'],
  },
  {
    id: 'stop_006',
    name: 'Halte FTI',
    latitude: -6.9280,
    longitude: 107.7745,
    routes: ['JTN-02'],
  },
  {
    id: 'stop_007',
    name: 'Halte FISIP',
    latitude: -6.9290,
    longitude: 107.7770,
    routes: ['JTN-02'],
  },
]
