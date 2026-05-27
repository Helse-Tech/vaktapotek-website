import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfDay, subDays } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Bell,
  ClipboardList,
  Package,
  Pill,
  TrendingUp,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "../api";
import {
  Card,
  EmptyState,
  Loader,
  PageHeader,
  RangePicker,
  ReseptBadge,
  SectionHeader,
  StatCard,
  StatusPill,
} from "../components";
import { fmtInt, fmtRelativeShort, inRange } from "../helpers";
import { useApp } from "../store";
import { modePalette } from "../theme";

export default function DashboardPage() {
  const navigate = useNavigate();
  const range = useApp((s) => s.range);
  const themeMode = useApp((s) => s.themeMode);
  const palette = modePalette(themeMode);

  const stats = useQuery({ queryKey: ["stats"], queryFn: api.stats });
  const dispensings = useQuery({
    queryKey: ["dispensings", range.from, range.to],
    queryFn: () => api.dispensings.list(range.from, range.to),
  });
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: api.alerts.list });
  const inventory = useQuery({
    queryKey: ["inventory"],
    queryFn: api.inventory.list,
  });
  const users = useQuery({ queryKey: ["users"], queryFn: api.users.list });

  // Daglig uttak siste 14 dager
  const dailyData = useMemo(() => {
    const days: { date: string; label: string; uttak: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      days.push({
        date: d.toISOString(),
        label: format(d, "dd.MM"),
        uttak: 0,
      });
    }
    (dispensings.data ?? []).forEach((d) => {
      const t = parseISO(d.dispensedAt);
      const key = startOfDay(t).toISOString();
      const day = days.find((x) => x.date === key);
      if (day) day.uttak += 1;
    });
    return days;
  }, [dispensings.data]);

  // Fordeling pr. reseptgruppe
  const reseptDist = useMemo(() => {
    const m: Record<string, number> = { A: 0, B: 0, C: 0, CF: 0, K: 0 };
    (dispensings.data ?? []).forEach((d) => {
      const g = d.reseptgruppe ?? "C";
      m[g] = (m[g] ?? 0) + 1;
    });
    return Object.entries(m)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: k, value: v }));
  }, [dispensings.data]);

  const RESEPT_COLORS = [
    palette.reseptA,
    palette.reseptB,
    palette.reseptC,
    palette.accent,
    palette.muted,
  ];

  const lastActions = useMemo(() => {
    return (dispensings.data ?? [])
      .slice()
      .sort((a, b) => b.dispensedAt.localeCompare(a.dispensedAt))
      .slice(0, 6);
  }, [dispensings.data]);

  const openAlerts = (alerts.data ?? []).filter((a) => !a.resolvedAt);
  const lowStock = (inventory.data ?? []).filter(
    (i) =>
      i.unopenedPackages * (i.isUnitOnly ? 1 : i.unitsPerPackage || 1) +
        (i.isUnitOnly ? 0 : i.openedContainerRemaining || 0) <=
      i.lowStockThreshold,
  );

  return (
    <>
      <PageHeader
        title="Oversikt"
        subtitle="Sanntidsbilde av legevaktens medisinrom"
        action={<RangePicker />}
      />

      {/* Statistikk-kort */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Uttak i perioden"
          value={fmtInt((dispensings.data ?? []).length)}
          icon={ClipboardList}
          tone="primary"
          helpText="Antall registrerte medisinuttak i valgt tidsperiode."
        />
        <StatCard
          label="Åpne varsler"
          value={fmtInt(openAlerts.length)}
          icon={Bell}
          tone={openAlerts.length > 0 ? "warning" : "success"}
          helpText="Uavklarte avvik som krever oppfølging."
        />
        <StatCard
          label="Lav beholdning"
          value={fmtInt(lowStock.length)}
          icon={Package}
          tone={lowStock.length > 0 ? "danger" : "success"}
          helpText="Varer under terskelverdi — vises i Bestillingsliste."
        />
        <StatCard
          label="Aktive ansatte"
          value={fmtInt((users.data ?? []).filter((u) => u.isActive).length)}
          icon={Users}
          tone="info"
          helpText="Ansatte med aktiv konto tilknyttet din legevakt."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Uttak siste 14 dager"
            subtitle="Antall registrerte uttak pr. dag"
          />
          {dispensings.isLoading ? (
            <Loader />
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={dailyData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={palette.border}
                  />
                  <XAxis dataKey="label" stroke={palette.muted} fontSize={12} />
                  <YAxis
                    allowDecimals={false}
                    stroke={palette.muted}
                    fontSize={12}
                  />
                  <RTooltip
                    contentStyle={{
                      backgroundColor: palette.elevated,
                      border: `1px solid ${palette.border}`,
                      borderRadius: 8,
                      color: palette.text,
                    }}
                  />
                  <Bar
                    dataKey="uttak"
                    radius={[6, 6, 0, 0]}
                    fill={palette.primary}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <SectionHeader
            title="Resept-gruppe-fordeling"
            subtitle="Uttak i perioden"
          />
          {reseptDist.length === 0 ? (
            <EmptyState
              icon={Pill}
              title="Ingen data"
              subtitle="Velg et bredere tidsvindu."
            />
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={reseptDist}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {reseptDist.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={RESEPT_COLORS[idx % RESEPT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RTooltip
                    contentStyle={{
                      backgroundColor: palette.elevated,
                      border: `1px solid ${palette.border}`,
                      borderRadius: 8,
                      color: palette.text,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <Card>
          <SectionHeader
            title="Siste aktivitet"
            subtitle="Nyeste uttak"
            action={
              <button
                onClick={() => navigate("/dispensings")}
                className="text-caption text-primary hover:underline"
              >
                Se alle →
              </button>
            }
          />
          {dispensings.isLoading ? (
            <Loader />
          ) : lastActions.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Ingen aktivitet enda"
              subtitle="Ny aktivitet vises her i sanntid."
            />
          ) : (
            <ul className="divide-y divide-divider">
              {lastActions.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 py-3"
                >
                  <div className="w-9 h-9 rounded-md bg-primary-soft text-primary flex items-center justify-center">
                    <Pill size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-bodyMedium text-text truncate">
                      {d.medicineName}
                    </div>
                    <div className="text-caption text-muted truncate">
                      {d.amount} {d.amountUnit} · #{d.signer1Id}
                      {d.patientInitials && ` · ${d.patientInitials}`}
                    </div>
                  </div>
                  <ReseptBadge group={d.reseptgruppe} />
                  <span className="text-caption text-muted">
                    {fmtRelativeShort(d.dispensedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeader
            title="Aktive varsler"
            subtitle="Avvik som ikke er løst"
            action={
              <button
                onClick={() => navigate("/alerts")}
                className="text-caption text-primary hover:underline"
              >
                Se alle →
              </button>
            }
          />
          {alerts.isLoading ? (
            <Loader />
          ) : openAlerts.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Alt under kontroll"
              subtitle="Ingen åpne varsler."
            />
          ) : (
            <ul className="divide-y divide-divider">
              {openAlerts.slice(0, 6).map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 py-3"
                >
                  <AlertTriangle size={18} className="text-warning" />
                  <div className="flex-1 min-w-0">
                    <div className="text-bodyMedium text-text truncate">
                      {a.title}
                    </div>
                    <div className="text-caption text-muted truncate">
                      {a.description}
                    </div>
                  </div>
                  <StatusPill tone={a.escalated ? "danger" : "warning"}>
                    {a.escalated ? "Eskalert" : "Åpen"}
                  </StatusPill>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
