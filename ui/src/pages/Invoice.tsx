import { Link, useParams } from "react-router-dom";
import { formatDateTime, formatINR, getCraneClass, type Booking } from "@crane/shared";
import { useApi } from "../hooks.ts";
import { useSession } from "../session.tsx";
import { ErrorNote, Spinner } from "../components/ui.tsx";

/** Printable tax invoice. Intra-state (Tamil Nadu) split: CGST + SGST. */
export function Invoice() {
  const { id } = useParams();
  const { catalog } = useSession();
  const { data: b, error } = useApi<Booking>(`/bookings/${id}`);
  if (error) return <ErrorNote error={error} />;
  if (!b || !catalog) return <Spinner />;

  const gstRate = catalog.pricing.gstRate;
  const bill = b.finalQuote ?? b.quote;
  let lines: { label: string; amount: number }[];
  if (b.status === "cancelled") {
    lines = [{ label: "Cancellation charge (crane dispatched)", amount: Math.round(b.amountDue / (1 + gstRate)) }];
  } else if (b.overrideTotal != null) {
    lines = [{ label: `${getCraneClass(b.craneClassId)?.name} hire as agreed${b.finalQuote ? " (incl. overtime)" : ""}`, amount: Math.round(b.amountDue / (1 + gstRate)) }];
  } else {
    lines = bill.lines;
  }
  const taxable = lines.reduce((s, l) => s + l.amount, 0);
  const gst = b.amountDue - taxable;
  const half = Math.round(gst / 2);

  return (
    <div className="invoice">
      <div className="invoice__actions no-print">
        <Link to={`/bookings/${b.id}`} className="btn btn--ghost">
          ← Back
        </Link>
        <button className="btn btn--primary" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>
      <header className="invoice__head">
        <div>
          <h1>{catalog.business.name}</h1>
          <p>{catalog.business.address}</p>
          <p>Phone: +91 {catalog.business.phone}</p>
          {catalog.business.gstin && <p>GSTIN: {catalog.business.gstin}</p>}
        </div>
        <div className="invoice__meta">
          <h2>TAX INVOICE</h2>
          <p>Invoice no: {b.code}</p>
          <p>Date: {formatDateTime(b.updatedAt)}</p>
          <p>SAC: {catalog.business.sac}</p>
        </div>
      </header>
      <section className="invoice__to">
        <h3>Bill to</h3>
        <p>
          {b.customerName ?? b.contactName} · +91 {b.customerPhone}
        </p>
        <p>Site: {b.siteAddress}</p>
        <p>
          Job: {formatDateTime(b.scheduledAt)} · {b.craneName ?? getCraneClass(b.craneClassId)?.name} {b.craneRegNo ? `(${b.craneRegNo})` : ""}
        </p>
      </section>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th className="num">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.label}>
              <td>{l.label}</td>
              <td className="num">{formatINR(l.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Taxable value</td>
            <td className="num">{formatINR(taxable)}</td>
          </tr>
          <tr>
            <td>CGST {(gstRate * 50).toFixed(1)}%</td>
            <td className="num">{formatINR(half)}</td>
          </tr>
          <tr>
            <td>SGST {(gstRate * 50).toFixed(1)}%</td>
            <td className="num">{formatINR(gst - half)}</td>
          </tr>
          <tr className="total">
            <td>Total</td>
            <td className="num">{formatINR(b.amountDue)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="muted">
        Payment status: {b.paymentStatus.replace("_", " ")}
        {b.paymentReference && ` · Ref ${b.paymentReference}`}
      </p>
      <p className="fineprint">
        Verify the SAC code and tax split with your accountant. For customers outside Tamil Nadu, IGST applies instead of CGST + SGST.
      </p>
    </div>
  );
}
