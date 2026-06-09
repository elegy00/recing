import { serve } from "@hono/node-server";
import app from "./app.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Web API running at http://localhost:${info.port}`);
});
