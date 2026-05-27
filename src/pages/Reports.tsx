import { useQuery } from "@tanstack/react-query";
import { eachDayOfInterval, format, parseISO, startOfDay } from "date-fns";
import { nb } from "date-fns/locale";
import { Download, FileText, Printer } from "lucide-react";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { api } from "../api";
import {
  Button,
  Card,
  EmptyState,
  Loader,
  PageHeader,
  RangePicker,
  ReseptBadge,
  SectionHeader,
  StatCard,
  VentralLogo,
} from "../components";
import { downloadCsv, fmtInt, printPage, rangeLabel } from "../helpers";
import { useApp } from "../store";
import { modePalette } from "../theme";

export default function ReportsPage() {
  const range = useApp((s) => s.range);
  const themeMode = useApp((s) => s.themeMode);
  const session = useApp((s) => s.session);
  const palette = modePalette(themeMode);

  const dispensings = useQuery({
    queryKey: ["dispensings", range.from, range.to],
    queryFn: () => api.dispensings.list(range.from, range.to),
  });
  const waste = useQuery({
    queryKey: ["waste", range.from, range.to],
    queryFn: () => api.waste.list(range.from, range.to),
  });

  const daily = useMemo(() => {
    if (!dispensings.data) return [];
    const days = eachDayOfInterval({
      start: parseISO(range.from),
      end: parseISO(range.to),
    });
    const byDay = new Map<string, number>();
    for (const d of dispensings.data) {
      const k = startOfDay(parseISO(d.dispensedAt)).toISOString();
      byDay.set(k, (byDay.get(k) ?? 0) + 1);
    }
    return days.map((d) => ({
      label: format(d, "dd.MM", { locale: nb }),
      uttak: byDay.get(startOfDay(d).toISOString()) ?? 0,
    }));
  }, [dispensings.data, range]);

  const totalsByGroup = useMemo(() => {
    const m: Record<string, { count: number; units: number }> = {};
    (dispensings.data ?? []).forEach((d) => {
      const k = d.reseptgruppe ?? "—";
      if (!m[k]) m[k] = { count: 0, units: 0 };
      m[k].count += 1;
      m[k].units += d.amount;
    });
    return m;
  }, [dispensings.data]);

  const exportPharmacyReport = () => {
    const rows = (dispensings.data ?? []).map((d) => ({
      Dato: d.dispensedAt,
      Medisin: d.medicineName,
      Form: d.form,
      Styrke: d.strength,
      Gruppe: d.reseptgruppe ?? "",
      Mengde: d.amount,
      Enhet: d.amountUnit,
      Pasient: d.patientInitials ?? "",
      "Fødselsdato": d.dob ?? "",
      "Signer 1": d.signer1Id,
      "Sign 1 metode": d.signer1Method,
      "Signer 2": d.signer2Id ?? "",
      "Sign 2 metode": d.signer2Method ?? "",
      Telleavvik: d.countDiscrepancy ? "Ja" : "Nei",
      Reversert: d.reversedAt ? "Ja" : "Nei",
    }));
    downloadCsv(
      `farmasoyt-rapport-${range.from.slice(0, 10)}_${range.to.slice(0, 10)}`,
      rows,
    );
  };

  if (dispensings.isLoading || waste.isLoading)
    return <Loader label="Genererer rapport…" />;

  return (
    <>
      <PageHeader
        title="Rapporter"
        subtitle="Eksport, statistikk og farmasøyt-rapport for valgt periode"
        action={
          <div className="flex gap-2 no-print">
            <RangePicker />
            <Button
              variant="outline"
              iconLeft={Download}
              onClick={exportPharmacyReport}
            >
              Farmasøyt-rapport
            </Button>
            <Button
              iconLeft={Printer}
              onClick={() => printPage("Rapport · Ventral VaktApotek")}
            >
              Skriv ut
            </Button>
          </div>
        }
      />

      {/* Print-header */}
      <div className="print-only mb-6">
        <div className="flex items-center justify-between border-b border-text/30 pb-3">
          <VentralLogo size={36} />
          <div className="text-right">
            <div className="font-semibold">{session?.tenant?.name}</div>
            <div className="text-caption">{rangeLabel(range)}</div>
            <div className="text-caption">
              Generert {format(new Date(), "dd.MM.yyyy HH:mm")}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Antall uttak"
          value={fmtInt((dispensings.data ?? []).length)}
          icon={FileText}
          tone="primary"
        />
        <StatCard
          label="Svinn-hendelser"
          value={fmtInt((waste.data ?? []).length)}
          icon={FileText}
          tone="warning"
        />
        <StatCard
          label="Telleavvik"
          value={fmtInt(
            (dispensings.data ?? []).filter((d) => d.countDiscrepancy).length,
          )}
          icon={FileText}
          tone="danger"
        />
      </div>

      <Card className="mb-6">
        <SectionHeader title="Uttak pr. dag" />
        {daily.length === 0 ? (
          <EmptyState title="Ingen data i perioden" />
        ) : (
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={daily}>
                <defs>
                  <linearGradient id="ar" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor={palette.primary}
                      stopOpacity={0.45}
                    />
                    <stop
                      offset="100%"
                      stopColor={palette.primary}
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={palette.border} strokeDasharray="3 3" />
                <XAxis dataKey="label" stroke={palette.muted} fontSize={12} />
                <YAxis stroke={palette.muted} fontSize={12} />
                <RTooltip
                  contentStyle={{
                    backgroundColor: palette.elevated,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 8,
                    color: palette.text,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="uttak"
                  stroke={palette.primary}
                  strokeWidth={2}
                  fill="url(#ar)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader title="Fordeling pr. resept-gruppe" />
        {Object.keys(totalsByGroup).length === 0 ? (
          <EmptyState title="Ingen data" />
        ) : (
          <table className="min-w-full text-body">
            <thead className="border-b border-border text-muted">
              <tr>
                <th className="text-left py-2">Gruppe</th>
                <th className="text-right py-2">Antall uttak</th>
                <th className="text-right py-2">Sum enheter</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(totalsByGroup).map(([g, v]) => (
                <tr key={g} className="border-b border-divider">
                  <td className="py-2">
                    {g !== "—" ? <ReseptBadge group={g as any} /> : g}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {fmtInt(v.count)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {fmtInt(Math.round(v.units))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
