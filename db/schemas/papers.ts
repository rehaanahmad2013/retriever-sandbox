import { pgTable, text, integer, index, uniqueIndex, timestamp } from "drizzle-orm/pg-core";
import { id } from "../../lib/db-types";
import type { PaperId, PaperPageId } from "../../lib/id";
import { sql } from "drizzle-orm";

export const papers = pgTable("papers", {
  id: id<PaperId>().primaryKey(),
  title: text().notNull(),
  abstract: text().notNull(),
  universalId: text().notNull(),
  publicationDate: timestamp({ withTimezone: true }).notNull(),
  votes: integer().notNull().default(0)
}, (table) => ({
  universalIdUnique: uniqueIndex("papers_universal_id_idx").on(table.universalId)
}));

export const paperPages = pgTable("paper_pages", {
  id: id<PaperPageId>().primaryKey(),
  paperId: id<PaperId>().notNull().references(() => papers.id, { onDelete: "cascade" }),
  pageNumber: integer().notNull(),
  text: text().notNull()
}, (table) => ({
  textGinIndex: index("paper_pages_text_gin_idx").using("gin", sql`to_tsvector('english', ${table.text})`),
  paperPageUnique: uniqueIndex("paper_pages_paper_id_page_number_idx").on(table.paperId, table.pageNumber)
}));