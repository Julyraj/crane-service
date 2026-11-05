import path from "node:path";
import { loadConfig } from "./config.ts";
import { openDb } from "./db.ts";
import { createApp } from "./app.ts";

const config = loadConfig();
const db = openDb(path.join(config.dataDir, "crane.db"));
const { app } = createApp({ db, config });

const server = app.listen(config.port, () => {
  console.log(`CraneGo server listening on http://localhost:${config.port} (${config.production ? "production" : "development"})`);
  if (config.devOtp) console.log("DEV_OTP is on: OTP codes are returned in API responses. Never enable this in production.");
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
