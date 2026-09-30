PRAGMA defer_foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_event_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`kind` text NOT NULL,
	`issued_at` integer NOT NULL,
	`redeemed_at` integer,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_rewards_valid_kind" CHECK("__new_event_rewards"."kind" IN ('gift', 'gift3', 'ticket'))
);
--> statement-breakpoint
INSERT INTO `__new_event_rewards`("id", "registration_id", "kind", "issued_at", "redeemed_at") SELECT "id", "registration_id", "kind", "issued_at", "redeemed_at" FROM `event_rewards`;--> statement-breakpoint
DROP TABLE `event_rewards`;--> statement-breakpoint
ALTER TABLE `__new_event_rewards` RENAME TO `event_rewards`;--> statement-breakpoint
CREATE UNIQUE INDEX `event_rewards_participant_kind` ON `event_rewards` (`registration_id`,`kind`);
--> statement-breakpoint
-- Grant the new tier to existing eligible attendees without changing earlier receipts.
INSERT INTO event_rewards (id, registration_id, kind, issued_at)
SELECT 'gift3-' || registration_id, registration_id, 'gift3', MAX(verified_at)
FROM attendance GROUP BY registration_id HAVING COUNT(*) >= 3
ON CONFLICT(registration_id, kind) DO NOTHING;
--> statement-breakpoint
PRAGMA defer_foreign_keys=OFF;
