import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { Role } from "@crane/shared";
import { Layout } from "./components/Layout.tsx";
import { Spinner } from "./components/ui.tsx";
import { needsServerSetup } from "./api.ts";
import { ServerSetup } from "./pages/ServerSetup.tsx";
import { useSession } from "./session.tsx";
import { Home } from "./pages/Home.tsx";
import { Login } from "./pages/Login.tsx";
import { Book } from "./pages/Book.tsx";
import { MyBookings } from "./pages/MyBookings.tsx";
import { BookingDetail } from "./pages/BookingDetail.tsx";
import { Invoice } from "./pages/Invoice.tsx";
import { OperatorJobs } from "./pages/OperatorJobs.tsx";
import { Account } from "./pages/Account.tsx";
import { AdminDashboard } from "./pages/admin/Dashboard.tsx";
import { AdminFleet } from "./pages/admin/Fleet.tsx";
import { AdminTeam } from "./pages/admin/Team.tsx";
import { AdminPricing } from "./pages/admin/Pricing.tsx";

function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useSession();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function HomeRoute() {
  const { user } = useSession();
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
  if (user?.role === "operator") return <Navigate to="/operator" replace />;
  return <Home />;
}

export function App() {
  if (needsServerSetup()) return <ServerSetup />;
  return (
    <Routes>
      <Route path="/bookings/:id/invoice" element={<RequireAuth><Invoice /></RequireAuth>} />
      <Route element={<Layout />}>
        <Route index element={<HomeRoute />} />
        <Route path="login" element={<Login />} />
        <Route path="book" element={<Book />} />
        <Route path="bookings" element={<RequireAuth><MyBookings /></RequireAuth>} />
        <Route path="bookings/:id" element={<RequireAuth><BookingDetail /></RequireAuth>} />
        <Route path="operator" element={<RequireAuth roles={["operator"]}><OperatorJobs /></RequireAuth>} />
        <Route path="account" element={<RequireAuth><Account /></RequireAuth>} />
        <Route path="admin" element={<RequireAuth roles={["admin"]}><AdminDashboard /></RequireAuth>} />
        <Route path="admin/fleet" element={<RequireAuth roles={["admin"]}><AdminFleet /></RequireAuth>} />
        <Route path="admin/team" element={<RequireAuth roles={["admin"]}><AdminTeam /></RequireAuth>} />
        <Route path="admin/pricing" element={<RequireAuth roles={["admin"]}><AdminPricing /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
