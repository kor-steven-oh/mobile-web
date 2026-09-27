CREATE TABLE `raffle_entries` (
	`number` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`registration_id` text NOT NULL,
	`issued_at` integer NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `raffle_entries_registration_id_unique` ON `raffle_entries` (`registration_id`);