import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { toast } from "sonner";

import { api } from "../api";
import {
  Button,
  Card,
  Divider,
  EmptyState,
  HelpTip,
  Input,
  Loader,
  PageHeader,
  ReseptBadge,
  SectionHeader,
  StatusPill,
} from "../components";
import {
  daysUntil,
  fmtDate,
  fmtInt,
  inventoryTotalUnits,
  isExpired,
  unitLabel,
} from "../helpers";

export default function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const inv = useQuery({
    queryKey: ["inventory"],
    queryFn: api.inventory.list,
  });

  const item = useMemo(
    () => (inv.data ?? []).find((i) => i.id === id),
    [inv.data, id],
  );

  const [threshold, setThreshold] = useState("");
  const [desired, setDesired] = useState("");

  useEffect(() => {
    if (item) {
      setThreshold(String(item.lowStockThreshold));
      setDesired(item.desiredStock ? String(item.desiredStock) : "");
    }
  }, [item]);

  const saveThreshold = useMutation({
    mutationFn: () =>
      api.inventory.setThreshold(item!.id, Number(threshold) || 0),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Terskel oppdatert");
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke lagre"),
  });

  const saveDesired = useMutation({
    mutationFn: () =>
      api.inventory.setDesired(item!.id, Number(desired) || 0),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Ønsket beholdning oppdatert");
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke lagre"),
  });

  if (inv.isLoading) return <Loader label="Henter lager…" />;
  if (!item)
    return (
      <EmptyState
        title="Fant ikke medisinen"
        subtitle="Den kan være slettet eller flyttet."
      />
    );

  const total = inventoryTotalUnits(item);
  return (
    <>
      <PageHeader title={item.medicineName} back subtitle={item.nameFormStrength} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <SectionHeader
            title="Beholdning"
            action={<ReseptBadge group={item.reseptgruppe} />}
          />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card padded className="bg-primary-soft border-0">
              <div className="text-caption text-primary">På lager</div>
              <div className="text-h1 font-bold text-primary tabular-nums">
                {fmtInt(total)}
              </div>
              <div className="text-caption text-primary">
                {unitLabel(item, total)}
              </div>
            </Card>
            <Card padded className="bg-surface">
              <div className="text-caption text-muted">Uåpnede pakker</div>
              <div className="text-h2 text-text tabular-nums">
                {item.unopenedPackages}
              </div>
            </Card>
            {!item.isUnitOnly && (
              <Card padded className="bg-surface">
                <div className="text-caption text-muted">Igjen i åpnet</div>
                <div className="text-h2 text-text tabular-nums">
                  {item.openedContainerRemaining}
                </div>
              </Card>
            )}
            <Card padded className="bg-surface">
              <div className="text-caption text-muted">Lav-terskel</div>
              <div className="text-h2 text-text tabular-nums">
                {item.lowStockThreshold}
              </div>
            </Card>
          </div>

          <Divider className="my-5" />

          <h3 className="text-h3 mb-3">Batches (FEFO)</h3>
          {item.batches.length === 0 ? (
            <EmptyState
              title="Ingen batches registrert"
              subtitle="Batches legges til ved varemottak i appen."
            />
          ) : (
            <ul className="divide-y divide-divider">
              {[...item.batches]
                .sort((a, b) =>
                  a.expirationDate.localeCompare(b.expirationDate),
                )
                .map((b) => {
                  const d = daysUntil(b.expirationDate);
                  const tone = isExpired(b.expirationDate)
                    ? "danger"
                    : d !== null && d <= 30
                      ? "warning"
                      : "success";
                  return (
                    <li
                      key={b.id}
                      className="flex items-center justify-between py-3"
                    >
                      <div>
                        <div className="text-bodyMedium text-text">
                          Batch {b.batchNumber}
                        </div>
                        <div className="text-caption text-muted">
                          {fmtInt(b.quantity)} stk · mottatt{" "}
                          {fmtDate(b.receivedAt)} av #{b.receivedBy}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-caption text-muted">
                          Utløper {fmtDate(b.expirationDate)}
                        </span>
                        <StatusPill tone={tone as any}>
                          {tone === "danger"
                            ? "Utløpt"
                            : tone === "warning"
                              ? `${d}d`
                              : "OK"}
                        </StatusPill>
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-h3">Lav-terskel</h3>
              <HelpTip text="Når beholdningen synker under denne grensen, vises medisinen i Bestillingsliste og det opprettes et varsel." />
            </div>
            <Input
              label="Terskel (enheter)"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              hint={`Standard: ${item.lowStockThreshold}`}
            />
            <Button
              className="mt-3"
              iconLeft={Save}
              loading={saveThreshold.isPending}
              onClick={() => saveThreshold.mutate()}
              fullWidth
            >
              Lagre terskel
            </Button>
          </Card>

          <Card>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-h3">Ønsket beholdning</h3>
              <HelpTip text="Mål-mengden vi prøver å holde inne. Bestillingslisten foreslår innkjøp opp til dette tallet." />
            </div>
            <Input
              label="Ønsket nivå (enheter)"
              type="number"
              value={desired}
              onChange={(e) => setDesired(e.target.value)}
              hint="Tomt = systemet kalkulerer fra forbruksrate"
            />
            <Button
              className="mt-3"
              iconLeft={Save}
              loading={saveDesired.isPending}
              onClick={() => saveDesired.mutate()}
              fullWidth
            >
              Lagre ønsket
            </Button>
          </Card>

          <Card>
            <h3 className="text-h3 mb-2">Stamdata</h3>
            <dl className="text-caption text-muted space-y-1">
              <div className="flex justify-between">
                <dt>ATC</dt>
                <dd className="text-text">{item.medicineAtc || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Form</dt>
                <dd className="text-text">{item.form || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Styrke</dt>
                <dd className="text-text">{item.strength || "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Pakning</dt>
                <dd className="text-text">
                  {item.pakningsstr} {item.enhetPakning}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Telles som</dt>
                <dd className="text-text">
                  {item.isUnitOnly ? "Hele enheter" : "Antall stk."}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
