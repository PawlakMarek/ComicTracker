import "dotenv/config";
import { buildApp } from "./app";
import { env } from "./config";
import { startJobWorker } from "./services/jobWorker";

const start = async () => {
  try {
    const app = await buildApp();
    startJobWorker(app);
    const parsedPort = Number(env.API_PORT);
    const port = Number.isNaN(parsedPort) ? 3001 : parsedPort;
    const address = await app.listen({ port, host: "0.0.0.0" });
    console.log(`API listening on ${address}`);
  } catch (error) {
    console.error("API failed to start:", error);
    process.exit(1);
  }
};

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

start();
