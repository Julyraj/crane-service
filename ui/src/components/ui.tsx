import type { ReactNode } from "react";
import { STATUS_LABELS, type BookingStatus } from "@crane/shared";

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <span className={`badge badge--${status}`}>{STATUS_LABELS[status]}</span>;
}

export function Card({ title, children, actions, className = "" }: { title?: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card__head">
          {title && <h2>{title}</h2>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {hint && <span className="field__hint">{hint}</span>}
    </label>
  );
}

export function ErrorNote({ error }: { error: string | null | undefined }) {
  if (!error) return null;
  return (
    <p className="error" role="alert">
      {error}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Spinner() {
  return <div className="spinner" aria-label="Loading" />;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {sub && <span className="stat__sub">{sub}</span>}
    </div>
  );
}
