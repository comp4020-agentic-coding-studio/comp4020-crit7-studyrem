CREATE TABLE `alt_preferences` (
	`optionsKey` text PRIMARY KEY NOT NULL,
	`preferredCourseId` integer NOT NULL,
	FOREIGN KEY (`preferredCourseId`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
