-- TiDB. Periksa kelima kolom untuk NULL sebelum menjalankan perubahan ini.
ALTER TABLE `buses`
  MODIFY COLUMN `status` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'active',
  MODIFY COLUMN `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE `trips`
  MODIFY COLUMN `status` VARCHAR(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'scheduled';

ALTER TABLE `routes`
  MODIFY COLUMN `created_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE `bus_locations`
  MODIFY COLUMN `recorded_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP;
