CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`units` integer DEFAULT 6 NOT NULL,
	`semesters` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_code_unique` ON `courses` (`code`);--> statement-breakpoint
CREATE TABLE `plan_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`courseId` integer NOT NULL,
	`year` integer NOT NULL,
	`semester` text NOT NULL,
	`source` text NOT NULL,
	`overflow` integer DEFAULT false NOT NULL,
	`overflowReason` text,
	FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plan_entries_courseId_unique` ON `plan_entries` (`courseId`);--> statement-breakpoint
CREATE TABLE `plan_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`semester` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `prereq_group_options` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`groupId` integer NOT NULL,
	`optionCourseId` integer NOT NULL,
	FOREIGN KEY (`groupId`) REFERENCES `prereq_groups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`optionCourseId`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prereq_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`courseId` integer NOT NULL,
	FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
