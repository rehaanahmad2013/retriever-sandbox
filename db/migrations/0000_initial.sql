CREATE TABLE "paper_pages" (
	"id" uuid PRIMARY KEY NOT NULL,
	"paper_id" uuid NOT NULL,
	"page_number" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "papers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"abstract" text NOT NULL,
	"universal_id" text NOT NULL,
	"publication_date" timestamp with time zone NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "paper_pages" ADD CONSTRAINT "paper_pages_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "paper_pages_text_gin_idx" ON "paper_pages" USING gin (to_tsvector('english', "text"));--> statement-breakpoint
CREATE UNIQUE INDEX "paper_pages_paper_id_page_number_idx" ON "paper_pages" USING btree ("paper_id","page_number");