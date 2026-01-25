import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import * as helloController from "./controllers/hello.controller";

export const app = new OpenAPIHono();

app.use("*", cors({ origin: "*", credentials: true }));

app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.info(`${c.req.method} ${c.req.path} ${c.res.status} ${duration}ms`);
});

app.onError((err, c) => {
  console.error("Error:", err);
  const status = ("status" in err && typeof err.status === "number" ? err.status : 500) as 500;
  return c.json({ message: err.message || "Internal Server Error" }, status);
});

app.get("/health", (c) => c.json({ status: "ok" }));

const apiRoutes = new OpenAPIHono();
apiRoutes.openapi(helloController.route, helloController.handler);

app.route("/api", apiRoutes);
