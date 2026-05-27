import { useQuery } from "@tanstack/react-query";
import { Download, Package, Printer, ShoppingCart } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  ReseptBadge,
  SearchBar,
  SectionHeader,
  StatusPill,
} from "../components";
import {
  downloadCsv,
  fmtDate,
  fmtInt,
  inventoryTotalUnits,
  nextExpiry,
  printPage,
  reseptOrder,
  unitLabel,
} from "../helpers";
import type { InventoryItem } from "../types";

const useSynonymPref = () => {
  const [showSynonym, setShowSynonym] = useState(false);
  return { showSynonym, setShowSynonym };
};

export default function InventoryPage() {
  const navigate = useNavigate();
  const inv = useQuery({
    queryKey: ["inventory"],
    queryFn: api.inventory.list,
  });
  const [q, setQ] = useState("");
  const { showSynonym, setShowSynonym } = useSynonymPref();

  const items = useMemo(() => {
    const base = [...(inv.data ?? [])].sort((a, b) => {
      const r = reseptOrder(a.reseptgruppe) - reseptOrder(b.reseptgruppe);
      return r !== 0 ? r : a.medicineName.localeCompare(b.medicineName, "nb");
    });
    if (!q.trim()) return base;
    const term = q.toLowerCase();
    return base.filter(
      (i) =>
        i.medicineName.toLowerCase().includes(term) ||
        i.medicineAtc.toLowerCase().includes(term) ||
        i.navnFormStyrke.toLowerCase().includes(term),
    );
  }, [inv.data, q]);

  const exportCsv = () => {
    const rows = items.map((i) => ({
      "Medisin": i.medicineName,
      "Form/Styrke": i.nameFormStrength,
      "Resept-gruppe": i.reseptgruppe ?? "",
      "På lager": inventoryTotalUnits(i),
      "Enhet": unitLabel(i, inventoryTotalUnits(i)),
      "Lav-terskel": i.lowStockThreshold,
      "Ønsket beholdning": i.desiredStock ?? "",
      "Nærmeste utløpsdato": fmtDate(nextExpiry(i)),
      "Sist oppdatert": fmtDate(i.lastUpdated),
    }));
    downloadCsv(`lager-${new Date().toISOString().slice(0, 10)}`, rows);
  };

  return (
    <>
      <PageHeader
        title="Lager"
        subtitle="Beholdning, terskler og utløpsdato for hver enkelt medisin"
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              iconLeft={ShoppingCart}
              onClick={() => navigate("/order-list")}
            >
              Bestillingsliste
            </Button>
            <Button
              variant="outline"
              iconLeft={Download}
              onClick={exportCsv}
            >
              Eksporter CSV
            </Button>
            <Button
              variant="outline"
              iconLeft={Printer}
              onClick={() => printPage("Lagerbeholdning · Ventral VaktApotek")}
            >
              Skriv ut
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder="Søk på medisin, ATC eller form…"
            className="flex-1 min-w-[260px]"
          />
          <label className="inline-flex items-center gap-2 text-caption text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showSynonym}
              onChange={(e) => setShowSynonym(e.target.checked)}
              className="w-4 h-4 rounded border-border accent-primary"
            />
            Vis synonymnavn
          </label>
        </div>
      </Card>

      <SectionHeader
        title={`${items.length} medisiner`}
        subtitle="Sortert: A-, B-, C-, CF- og K-preparater"
      />

      <DataTable<InventoryItem>
        rows={items}
        rowKey={(r) => r.id}
        onRowClick={(r) => navigate(`/inventory/${r.id}`)}
        columns={[
          {
            key: "name",
            header: "Medisin",
            sortValue: (r) => r.medicineName,
            render: (r) => (
              <div className="flex items-center gap-2 min-w-0">
                <ReseptBadge group={r.reseptgruppe} />
                <div className="min-w-0">
                  <div className="text-bodyMedium text-text truncate">
                    {r.medicineName}
                  </div>
                  <div className="text-caption text-muted truncate">
                    {showSynonym
                      ? r.medicineAtc || r.navnFormStyrke
                      : r.nameFormStrength
                          .replace(new RegExp(`^${r.medicineName}\\s*`, "i"), "")
                          .replace(/^./, (c) => c.toUpperCase())}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: "stock",
            header: "På lager",
            align: "right",
            sortValue: (r) => inventoryTotalUnits(r),
            render: (r) => {
              const total = inventoryTotalUnits(r);
              return (
                <span className="font-semibold tabular-nums">
                  {fmtInt(total)}{" "}
                  <span className="text-muted text-caption font-normal">
                    {unitLabel(r, total)}
                  </span>
                </span>
              );
            },
          },
          {
            key: "threshold",
            header: "Terskel",
            align: "right",
            sortValue: (r) => r.lowStockThreshold,
            render: (r) => fmtInt(r.lowStockThreshold),
          },
          {
            key: "expires",
            header: "Nærmeste utløp",
            sortValue: (r) => nextExpiry(r) ?? "",
            render: (r) => fmtDate(nextExpiry(r)),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => {
              const total = inventoryTotalUnits(r);
              if (total === 0) return <StatusPill tone="danger">Tomt</StatusPill>;
              if (total <= r.lowStockThreshold)
                return <StatusPill tone="warning">Lav</StatusPill>;
              return <StatusPill tone="success">OK</StatusPill>;
            },
          },
        ]}
      />
    </>
  );
}
