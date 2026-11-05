// Runs the API server (tsx watch) and the Vite dev server together.
import { spawn } from "node:child_process";

const procs = [
  spawn("pnpm", ["--filter", "@crane/server", "dev"], { stdio: "inherit" }),
  spawn("pnpm", ["--filter", "@crane/ui", "dev"], { stdio: "inherit" }),
];
const stop = () => procs.forEach((p) => p.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", (code) => code && stop()));
