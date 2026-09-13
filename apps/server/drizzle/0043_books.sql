-- Manga and ebooks, in tables of their own rather than columns bent onto media_item. There is
-- the reasoning: a book has no duration, no codec and no streams, and the only way the scanner
-- learns anything about a media item is to hand it to FFmpeg, which reads none of these formats.
--
-- A folder is a series and each file inside it a chapter, so book holds what somebody browses and
-- book_chapter what they open. The number is a real because a chapter published as an extra is 10.5
-- rather than 11.
CREATE TABLE "book" (
  "id" text PRIMARY KEY NOT NULL,
  "libraryId" text NOT NULL REFERENCES "library"("id") ON DELETE cascade,
  "path" text NOT NULL,
  "title" text NOT NULL,
  "layout" text NOT NULL,
  "direction" text NOT NULL,
  "year" integer,
  "overview" text,
  "genres" jsonb,
  "authors" jsonb,
  "rating" real,
  "posterUrl" text,
  "externalId" text,
  "addedAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "book_layout_known" CHECK ("layout" in ('fixed', 'reflow')),
  CONSTRAINT "book_direction_known" CHECK ("direction" in ('rightToLeft', 'leftToRight'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "book_path_idx" ON "book" ("libraryId", "path");
--> statement-breakpoint
CREATE INDEX "book_library_idx" ON "book" ("libraryId");
--> statement-breakpoint
CREATE INDEX "book_title_idx" ON "book" ("title");
--> statement-breakpoint
CREATE TABLE "book_chapter" (
  "id" text PRIMARY KEY NOT NULL,
  "bookId" text NOT NULL REFERENCES "book"("id") ON DELETE cascade,
  "path" text NOT NULL,
  "number" real NOT NULL,
  "title" text NOT NULL,
  "format" text NOT NULL,
  "pageCount" integer,
  "sizeBytes" bigint NOT NULL,
  "modifiedAtMs" bigint NOT NULL,
  "addedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "book_chapter_format_known" CHECK ("format" in ('cbz', 'cbr', 'pdf', 'epub'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "book_chapter_path_idx" ON "book_chapter" ("bookId", "path");
--> statement-breakpoint
CREATE INDEX "book_chapter_order_idx" ON "book_chapter" ("bookId", "number");
--> statement-breakpoint
-- Where somebody is up to. Not watch_progress: that records seconds against a mediaItemId, and a
-- book has neither. A fixed page is a page number; a place in reflowing text is a fraction of it,
-- because how many pages that text makes is decided by the screen it is shown on.
CREATE TABLE "reading_progress" (
  "id" text PRIMARY KEY NOT NULL,
  "profileId" text NOT NULL REFERENCES "viewer_profile"("id") ON DELETE cascade,
  "bookId" text NOT NULL REFERENCES "book"("id") ON DELETE cascade,
  "chapterId" text NOT NULL REFERENCES "book_chapter"("id") ON DELETE cascade,
  "pageNumber" integer,
  "fraction" real,
  "isFinished" boolean DEFAULT false NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "reading_progress_somewhere" CHECK ("pageNumber" is not null or "fraction" is not null)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "reading_progress_profile_idx" ON "reading_progress" ("profileId", "chapterId");
--> statement-breakpoint
CREATE INDEX "reading_progress_recent_idx" ON "reading_progress" ("profileId", "updatedAt");
--> statement-breakpoint
CREATE INDEX "reading_progress_book_idx" ON "reading_progress" ("profileId", "bookId");
