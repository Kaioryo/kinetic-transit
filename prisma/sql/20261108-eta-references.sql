-- TiDB. Selesaikan referensi lama yang terputus sebelum memasang foreign key.
ALTER TABLE `eta_logs` ADD INDEX `idx_eta_logs_stop` (`stop_id`);
ALTER TABLE `trips` ADD INDEX `idx_trips_next_target_stop` (`next_target_stop_id`);

ALTER TABLE `eta_logs` ADD CONSTRAINT `fk_eta_logs_trip` FOREIGN KEY (`trip_id`)
  REFERENCES `trips` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE `eta_logs` ADD CONSTRAINT `fk_eta_logs_stop` FOREIGN KEY (`stop_id`)
  REFERENCES `stops` (`id`) ON DELETE RESTRICT ON UPDATE NO ACTION;

ALTER TABLE `trips` ADD CONSTRAINT `fk_trips_next_target_stop` FOREIGN KEY (`next_target_stop_id`)
  REFERENCES `stops` (`id`) ON DELETE SET NULL ON UPDATE NO ACTION;
