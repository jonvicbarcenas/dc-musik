CREATE TABLE `blacklist` (
	`kind` text NOT NULL,
	`target_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`reason` text NOT NULL,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`kind`, `target_id`),
	CONSTRAINT "blacklist_kind_valid" CHECK("blacklist"."kind" IN ('user', 'guild')),
	CONSTRAINT "blacklist_reason_length" CHECK(length("blacklist"."reason") BETWEEN 1 AND 500),
	CONSTRAINT "blacklist_expiry_valid" CHECK("blacklist"."expires_at" IS NULL OR "blacklist"."expires_at" > "blacklist"."created_at")
);
--> statement-breakpoint
CREATE INDEX `blacklist_expiry_idx` ON `blacklist` (`expires_at`);--> statement-breakpoint
CREATE TABLE `guild_settings` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`prefix` text DEFAULT '!' NOT NULL,
	`dj_role_id` text,
	`music_channel_id` text,
	`stay_in_voice` integer DEFAULT false NOT NULL,
	`default_volume` integer DEFAULT 80 NOT NULL,
	`vote_skip_enabled` integer DEFAULT false NOT NULL,
	`vote_skip_threshold` integer DEFAULT 50 NOT NULL,
	`announce_now_playing` integer DEFAULT true NOT NULL,
	`auto_leave_timeout_seconds` integer DEFAULT 120 NOT NULL,
	`language` text DEFAULT 'en' NOT NULL,
	`clean_mode` integer DEFAULT false NOT NULL,
	`clean_after_seconds` integer DEFAULT 30 NOT NULL,
	`max_queue_size` integer DEFAULT 2000 NOT NULL,
	`max_track_length_seconds` integer DEFAULT 7200 NOT NULL,
	`autoplay_enabled` integer DEFAULT false NOT NULL,
	`sponsorblock_enabled` integer DEFAULT false NOT NULL,
	`embed_color` text DEFAULT '#5865F2' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "guild_volume_range" CHECK("guild_settings"."default_volume" BETWEEN 1 AND 200),
	CONSTRAINT "guild_vote_threshold_range" CHECK("guild_settings"."vote_skip_threshold" BETWEEN 1 AND 100),
	CONSTRAINT "guild_queue_limit_range" CHECK("guild_settings"."max_queue_size" BETWEEN 1 AND 10000),
	CONSTRAINT "guild_track_limit_range" CHECK("guild_settings"."max_track_length_seconds" BETWEEN 30 AND 86400),
	CONSTRAINT "guild_leave_timeout_range" CHECK("guild_settings"."auto_leave_timeout_seconds" BETWEEN 10 AND 86400),
	CONSTRAINT "guild_clean_timeout_range" CHECK("guild_settings"."clean_after_seconds" BETWEEN 5 AND 3600),
	CONSTRAINT "guild_language_values" CHECK("guild_settings"."language" IN ('en', 'tl')),
	CONSTRAINT "guild_prefix_length" CHECK(length("guild_settings"."prefix") BETWEEN 1 AND 10),
	CONSTRAINT "stay_in_voice_boolean" CHECK("guild_settings"."stay_in_voice" IN (0, 1)),
	CONSTRAINT "vote_skip_enabled_boolean" CHECK("guild_settings"."vote_skip_enabled" IN (0, 1)),
	CONSTRAINT "announce_now_playing_boolean" CHECK("guild_settings"."announce_now_playing" IN (0, 1)),
	CONSTRAINT "clean_mode_boolean" CHECK("guild_settings"."clean_mode" IN (0, 1)),
	CONSTRAINT "autoplay_enabled_boolean" CHECK("guild_settings"."autoplay_enabled" IN (0, 1)),
	CONSTRAINT "sponsorblock_enabled_boolean" CHECK("guild_settings"."sponsorblock_enabled" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `play_history` (
	`id` text PRIMARY KEY NOT NULL,
	`bot_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`user_id` text NOT NULL,
	`track_key` text NOT NULL,
	`track_json` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`end_reason` text,
	CONSTRAINT "history_track_json_valid" CHECK(json_valid("play_history"."track_json")),
	CONSTRAINT "history_start_time" CHECK("play_history"."started_at" >= 0),
	CONSTRAINT "history_end_state" CHECK(("play_history"."ended_at" IS NULL AND "play_history"."end_reason" IS NULL) OR ("play_history"."ended_at" IS NOT NULL AND "play_history"."end_reason" IS NOT NULL AND "play_history"."ended_at" >= "play_history"."started_at" AND "play_history"."end_reason" IN ('finished', 'skipped', 'stopped', 'error', 'replaced')))
);
--> statement-breakpoint
CREATE INDEX `history_user_order_idx` ON `play_history` (`user_id`,`started_at`,`id`);--> statement-breakpoint
CREATE INDEX `history_guild_order_idx` ON `play_history` (`guild_id`,`started_at`,`id`);--> statement-breakpoint
CREATE INDEX `history_bot_order_idx` ON `play_history` (`bot_id`,`started_at`,`id`);--> statement-breakpoint
CREATE TABLE `playlist_tracks` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`position` integer NOT NULL,
	`track_key` text NOT NULL,
	`track_json` text NOT NULL,
	`added_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "playlist_position_range" CHECK("playlist_tracks"."position" BETWEEN 0 AND 9999),
	CONSTRAINT "playlist_track_json_valid" CHECK(json_valid("playlist_tracks"."track_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlist_track_position_idx` ON `playlist_tracks` (`playlist_id`,`position`);--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`is_shared` integer DEFAULT false NOT NULL,
	`share_token` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "playlist_name_length" CHECK(length("playlists"."name") BETWEEN 1 AND 64),
	CONSTRAINT "playlist_share_state" CHECK(("playlists"."is_shared" = 0 AND "playlists"."share_token" IS NULL) OR ("playlists"."is_shared" = 1 AND "playlists"."share_token" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_owner_name_idx` ON `playlists` (`owner_id`,`name_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `playlists_share_token_idx` ON `playlists` (`share_token`);--> statement-breakpoint
CREATE INDEX `playlists_owner_order_idx` ON `playlists` (`owner_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `queue_snapshots` (
	`bot_id` text NOT NULL,
	`guild_id` text NOT NULL,
	`voice_channel_id` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`generation` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`payload` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`bot_id`, `guild_id`),
	CONSTRAINT "snapshot_payload_valid" CHECK(json_valid("queue_snapshots"."payload")),
	CONSTRAINT "snapshot_version_valid" CHECK("queue_snapshots"."version" = 1),
	CONSTRAINT "snapshot_revision_valid" CHECK("queue_snapshots"."revision" >= 1)
);
--> statement-breakpoint
CREATE INDEX `snapshots_bot_order_idx` ON `queue_snapshots` (`bot_id`,`updated_at`,`guild_id`);--> statement-breakpoint
CREATE TABLE `user_favorites` (
	`user_id` text NOT NULL,
	`track_key` text NOT NULL,
	`track_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `track_key`),
	CONSTRAINT "favorite_track_json_valid" CHECK(json_valid("user_favorites"."track_json"))
);
--> statement-breakpoint
CREATE INDEX `favorites_user_order_idx` ON `user_favorites` (`user_id`,`created_at`,`track_key`);