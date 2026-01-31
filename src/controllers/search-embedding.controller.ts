import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";
import { searchPapersByEmbedding } from "../../db/services/papers";
import { generateEmbedding } from "../utils/generate-embeddings";

const route = createRoute({
  method: "get",
  path: "/search/embedding",
  summary: "Search papers by semantic similarity",
  description: "Search for papers semantically similar to a query using embeddings",
  request: {
    query: z.object({
      query: z.string().openapi({ 
        example: "What are the latest techniques for reducing hallucinations in large language models?",
        description: "The search query to find semantically similar papers"
      }),
      limit: z.coerce.number().int().positive().optional().default(20).openapi({ 
        example: 50,
        description: "Maximum number of papers to return"
      }),
      minPublicationDate: z.iso.datetime().optional().openapi({ 
        example: new Date(Date.now() - 3 * 30 * 24 * 60 * 60 * 1000).toISOString(),
        description: "Minimum publication date (ISO 8601 string)"
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            results: z.array(z.object({
              universalId: z.string(),
              title: z.string(),
              abstract: z.string(),
              publicationDate: z.iso.datetime(),
              votes: z.number(),
              similarityDistance: z.number().openapi({
                description: "Cosine distance (lower = more similar, 0 = identical)"
              }),
            })),
            totalResults: z.number(),
          }),
        },
      },
      description: "Successful response with semantically similar papers",
    },
    400: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Bad request (e.g., failed to generate embedding)",
    },
  },
});

const handler: RouteHandler<typeof route> = async (c) => {
  const { query, limit, minPublicationDate: minPublicationDateStr } = c.req.valid("query");
  
  const minPublicationDate = minPublicationDateStr ? new Date(minPublicationDateStr) : undefined;
  
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query, {
    taskType: "RETRIEVAL_QUERY",
  });

  if (!queryEmbedding) {
    return c.json({
      error: "Failed to generate embedding for the query",
    }, 400);
  }

  // Search for similar papers
  const results = await searchPapersByEmbedding(queryEmbedding, {
    limit,
    minPublicationDate,
  });

  return c.json({
    results,
    totalResults: results.length,
  }, 200);
};

export { handler, route };
