import "dotenv/config";
import express from "express";
import cors from "cors";
import { waitForDB, runMigrations } from "./db";
import { waitForRPC } from "./blockchain";
import { startIndexer } from "./indexer";
import { startRelayer } from "./relayer";
import routes from "./routes";

const app = express();
const PORT = process.env.API_PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/", routes);

async function main() {
  console.log("[App] Starting ZK Rollup Backend...");

  // Wait for dependencies
  await waitForDB();
  await runMigrations();
  await waitForRPC();

  // Start background services
  await startIndexer();
  startRelayer();

  app.listen(PORT, () => {
    console.log(`[App] Server running on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("[App] Fatal startup error:", err);
  process.exit(1);
});
