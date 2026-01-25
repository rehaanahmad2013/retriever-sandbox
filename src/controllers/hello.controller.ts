import { createRoute, z } from "@hono/zod-openapi";
import type { RouteHandler } from "@hono/zod-openapi";

const route = createRoute({
  method: "get",
  path: "/hello",
  summary: "Say hello",
  description: "Returns a greeting message",
  request: {
    query: z.object({
      name: z.string().optional().openapi({ example: "World" }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
            timestamp: z.string(),
          }),
        },
      },
      description: "Successful response",
    },
  },
});

const handler: RouteHandler<typeof route> = (c) => {
  const { name } = c.req.valid("query");
  
  return c.json({
    message: `Hello, ${name || "World"}!`,
    timestamp: new Date().toISOString(),
  }, 200);
};

export { handler, route };
