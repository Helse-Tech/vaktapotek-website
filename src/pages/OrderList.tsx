import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, Mail, Printer, ShoppingCart } from "lucide-react";
import { useMemo } from "react";

import { api } from "../api";
import {
  Button,
  Card,
  DataTable,
  EmptyState,
  Loader,
  PageHeader,
  ReseptBadge,
  SectionHeader,
  StatusPill,
  VentralLogo,
} from "../components";
import { buildOrderList, downloadCsv, fmtInt, printPage } from "../helpers";
import { useApp } from "../store";

export default function OrderListPage() {
  const inv = useQuery({
    queryKey: ["inventory"],
    queryFn: api.inventory.list,
  });
  const disp = useQuery({
    queryKey: ["dispensings_30"],
    queryFn: () => api.dispensings.list(),
  });
  const session = useApp((s) => s.session);

  const list = useMemo(
    () => buildOrderList(inv.data ?? [], disp.data ?? []),
    [inv.data, disp.data],
  );

  const exportCsv = () => {
    downloadCsv(
      `bestillingsliste-${format(new Date(), "yyyy-MM-dd")}`,
      list.map((r) => ({
        Medisin: r.medicineName,
        Gruppe: r.reseptgruppe ?? "",
        "På lager": r.currentTotal,
        Terskel: r.threshold,
        Ønsket: r.desired,
        "Foreslått bestilling": r.suggestedOrder,
        "Snitt/dag (siste 30d)": r.avgDailyUse,
        "Dager til tomt": r.daysUntilEmpty ?? "—",
        Hastegrad:
          r.urgency === "critical"
            ? "Kritisk"
            : r.urgency === "high"
              ? "Høy"
              : "Normal",
      })),
    );
  };

  const sendToPharmacy = async () => {
    // Plassholder: kobles til server-side e-post-endepunkt på prod
    const subject = encodeURIComponent(
      `Bestilling — ${session?.tenant?.name ?? "Legevakt"} — ${format(
        new Date(),
        "dd.MM.yyyy",
      )}`,
    );
    const body = encodeURIComponent(
      list
        .map(
          (r) =>
            `• ${r.medicineName} (${r.reseptgruppe ?? "—"}) — bestill ca ${r.suggestedOrder} (på lager ${r.currentTotal}, terskel ${r.threshold})`,
        )
        .join("\n"),
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  if (inv.isLoading || disp.isLoading)
    return <Loader label="Beregner bestillingsliste…" />;

  return (
    <>
      <PageHeader
        title="Bestillingsliste"
        subtitle="Smart-foreslåtte medisiner under terskel — sortert etter hastegrad"
        action={
          <div className="flex gap-2 no-print">
            <Button
              variant="outline"
              iconLeft={Mail}
              onClick={sendToPharmacy}
              disabled={list.length === 0}
            >
              Send til apotek
            </Button>
            <Button
              variant="outline"
              iconLeft={Download}
              onClick={exportCsv}
              disabled={list.length === 0}
            >
              Eksporter CSV
            </Button>
            <Button
              iconLeft={Printer}
              onClick={() => printPage("Bestillingsliste · Ventral VaktApotek")}
              disabled={list.length === 0}
            >
              Skriv ut
            </Button>
          </div>
        }
      />

      {/* Print-header */}
      <div className="print-only mb-6">
        <div className="flex items-center justify-between">
          <VentralLogo size={36} />
          <div className="text-right">
            <div className="font-semibold">{session?.tenant?.name}</div>
            <div className="text-caption">
              Bestillingsliste · {format(new Date(), "dd.MM.yyyy HH:mm")}
            </div>
          </div>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Ingen medisiner under terskel"
          subtitle="Lageret er innenfor satte terskler. Bra jobb!"
        />
      ) : (
        <>
          <Card className="mb-4 bg-warning-soft border-0">
            <div className="flex items-start gap-3">
              <ShoppingCart className="text-warning shrink-0 mt-1" />
              <div>
                <div className="text-bodyMedium text-text">
                  {list.filter((r) => r.urgency === "critical").length} kritiske ·{" "}
                  {list.filter((r) => r.urgency === "high").length} høye ·{" "}
                  {list.filter((r) => r.urgency === "normal").length} normale
                </div>
                <div className="text-caption text-muted">
                  Listen er beregnet ut fra forbruksrate de siste 30 dagene og
                  ønsket beholdning. Du kan justere terskel og ønsket-nivå pr.
                  medisin under «Lager».
                </div>
              </div>
            </div>
          </Card>

          <SectionHeader
            title={`${list.length} medisiner skal bestilles`}
            subtitle="Sortert etter hastegrad (kritisk først)"
          />

          <DataTable
            rows={list}
            rowKey={(r) => r.medicineId}
            columns={[
              {
                key: "med",
                header: "Medisin",
                sortValue: (r) => r.medicineName,
                render: (r) => (
                  <div className="flex items-center gap-2 min-w-0">
                    <ReseptBadge group={r.reseptgruppe} />
                    <span className="text-bodyMedium text-text truncate">
                      {r.medicineName}
                    </span>
                  </div>
                ),
              },
              {
                key: "current",
                header: "På lager",
                align: "right",
                sortValue: (r) => r.currentTotal,
                render: (r) => fmtInt(r.currentTotal),
              },
              {
                key: "threshold",
                header: "Terskel",
                align: "right",
                sortValue: (r) => r.threshold,
                render: (r) => fmtInt(r.threshold),
              },
              {
                key: "desired",
                header: "Ønsket",
                align: "right",
                sortValue: (r) => r.desired,
                render: (r) => fmtInt(r.desired),
              },
              {
                key: "suggested",
                header: "Bestill",
                align: "right",
                sortValue: (r) => r.suggestedOrder,
                render: (r) => (
                  <span className="font-bold text-primary tabular-nums">
                    {fmtInt(r.suggestedOrder)}
                  </span>
                ),
              },
              {
                key: "avg",
                header: "Snitt/dag",
                align: "right",
                sortValue: (r) => r.avgDailyUse,
                render: (r) => `${r.avgDailyUse}`,
              },
              {
                key: "days",
                header: "Dager til tomt",
                align: "right",
                sortValue: (r) => r.daysUntilEmpty ?? 9999,
                render: (r) =>
                  r.daysUntilEmpty === null ? "—" : `${r.daysUntilEmpty}`,
              },
              {
                key: "urgency",
                header: "Hastegrad",
                render: (r) =>
                  r.urgency === "critical" ? (
                    <StatusPill tone="danger">Kritisk</StatusPill>
                  ) : r.urgency === "high" ? (
                    <StatusPill tone="warning">Høy</StatusPill>
                  ) : (
                    <StatusPill tone="info">Normal</StatusPill>
                  ),
              },
            ]}
          />
        </>
      )}
    </>
  );
}
