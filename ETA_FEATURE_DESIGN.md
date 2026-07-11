# Desain Fitur ETA (Estimated Time of Arrival)

Status: **Opsi A & B selesai. Opsi C fase 1 (log akurasi ETA) selesai.** Geometri jalur OSRM masih belum 100% sesuai jalur odong-odong asli (lihat "Isu Diketahui") — perbaikannya ditunda, dipandu data akurasi. Peta jalur resmi Unpad sudah diterima sebagai acuan bila nanti perlu digambar manual.

## Status Implementasi (Opsi C fase 1 — Log Akurasi ETA — selesai)

Infrastruktur untuk **mengukur akurasi ETA** (prediksi vs kedatangan aktual) — bahan bab evaluasi/hasil skripsi.

- **Tabel baru `eta_logs`** ([prisma/schema.prisma](prisma/schema.prisma)): `trip_id`, `stop_id`, `predicted_at`, `predicted_arrival`, `actual_arrival`, `error_seconds` (+ = telat, − = lebih cepat).
- **[lib/eta-engine.mjs](lib/eta-engine.mjs)** (BARU): sumber tunggal perhitungan jarak & ETA (Haversine, along-polyline, along-stops fallback, `computeEtas`). Dipakai bersama oleh `/api/live` (TS) **dan** logger (node) — menghilangkan duplikasi algoritma. `**/*.mjs` di `lib/` ditambahkan ke `tsconfig` agar TS bisa impor.
- **[lib/eta-logger.mjs](lib/eta-logger.mjs)** (BARU): deteksi kedatangan (bus < 80m dari halte target) + catat pasangan prediksi/aktual. Satu pasang per halte per putaran.
- **Wiring ingestion:** dipanggil dari [scripts/mqtt-bridge.mjs](scripts/mqtt-bridge.mjs) (dengan cache rute) & [scripts/dummy-bus.mjs](scripts/dummy-bus.mjs) setiap lokasi baru masuk.
- **[app/api/eta-accuracy/route.ts](app/api/eta-accuracy/route.ts)** (BARU): `GET /api/eta-accuracy` → ringkasan (mean error, mean abs error, % dalam 60s/120s) + baris terbaru.

**Terverifikasi end-to-end** (dummy bus): bus tiba di Halte FK (A02), prediksi 08:07:24 vs aktual 08:06:51 → **error −33 detik**, terekam otomatis; endpoint akurasi mengembalikan ringkasan yang benar.

**Fase C berikutnya (belum dikerjakan):** kecepatan adaptif (rata-rata beberapa ping, agar ETA tidak lompat saat bus berhenti sebentar) & penanda status halte terlewati di UI. Rekomendasi: kumpulkan dulu data `eta_logs` dari beberapa putaran untuk melihat apakah error besar → baru putuskan perlu-tidaknya kecepatan adaptif / perbaikan geometri.


## Isu Diketahui: Jalur OSRM Tidak Sesuai Jalur Odong-Odong Asli

**Gejala (dikonfirmasi user):** dummy bus tetap di dalam kampus dan berjalan di jalan yang valid (bukan menembus gedung atau keluar kampus), tapi **bentuk rutenya beda dari jalur odong-odong yang sebenarnya** — kemungkinan OSRM memilih cabang jalan yang berbeda saat ada lebih dari satu jalan valid antar dua halte.

**Diagnosis data** (dicek manual, lihat commit ini): tidak ada lompatan jarak aneh (segmen terpanjang 84-159m, wajar), bounding box polyline hampir identik dengan bounding box halte, snap halte→polyline 33-61m (wajar). Jadi **bukan bug kalkulasi** — datanya "valid" secara geometris, hanya salah pilih jalan di titik-titik yang ambigu.

**Akar masalah:** OSRM (`driving` profile) mengoptimalkan rute *tercepat/terpendek* di jaringan jalan OSM, bukan "jalur yang secara operasional dipakai odong-odong". Di kampus dengan banyak jalan internal, keduanya bisa berbeda — OSRM tidak (dan tidak bisa) tahu jalur operasional spesifik tanpa diberi tahu.

**Opsi perbaikan:**

| | Ganti profil (foot/walking) | Tambah via-point paksa | Gambar manual penuh |
|---|---|---|---|
| Cara kerja | Pakai endpoint OSRM lain yang mendukung profil pejalan kaki (mis. `routing.openstreetmap.de/routed-foot`) — kemungkinan lebih cocok kalau odong-odong lewat jalur servis/pejalan kaki | Untuk segmen yang salah pilih cabang, sisipkan 1-2 titik paksa di jalan yang benar sebagai "via point" tambahan ke OSRM, supaya rute dipaksa lewat sana | Klik titik demi titik di peta admin mengikuti jalur odong-odong asli, replace `routes.waypoints` sepenuhnya |
| Effort | Kecil — ganti URL & fetch ulang, lihat hasilnya | Sedang — perlu identifikasi titik-titik ambigu di peta lalu suntik ke script fetch | Besar — effort UI baru (mode gambar di admin) + waktu klik untuk 3 rute × puluhan halte |
| Keandalan | Tidak pasti — masalahnya ambiguitas jalan, bukan jenis profil | Andal untuk segmen yang diperbaiki, tapi reaktif (perlu ditemukan satu-satu) | Paling andal — jalur 100% sesuai yang diinginkan, tidak bergantung data OSM |
| Ketergantungan eksternal | Ya (server demo lain) | Ya (OSRM) | Tidak |

**Sudah dicoba: profil foot/walking — hasilnya lebih buruk, direvert.**

Dites via `routing.openstreetmap.de/routed-foot` (profil pejalan kaki). Hasilnya:

| Metrik | Driving (semula) | Foot (dicoba) |
|---|---|---|
| Snap terburuk halte→polyline | 33-61m | **397-414m** |
| Bounding box | ~sama dengan bbox halte | melebar jauh keluar bbox halte |

Snap 400m+ artinya jalur pejalan kaki hasil OSM di area kampus ini **tidak lewat dekat beberapa halte sama sekali** — data OSM untuk jalur internal/pedestrian kampus ini tidak lengkap. Sudah **direvert kembali ke profil `driving`** (snap 33-61m, jauh lebih baik secara kuantitatif), meski bentuknya masih belum 100% sama dengan jalur odong-odong asli.

**Kesimpulan:** kedua profil otomatis (driving & foot) terbatas oleh kelengkapan data jalan OSM di kampus ini — tidak ada "profil ajaib" yang akan menebak jalur operasional spesifik odong-odong. Satu-satunya cara yang andal adalah **gambar manual** jalur di peta admin.

**Keputusan (user, 11 Juli 2026): perbaikan geometri ditunda tanpa batas waktu, dianggap non-issue untuk produksi.**

Alasannya: posisi bus di peta berasal dari GPS asli pada mikrokontroler (ESP32) yang terpasang di bus fisik — otomatis mengikuti jalan yang benar-benar dilalui, terlepas dari bentuk `routes.waypoints` yang tersimpan. Masalah "bentuk jalur salah" yang dibahas di atas hanya terjadi pada **dummy bus simulator** (yang memang menyusuri `routes.waypoints` untuk pergerakannya), bukan pada alur produksi dengan bus asli.

Nuansa yang tetap dicatat (bukan diblokir, hanya diketahui): kalkulasi ETA di `/api/live` tetap men-snap posisi bus (baik asli maupun dummy) ke titik polyline terdekat, lalu mengukur jarak *sepanjang polyline* ke halte — bukan jarak jalan fisik yang sebenarnya dilalui bus. Karena itu, meskipun posisi bus akurat, hasil ETA masih bisa punya bias kecil kalau bentuk polyline berbeda dari jalan asli. Ini **tidak diperbaiki proaktif** — dipantau lewat data yang sudah dibangun: `GET /api/eta-accuracy` (mean/abs error, % dalam 60s/120s). Kalau data lapangan nanti menunjukkan error sistematis besar, baru dipertimbangkan ulang (pakai peta jalur resmi Unpad yang sudah diterima sebagai acuan gambar manual).

**Prioritas (diperbarui):** Opsi C tidak lagi menunggu perbaikan geometri — fase 1 (log akurasi) sudah dikerjakan dan berjalan di atas geometri saat ini. Perbaikan geometri hanya akan dikerjakan reaktif, jika data `eta_logs` menunjukkan itu memang penyebab error besar.

## Status Implementasi (Opsi B — selesai)

ETA kini dihitung **sepanjang polyline jalan asli**, bukan garis lurus lagi.

- **Kolom baru `routes.waypoints` (Json)** di [prisma/schema.prisma](prisma/schema.prisma), di-push via `prisma db push`.
- **[scripts/fetch-route-waypoints.mjs](scripts/fetch-route-waypoints.mjs)** (`npm run fetch-waypoints`) — script sekali jalan: ambil urutan halte tiap rute → OSRM → simpan polyline jalan asli ke `routes.waypoints`. Loop ditutup (halte pertama ditambah di akhir). Hasil aktual: Jalur A 344 titik, B 208, C 368; semua di dalam bounding box kampus.
- **[app/api/live/route.ts](app/api/live/route.ts):** jarak ke tiap halte kini diukur sepanjang polyline (snap posisi bus & halte ke titik polyline terdekat, jumlahkan jarak antar-segmen, tangani melingkar). **Fallback otomatis** ke metode Opsi A (garis lurus antar halte × 1.3) bila `waypoints` kosong/null — jadi tidak crash kalau OSRM belum ditarik untuk suatu rute.
- **[scripts/dummy-bus.mjs](scripts/dummy-bus.mjs):** bus dummy kini bergerak menyusuri polyline jalan (fallback ke halte bila waypoint belum ada). Terverifikasi bergerak `[waypoints]` di sepanjang 344 titik.

Temuan menarik dari validasi: rasio jarak jalan-asli vs garis-lurus per rute = **A 1.88×, B 1.09×, C 1.90×** — membuktikan `ROAD_FACTOR` hardcode 1.3 (Opsi A) memang tidak akurat per rute. Inilah nilai tambah Opsi B.

Catatan: OSRM yang dipakai adalah **demo server publik** (`router.project-osrm.org`) — cukup untuk skripsi (dipanggil sekali per rute), bukan untuk beban produksi. Kalau rute/halte berubah, jalankan ulang `npm run fetch-waypoints`.



## Status Implementasi (Opsi A — selesai)

Perubahan yang sudah dikerjakan:

- **ETA kini dihitung on-read di [app/api/live/route.ts](app/api/live/route.ts)**, bukan lagi disimpan ke tabel `etas`. Ini menghilangkan bug "ETA basi" (dulu saat bus berhenti mengirim GPS, ETA tersimpan tetap menghitung mundur ke 0 dan menampilkan "arriving" selamanya).
- **Jarak mengikuti urutan halte** (akumulatif sepanjang `route_stops` yang terurut, melingkar), bukan garis lurus ke tiap halte. Halte yang baru dilewati otomatis "jauh" satu putaran — jadi tidak perlu di-hide manual.
- **`distance_km` & `shuttle_speed` sekarang terisi nyata** (dulu hardcode 0).
- **Bug diperbaiki:** `eta.route_id === 'JTN-01'` di [ETACard.tsx](components/eta/ETACard.tsx) → `route_type === 'Main Line'`; `getRouteColor('JTN-01')` di [BusMarker.tsx](components/map/BusMarker.tsx) → route_id numerik; tipe `Shuttle`/`ETAInfo` di [lib/types.ts](lib/types.ts) disamakan dengan output API.
- **Bus dummy untuk uji tanpa ESP32:** [scripts/dummy-bus.mjs](scripts/dummy-bus.mjs) (`npm run dummy-bus`) menggerakkan bus di sepanjang halte asli & menulis ke `bus_locations` — persis alur MQTT.
- **Cleanup:** dihapus `lib/mock/`, `lib/eta-calculator.ts`, `app/api/simulate/route.ts` (semua dead code); loop upsert ETA di `mqtt-bridge.mjs` dihapus (redundant); state mati (`mode`/`isSeeded`/`seedDatabase`/`isLive`) dibuang dari `page.tsx` & `store.ts`.

Catatan: tabel `etas` di schema kini tidak lagi ditulis/dibaca (ETA on-read). Dibiarkan ada di DB agar tidak menyentuh struktur DB yang belum dikelola Prisma Migrate; bisa di-drop nanti kalau mau.

## Rencana Eksekusi Opsi B (disepakati, siap dikerjakan)

Keputusan yang sudah diambil:
- **Sumber waypoint: OSRM otomatis.** Panggil `router.project-osrm.org` sekali per rute (bukan per-request), kirim urutan koordinat halte, ambil polyline yang mengikuti jalan asli.
- **Dummy bus ikut diupdate** supaya bergerak sepanjang waypoint jalan, bukan garis lurus antar halte.

Langkah kerja:

1. **Skema:** tambah kolom `waypoints Json?` di model `routes` ([prisma/schema.prisma](prisma/schema.prisma)), push via `prisma db push` (DB ini belum dikelola Prisma Migrate, jadi `db push` konsisten dengan cara kerja sekarang).
2. **One-time fetch script** (`scripts/fetch-route-waypoints.mjs`): untuk tiap rute, ambil `route_stops` terurut → panggil OSRM `GET /route/v1/driving/{lng,lat;lng,lat;...}?geometries=geojson&overview=full` → simpan array `{lat,lng}` hasil geometry ke kolom `routes.waypoints`. Dijalankan manual sekali (`node --env-file=.env scripts/fetch-route-waypoints.mjs`), bukan bagian dari runtime app.
3. **`/api/live`:** ganti kalkulasi jarak dari akumulasi antar-halte (Opsi A) menjadi:
   - snap posisi bus ke waypoint terdekat (`findClosestWaypointIndex`)
   - snap tiap halte ke waypoint terdekat
   - jarak = `distanceAlongWaypoints` dari titik snap bus ke titik snap halte, dengan penanganan melingkar yang sama seperti Opsi A (kalau halte "di belakang", tambah jarak muter satu putaran polyline)
   - fallback ke perhitungan Opsi A (garis lurus antar-halte) kalau `routes.waypoints` kosong/null — supaya tidak crash kalau OSRM gagal ditarik untuk suatu rute.
4. **`scripts/dummy-bus.mjs`:** ganti sumber pergerakan dari `route_stops` (garis lurus antar halte) menjadi `routes.waypoints` (mengikuti jalan), dengan fallback ke perilaku lama kalau waypoint belum ada.
5. **Verifikasi:** jalankan fetch script, cek visual bus dummy di peta (harus menyusuri jalan, bukan motong lurus), cek `/api/live` menunjukkan jarak yang masuk akal dibanding versi Opsi A.

Catatan risiko yang perlu diketahui:
- `router.project-osrm.org` adalah **demo server publik**, bukan untuk beban produksi — untuk kebutuhan skripsi (dipanggil sekali per rute, 3 kali total) ini wajar, tapi kalau nanti mau deploy serius sebaiknya self-host OSRM atau pakai layanan berbayar.
- Kualitas hasil bergantung kelengkapan data OpenStreetMap di area kampus Jatinangor — akan dicek manual setelah fetch (bandingkan polyline dengan peta, pastikan tidak ada segmen yang salah jalan).

---

_Draft diskusi asli di bawah ini (untuk arsip):_

## 1. Temuan Penting: ETA Sebenarnya Sudah Ada (Versi Dasar)

Sebelum mendesain dari nol, perlu dicatat bahwa sebagian infrastruktur ETA **sudah terpasang** di codebase ini, hanya implementasinya masih sangat sederhana:

- Tabel `etas` sudah ada di [prisma/schema.prisma](prisma/schema.prisma) (`trip_id`, `stop_id`, `estimated_arrival`, `calculated_at`).
- [scripts/mqtt-bridge.mjs](scripts/mqtt-bridge.mjs#L97-L154) menghitung ulang ETA ke **setiap halte di rute** setiap kali ada GPS ping masuk, lalu `upsert` ke tabel `etas`.
- [app/api/live/route.ts](app/api/live/route.ts#L76-L101) membaca tabel `etas`, menghitung sisa menit (`estimated_arrival - now`), lalu mengirim ke client.
- [components/eta/ETACardList.tsx](components/eta/ETACardList.tsx) dan [ETACard.tsx](components/eta/ETACard.tsx) sudah menampilkan daftar ETA ini di halaman utama.

Jadi pertanyaannya bukan "bikin ETA dari nol", tapi **"ETA versi sekarang itu kasar (naive), perlu diperbaiki sejauh mana?"**

## 2. Cara Kerja ETA Saat Ini

```
ESP32 → MQTT → mqtt-bridge.mjs
                  └─ untuk setiap halte di rute trip aktif:
                       distance = haversine(bus, halte) × 1.3   ← faktor jalan, hardcoded
                       eta_menit = distance / max(speed, 5) × 60
                       upsert ke tabel etas
                                  ↓
              /api/live → hitung "estimated_arrival - now"
                                  ↓
                    ETACardList (UI, polling tiap 3 detik)
```

## 3. Masalah pada Implementasi Sekarang

| # | Masalah | Detail |
|---|---|---|
| 1 | **Jarak garis lurus (as-the-crow-flies)** | Haversine tidak mengikuti jalan asli kampus — dikalikan faktor `1.3` yang ditebak, bukan dihitung dari rute nyata. |
| 2 | **Tidak tahu halte mana yang sudah dilewati** | ETA dihitung ke *semua* halte di rute, termasuk yang sudah dilewati bus. Halte yang sudah lewat akan tetap dapat ETA (jadi salah/membingungkan). |
| 3 | **`distance_km` & `shuttle_speed` selalu 0** | Di [app/api/live/route.ts:93-94](app/api/live/route.ts#L93-L94), field ini hardcode `0`, padahal tipe `ETAInfo` di [lib/types.ts](lib/types.ts) sudah menyediakan field tersebut. |
| 4 | **Ada dua sistem kalkulasi ETA yang tidak sinkron** | [lib/eta-calculator.ts](lib/eta-calculator.ts) + [lib/geo-utils.ts](lib/geo-utils.ts) berisi logic ETA berbasis *waypoints* (lebih canggih, mendukung distance-along-route), tapi **tidak pernah dipanggil** di alur aktif manapun. Logic yang jalan adalah versi haversine sederhana di `mqtt-bridge.mjs`. |
| 5 | **Bug kecil di UI** | [ETACard.tsx:12](components/eta/ETACard.tsx#L12) membandingkan `eta.route_id === 'JTN-01'` (string), padahal `route_id` sekarang berupa number dari DB (`trip.routes.id`) — kondisi ini tidak pernah `true`, jadi styling "primary route" tidak pernah aktif. Sisa dari skema data lama. |
| 6 | **Tidak ada data geometri jalan** | Model `routes` di schema hanya punya `name` & `description`, tidak ada polyline/waypoint. `route_stops` cuma punya urutan halte (`stop_order`), bukan bentuk jalan di antaranya. |
| 7 | **Tidak ada riwayat akurasi ETA** | Tidak ada cara untuk tahu seberapa akurat prediksi ETA dibanding kedatangan aktual — penting kalau ini dibahas di laporan skripsi. |

## 4. Opsi Perbaikan

### Opsi A — Minimal (perbaiki yang sudah ada, tanpa infrastruktur baru)
- Isi `distance_km` & `shuttle_speed` yang sekarang hardcode 0.
- Filter halte yang sudah dilewati bus dari hasil ETA (pakai `stop_order` + posisi bus saat ini relatif ke urutan halte).
- Pindahkan logic kalkulasi haversine dari `mqtt-bridge.mjs` ke satu fungsi shared (`lib/eta-calculator.ts` versi disederhanakan) supaya tidak duplikat & gampang diuji.
- Perbaiki bug `route_id === 'JTN-01'`.
- **Effort:** kecil (1 sesi). **Akurasi:** masih kasar (garis lurus), tapi sudah lebih jujur & konsisten.

### Opsi B — Moderate (rute mengikuti jalan asli)
- Tambah data **waypoints/polyline** per rute (bisa digambar manual di peta admin, atau ditarik sekali dari OSRM/OpenRouteService lalu disimpan sebagai JSON di kolom baru `routes.waypoints`).
- Geometri inti (`distanceAlongWaypoints`, `findClosestWaypointIndex`, `interpolatePosition`) masih tersedia di [lib/geo-utils.ts](lib/geo-utils.ts) — tinggal disambungkan ke data waypoint asli di dalam `/api/live`. (Catatan: `lib/eta-calculator.ts` yang lama sudah dihapus saat cleanup Opsi A karena terkopel ke tipe fiktif; logic-nya tipis dan mudah ditulis ulang di atas `geo-utils`.)
- ETA dihitung berdasarkan jarak **sepanjang rute**, bukan garis lurus → jauh lebih akurat untuk jalur kampus yang berbelok.
- **Effort:** sedang (perlu UI/alat untuk input waypoint di halaman admin, atau one-time script pakai OSRM). **Akurasi:** jauh lebih baik.

### Opsi C — Advanced (B + kualitas produksi)
- Semua dari Opsi B, ditambah:
  - Deteksi halte yang sudah "dikunjungi" (jarak < threshold, mis. 30–50m) untuk auto-update status trip.
  - Faktor kecepatan **adaptif** (rata-rata kecepatan beberapa ping terakhir, bukan kecepatan instan) supaya ETA tidak lompat-lompat saat bus berhenti sebentar.
  - Tabel/log akurasi ETA (`eta_actual_vs_predicted`) untuk evaluasi — bisa jadi bahan analisis di laporan skripsi.
- **Effort:** besar. **Akurasi:** terbaik, tapi paling banyak kerja & paling banyak permukaan untuk bug.

## 5. Rekomendasi

Untuk konteks **Tugas Akhir** dengan rute kampus yang relatif pendek dan jumlah halte terbatas (38 halte, 3 rute), saya merekomendasikan **Opsi A dulu**, lalu **Opsi B** sebagai iterasi berikutnya kalau waktu memungkinkan:

- Opsi A memperbaiki bug nyata & membuat data yang sudah ditampilkan (distance, speed) jadi benar — dampaknya langsung kelihatan di UI.
- Opsi B adalah peningkatan akurasi yang paling "terlihat" untuk demo/sidang (ETA mengikuti jalan, bukan garis lurus menembus gedung), dan modul intinya (`eta-calculator.ts`) **sudah ditulis**, tinggal disambungkan + isi data waypoint.
- Opsi C baru relevan kalau dibutuhkan analisis akurasi kuantitatif di laporan.

## 6. Hal yang Perlu Didiskusikan

1. Mau mulai dari Opsi A, langsung ke B, atau gabungan keduanya sekaligus?
2. Untuk Opsi B: waypoint per rute mau digambar manual lewat halaman admin (klik-klik di peta, simpel tapi manual), atau ditarik otomatis dari OSRM/OpenRouteService (butuh API call sekali, lebih presisi tapi tambah dependency)?
3. Apakah "halte yang sudah dilewati" perlu disembunyikan dari ETA list, atau cukup ditandai (mis. dim/abu-abu) supaya histori tetap kelihatan?
