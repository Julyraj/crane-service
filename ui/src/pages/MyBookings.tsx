import { Link } from "react-router-dom";
import type { Booking } from "@crane/shared";
import { useApi } from "../hooks.ts";
import { useRealtime } from "../realtime.ts";
import { BookingList } from "../components/BookingList.tsx";
import { Card, Empty, ErrorNote, Spinner } from "../components/ui.tsx";

export function MyBookings() {
  const { data, error, loading, reload } = useApi<Booking[]>("/bookings?scope=mine");
  useRealtime((event) => event === "booking" && reload());
  const open = (data ?? []).filter((b) => !["completed", "cancelled"].includes(b.status));
  const past = (data ?? []).filter((b) => ["completed", "cancelled"].includes(b.status));
  return (
    <div className="stack">
      <div className="page-head">
        <h1>My bookings</h1>
        <Link to="/book" className="btn btn--primary">
          + New booking
        </Link>
      </div>
      <ErrorNote error={error} />
      {loading && !data ? (
        <Spinner />
      ) : data && data.length === 0 ? (
        <Empty>
          No bookings yet. <Link to="/book">Book your first crane →</Link>
        </Empty>
      ) : (
        <>
          {open.length > 0 && (
            <Card title="Upcoming & active">
              <BookingList bookings={open} />
            </Card>
          )}
          {past.length > 0 && (
            <Card title="History">
              <BookingList bookings={past} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
