import { serve } from "@hono/node-server";
import { app } from "./app";

const port = parseInt(process.env.PORT || "3000", 10);

serve({ fetch: app.fetch, port });

console.info(`Server running on http://localhost:${port}`);
