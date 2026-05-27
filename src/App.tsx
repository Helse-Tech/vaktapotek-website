import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";

import { auth } from "./api";
import {
  AppShell,
  CommandPalette,
  GlobalConfirmDialog,
  Loader,
} from "./components";
import AlertsPage from "./pages/Alerts";
import AuditLogPage from "./pages/AuditLog";
import DashboardPage from "./pages/Dashboard";
import DeliveriesPage from "./pages/Deliveries";
import DispensingsPage from "./pages/Dispensings";
import EmployeesPage from "./pages/Employees";
import InventoryPage from "./pages/Inventory";
import InventoryDetailPage from "./pages/InventoryDetail";
import LoginPage from "./pages/Login";
import NotFoundPage from "./pages/NotFound";
import OrderListPage from "./pages/OrderList";
import ReportsPage from "./pages/Reports";
import SettingsPage from "./pages/Settings";
import WastePage from "./pages/Waste";
import { useApp } from "./store";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const session = useApp((s) => s.session);
  const setSession = useApp((s) => s.setSession);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (session) return;
      if (!auth.isAuthenticated()) {
        if (location.pathname !== "/login") navigate("/login", { replace: true });
        return;
      }
      try {
        const me = await auth.me();
        if (cancelled) return;
        if (me?.tenant && me?.user) {
          setSession({
            token: "(cookie)",
            expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
            tenant: me.tenant,
            user: me.user,
          });
        } else {
          navigate("/login", { replace: true });
        }
      } catch {
        navigate("/login", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onUnauth = () => navigate("/login", { replace: true });
    window.addEventListener("vp:unauthorized", onUnauth);
    return () => window.removeEventListener("vp:unauthorized", onUnauth);
  }, [navigate]);

  return <>{children}</>;
}

function ProtectedRoutes() {
  const session = useApp((s) => s.session);
  if (!session) return <Loader label="Logger inn…" />;
  return (
    <AppShell>
      <CommandPalette />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/inventory/:id" element={<InventoryDetailPage />} />
        <Route path="/order-list" element={<OrderListPage />} />
        <Route path="/dispensings" element={<DispensingsPage />} />
        <Route path="/waste" element={<WastePage />} />
        <Route path="/deliveries" element={<DeliveriesPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/*" element={<ProtectedRoutes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthBootstrap>
      <GlobalConfirmDialog />
      <Toaster
        position="top-right"
        toastOptions={{
          className:
            "rounded-md border border-border bg-elevated text-text shadow-md",
        }}
      />
    </QueryClientProvider>
  );
}
