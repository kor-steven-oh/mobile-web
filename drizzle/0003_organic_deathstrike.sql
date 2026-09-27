CREATE TABLE `gift_pin_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`window_started_at` integer NOT NULL
);
