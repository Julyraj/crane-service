import { formatINR, type Quote } from "@crane/shared";

export function QuoteBreakdown({ quote, overrideTotal, title = "Fare estimate" }: { quote: Quote; overrideTotal?: number | null; title?: string }) {
  return (
    <div className="quote">
      <h3>{title}</h3>
      <ul>
        {quote.lines.map((l) => (
          <li key={l.code}>
            <span>{l.label}</span>
            <span>{formatINR(l.amount)}</span>
          </li>
        ))}
        <li className="quote__sub">
          <span>Subtotal</span>
          <span>{formatINR(quote.subtotal)}</span>
        </li>
        <li className="quote__sub">
          <span>GST</span>
          <span>{formatINR(quote.gst)}</span>
        </li>
        <li className={`quote__total ${overrideTotal ? "is-struck" : ""}`}>
          <span>Total</span>
          <span>{formatINR(quote.total)}</span>
        </li>
        {overrideTotal ? (
          <li className="quote__total">
            <span>Agreed price (incl. GST)</span>
            <span>{formatINR(overrideTotal)}</span>
          </li>
        ) : null}
      </ul>
      {quote.notes.length > 0 && (
        <ul className="quote__notes">
          {quote.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
