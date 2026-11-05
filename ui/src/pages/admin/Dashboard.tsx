import { useState } from "react";
import { formatINR, type AdminStats, type Booking } from "@crane/shared";
import { useApi } from "../../hooks.ts";
import { useRealtime } from "../../realtime.ts";
import { BookingList } from "../../components/BookingList.tsx";
import { Card, Empty, ErrorNote, Spinner, Stat } from "../../components/ui.tsx";

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "requested", label: "New requests" },
  { key: "in_progress", label: "Lifting now" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "", label: "All" },
];

export function AdminDashboard() {
  const [filter, setFilter] = useState("open");
  const stats = useApi<AdminStats>("/admin/stats");
  const list = useApi<Booking[]>(`/bookings${filter ? `?status=${filter}` : ""}`);
  useRealtime((event) => {
    if (event === "booking") {
      stats.reload();
      list.reload();
    }
  });
  const s = stats.data;
  return (
    <div className="stack">
      <h1>Dispatch dashboard</h1>
      <ErrorNote error={stats.error ?? list.error} />
      {s && (
        <div className="stats">
          <Stat label="New requests" value={s.openRequests} sub={`${s.bookingsToday} booked today`} />
          <Stat label="Active jobs" value={s.activeJobs} />
          <Stat label="Fleet available" value={`${s.fleet.available}/${s.fleet.total}`} sub={`${s.fleet.onJob} on job · ${s.fleet.maintenance} maintenance`} />
          <Stat label="Revenue (month)" value={formatINR(s.revenueThisMonth)} sub={`${s.completedThisMonth} jobs completed`} />
          <Stat label="Outstanding" value={formatINR(s.outstanding)} />
          <Stat label="Avg rating" value={s.averageRating ? `${s.averageRating} ★` : "—"} />
        </div>
      )}
      <Card
        title="Bookings"
        actions={
          <div className="chips">
            {FILTERS.map((f) => (
              <button key={f.key} className={filter === f.key ? "chip is-on" : "chip"} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        {list.loading && !list.data ? <Spinner /> : list.data?.length ? <BookingList bookings={list.data} showCustomer /> : <Empty>No bookings here.</Empty>}
      </Card>
    </div>
  );
}
