import { Route } from '../types'

// ============================================
// Mock Route Data — Rute Shuttle Jatinangor
// Waypoints mengikuti jalan utama kampus
// ============================================

export const MOCK_ROUTES: Route[] = [
  {
    id: 'JTN-01',
    name: 'Rektorat - GKU',
    code: 'R1',
    type: 'Main Line',
    color: '#006945',
    stops: ['stop_001', 'stop_002', 'stop_003', 'stop_004', 'stop_005'],
    waypoints: [
      { lat: -6.9271, lng: 107.7712 }, // Halte Rektorat
      { lat: -6.9269, lng: 107.7718 },
      { lat: -6.9267, lng: 107.7725 },
      { lat: -6.9265, lng: 107.7735 }, // Halte Kandaga
      { lat: -6.9262, lng: 107.7742 },
      { lat: -6.9258, lng: 107.7750 },
      { lat: -6.9255, lng: 107.7760 }, // Halte FEB
      { lat: -6.9250, lng: 107.7768 },
      { lat: -6.9245, lng: 107.7775 },
      { lat: -6.9240, lng: 107.7785 }, // Halte FMIPA
      { lat: -6.9235, lng: 107.7792 },
      { lat: -6.9230, lng: 107.7800 },
      { lat: -6.9225, lng: 107.7810 }, // Halte GKU
    ],
  },
  {
    id: 'JTN-02',
    name: 'Rektorat - FISIP',
    code: 'R2',
    type: 'Express',
    color: '#4c5d6e',
    stops: ['stop_001', 'stop_002', 'stop_006', 'stop_004', 'stop_007'],
    waypoints: [
      { lat: -6.9271, lng: 107.7712 }, // Halte Rektorat
      { lat: -6.9268, lng: 107.7720 },
      { lat: -6.9265, lng: 107.7735 }, // Halte Kandaga
      { lat: -6.9270, lng: 107.7738 },
      { lat: -6.9275, lng: 107.7742 },
      { lat: -6.9280, lng: 107.7745 }, // Halte FTI
      { lat: -6.9275, lng: 107.7755 },
      { lat: -6.9260, lng: 107.7770 },
      { lat: -6.9240, lng: 107.7785 }, // Halte FMIPA
      { lat: -6.9255, lng: 107.7775 },
      { lat: -6.9270, lng: 107.7768 },
      { lat: -6.9285, lng: 107.7770 },
      { lat: -6.9290, lng: 107.7770 }, // Halte FISIP
    ],
  },
]
