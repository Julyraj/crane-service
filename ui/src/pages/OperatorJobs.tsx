import type { Booking } from "@crane/shared";
import { useApi } from "../hooks.ts";
import { useRealtime } from "../realtime.ts";
import { BookingList } from "../components/BookingList.tsx";
import { Card, Empty, ErrorNote, Spinner } from "../components/ui.tsx";

export function OperatorJobs() {
  const { data, error, loading, reload } = useApi<Booking[]>("/bookings");
  useRealtime((event) => event === "booking" && reload());
  const active = (data ?? []).filter((b) => !["completed", "cancelled"].includes(b.status));
  const done = (data ?? []).filter((b) => ["completed", "cancelled"].includes(b.status));
  return (
    <div className="stack">
      <h1>My jobs</h1>
      <ErrorNote error={error} />
      {loading && !data ? (
        <Spinner />
      ) : (
        <>
          <Card title={`Assigned (${active.length})`}>
            {active.length ? <BookingList bookings={active} showCustomer /> : <Empty>No jobs assigned right now.</Empty>}
          </Card>
          {done.length > 0 && (
            <Card title="Completed">
              <BookingList bookings={done} showCustomer />
            </Card>
          )}
        </>
      )}
    </div>
  );
}
