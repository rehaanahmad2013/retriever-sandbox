import type { BRAND } from "zod";

export type PaperId = Id<"papers">;
export type PaperPageId = Id<"paper_pages">;

export type UuidString = `${string}-${string}-7${string}-${string}-${string}`;
export type Id<For extends string> = UuidString & BRAND<`${For}.id`>;
export type Slug<For extends string> = string & BRAND<`${For}.slug`>;
