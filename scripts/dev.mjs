// Runs the API server (tsx watch) and the Vite dev server together.
import { spawn } from "node:child_process";

// On Windows pnpm is a .cmd shim, which needs a shell to launch.
const opts = { stdio: "inherit", shell: process.platform === "win32" };
const procs = [
  spawn("pnpm", ["--filter", "@crane/server", "dev"], opts),
  spawn("pnpm", ["--filter", "@crane/ui", "dev"], opts),
];
const stop = () => procs.forEach((p) => p.kill("SIGTERM"));
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
procs.forEach((p) => p.on("exit", (code) => code && stop()));
