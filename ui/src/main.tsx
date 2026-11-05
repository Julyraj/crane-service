import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App.tsx";
import { SessionProvider } from "./session.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Hash routing works identically on the web server, file:// (Electron) and Capacitor. */}
    <HashRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </HashRouter>
  </StrictMode>,
);

if ("serviceWorker" in navigator && location.protocol.startsWith("http") && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  });
}
