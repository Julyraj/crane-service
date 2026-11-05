import { useState, type FormEvent } from "react";
import { normaliseServerUrl, setServerUrl } from "../api.ts";

/** First-launch screen of the Android/iOS app: connect to the business's CraneGo server. */
export function ServerSetup() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function connect(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const origin = normaliseServerUrl(url);
      const res = await fetch(`${origin}/api/health`).catch(() => null);
      if (!res?.ok) throw new Error("Could not reach a CraneGo server at that address");
      setServerUrl(origin);
      location.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup">
      <form onSubmit={connect} className="card stack">
        <div className="brand">
          <span className="brand__mark" aria-hidden>
            ▲
          </span>
          <span>
            <strong>CraneGo</strong>
            <small>Crane booking</small>
          </span>
        </div>
        <h1>Connect to your crane service</h1>
        <p className="muted">Enter the website address you were given, for example cranego.onrender.com</p>
        <input
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
          autoFocus
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primary btn--lg" disabled={busy}>
          {busy ? "Connecting…" : "Connect"}
        </button>
      </form>
    </div>
  );
}
