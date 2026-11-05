import { useEffect, useRef } from "react";
import { getApiBase, getToken } from "./api.ts";

type Handler = (event: string, data: unknown) => void;
const handlers = new Set<Handler>();
let controller: AbortController | null = null;
let retry = 0;

async function connect() {
  const token = getToken();
  if (!token || controller) return;
  controller = new AbortController();
  try {
    const res = await fetch(`${getApiBase()}/api/events`, {
      headers: { authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    if (!res.ok || !res.body) throw new Error(`events ${res.status}`);
    retry = 0;
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let event = "message";
        let data = "";
        for (const line of chunk.split("\n")) {
          if (line.startsWith("event: ")) event = line.slice(7);
          else if (line.startsWith("data: ")) data += line.slice(6);
        }
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          handlers.forEach((h) => h(event, parsed));
        } catch {
          /* ignore malformed */
        }
      }
    }
  } catch {
    /* network drop or abort */
  } finally {
    const aborted = controller?.signal.aborted;
    controller = null;
    if (!aborted && handlers.size > 0 && getToken()) {
      retry = Math.min(retry + 1, 6);
      setTimeout(connect, 1000 * 2 ** retry);
    }
  }
}

export function disconnectRealtime() {
  controller?.abort();
  controller = null;
}

/** Subscribe to server-sent booking/location events while the component is mounted. */
export function useRealtime(handler: Handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const h: Handler = (e, d) => ref.current(e, d);
    handlers.add(h);
    void connect();
    return () => {
      handlers.delete(h);
      if (handlers.size === 0) disconnectRealtime();
    };
  }, []);
}
