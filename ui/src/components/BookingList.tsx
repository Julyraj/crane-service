import { Link } from "react-router-dom";
import { formatDateTime, formatINR, getCraneClass, type Booking } from "@crane/shared";
import { StatusBadge } from "./ui.tsx";

export function BookingList({ bookings, showCustomer = false }: { bookings: Booking[]; showCustomer?: boolean }) {
  return (
    <ul className="booking-list">
      {bookings.map((b) => (
        <li key={b.id}>
          <Link to={`/bookings/${b.id}`} className="booking-row">
            <div>
              <div className="booking-row__top">
                <strong>{getCraneClass(b.craneClassId)?.name}</strong>
                <StatusBadge status={b.status} />
              </div>
              <div className="muted">
                {b.code} · {formatDateTime(b.scheduledAt)}
                {showCustomer && ` · ${b.customerName ?? b.customerPhone}`}
              </div>
              <div className="muted ellipsis">{b.siteAddress}</div>
            </div>
            <div className="booking-row__amt">{formatINR(b.amountDue)}</div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
