CREATE TABLE `attendance` (
	`registration_id` text NOT NULL,
	`slot` integer NOT NULL,
	`session_id` integer NOT NULL,
	`tag_id` text NOT NULL,
	`verified_at` integer NOT NULL,
	PRIMARY KEY(`registration_id`, `slot`),
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `nfc_tags`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`,`slot`) REFERENCES `event_sessions`(`id`,`slot`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `event_rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`registration_id` text NOT NULL,
	`kind` text NOT NULL,
	`issued_at` integer NOT NULL,
	`redeemed_at` integer,
	FOREIGN KEY (`registration_id`) REFERENCES `registrations`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "event_rewards_valid_kind" CHECK("event_rewards"."kind" IN ('gift', 'ticket'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_rewards_participant_kind` ON `event_rewards` (`registration_id`,`kind`);--> statement-breakpoint
CREATE TABLE `event_sessions` (
	`id` integer PRIMARY KEY NOT NULL,
	`slot` integer NOT NULL,
	`room` text NOT NULL,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`closes_at` integer NOT NULL,
	CONSTRAINT "event_sessions_valid_slot" CHECK("event_sessions"."slot" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_sessions_id_slot` ON `event_sessions` (`id`,`slot`);--> statement-breakpoint
CREATE UNIQUE INDEX `event_sessions_room_slot` ON `event_sessions` (`room`,`slot`);--> statement-breakpoint
CREATE TABLE `nfc_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`room` text NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `nfc_tags_token_hash_unique` ON `nfc_tags` (`token_hash`);
--> statement-breakpoint
INSERT INTO event_sessions (id, slot, room, title, starts_at, closes_at) VALUES
(10101, 1, '101', '협상의 기술', 1792026000000, 1792026600000),
(10102, 2, '101', '함께 만드는 최상의 화질', 1792029600000, 1792030200000),
(10103, 3, '101', 'Xclipse의 여정과 모바일 GPU 생태계', 1792038600000, 1792039200000),
(10104, 4, '101', 'Ulysses CPU', 1792042200000, 1792042800000),
(10105, 5, '101', '익숙함이라는 한계를 넘어', 1792045800000, 1792046400000),
(10701, 1, '107', 'Exynos, 원팀으로 공정을 넘어 정상을 위한 도전', 1792026000000, 1792026600000),
(10702, 2, '107', 'AI시대, 어떻게 협업할 것인가', 1792029600000, 1792030200000),
(10703, 3, '107', 'UWB로 보는 Wireless 기술의 미래', 1792038600000, 1792039200000),
(10704, 4, '107', 'FWA도 되는 TCU', 1792042200000, 1792042800000),
(10705, 5, '107', '코드는 AI가 개발자는?', 1792045800000, 1792046400000),
(20101, 1, '201', '덜 알고 맞는것은 모르고 맞는것과 큰 차이가 없습니다', 1792026000000, 1792026600000),
(20102, 2, '201', '개발에서 논문까지 Display개발자의 기록', 1792029600000, 1792030200000),
(20103, 3, '201', 'AI가 확장하는 AR Class의 가능성', 1792038600000, 1792039200000),
(20104, 4, '201', '3세대 SoC PMIC 개발기', 1792042200000, 1792042800000),
(20105, 5, '201', '기술로 지킨 자리', 1792045800000, 1792046400000),
(20601, 1, '206', 'CIS 세계 최소 노이즈를 향한 여정', 1792026000000, 1792026600000),
(20602, 2, '206', '센서 사업의 새로운 도전', 1792029600000, 1792030200000),
(20603, 3, '206', '독일의 시스템과 유럽의 다양성', 1792038600000, 1792039200000),
(20604, 4, '206', '특허로 기술 읽기', 1792042200000, 1792042800000),
(20605, 5, '206', 'Physical AI 시대의 이미지 센서', 1792045800000, 1792046400000),
(20801, 1, '208', 'AI가 바꾼 PDK 품질관리', 1792026000000, 1792026600000),
(20802, 2, '208', '공격자의 시선으로 설계하기', 1792029600000, 1792030200000),
(20803, 3, '208', 'AI Agent로 좁힌 검증의 Gap', 1792038600000, 1792039200000),
(20804, 4, '208', '역사를 사랑한 소년, AI엔지니어가 되기까지', 1792042200000, 1792042800000),
(20805, 5, '208', 'SEVA의 여정', 1792045800000, 1792046400000);
