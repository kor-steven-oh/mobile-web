DROP INDEX `registrations_phone_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_name_phone_unique` ON `registrations` (`name`,`phone`);