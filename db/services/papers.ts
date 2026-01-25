import { eq } from "drizzle-orm";
import { db } from "../client";
import { papers } from "../schemas/papers";

export const getPaperByUniversalId = async (universalId: string) => {
  const [paper] = await db.select().from(papers).where(eq(papers.universalId, universalId)).limit(1);

  return paper ?? null;
};
