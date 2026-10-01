CREATE TABLE `event_zone_attendance` (
	`registration_id` text PRIMARY KEY NOT NULL,
	`tag_id` text NOT NULL,
	`verified_at` integer NOT NULL,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `nfc_tags`(`id`) ON UPDATE no action ON DELETE no action
);

--> statement-breakpoint
-- Preserve existing numbers, but require the new participation condition before re-entry.
UPDATE raffle_entries SET voided_at = COALESCE(voided_at, unixepoch() * 1000)
WHERE NOT EXISTS (SELECT 1 FROM event_zone_attendance WHERE registration_id = raffle_entries.registration_id);
--> statement-breakpoint
DELETE FROM event_rewards WHERE kind = 'ticket'
AND NOT EXISTS (SELECT 1 FROM event_zone_attendance WHERE registration_id = event_rewards.registration_id);
