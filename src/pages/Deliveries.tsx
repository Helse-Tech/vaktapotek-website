import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Download,
  Edit,
  ExternalLink,
  Image as ImageIcon,
  Printer,
  Save,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { api } from "../api";
import {
  Button,
  Card,
  DataTable,
  Divider,
  Modal,
  PageHeader,
  RangePicker,
  SearchBar,
  SectionHeader,
  StatusPill,
} from "../components";
import { downloadCsv, fmtDate, fmtDateTime, fmtInt, printPage } from "../helpers";
import { useApp } from "../store";
import type { DeliveryDeviation, DeliveryItem, DeliveryReceipt } from "../types";

const DEVIATION_LABELS: Record<string, string> = {
  wrong_quantity: "Feil antall",
  wrong_product: "Feil produkt",
  damaged: "Skadet",
  missing: "Manglende",
  expired_on_arrival: "Utløpt ved ankomst",
  temperature: "Temperaturavvik",
  other: "Annet",
};

export default function DeliveriesPage() {
  const range = useApp((s) => s.range);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["deliveries", range.from, range.to],
    queryFn: () => api.deliveries.list(range.from, range.to),
  });
  const [q, setQ] = useState("");
  const [photo, setPhoto] = useState<DeliveryReceipt | null>(null);
  const [selected, setSelected] = useState<DeliveryReceipt | null>(null);
  const [editingItem, setEditingItem] = useState<
    | {
        delivery: DeliveryReceipt;
        item: DeliveryItem;
        quantity: string;
        batchNumber: string;
        expirationDate: string;
      }
    | null
  >(null);
  const [editingDeviation, setEditingDeviation] = useState<
    | {
        delivery: DeliveryReceipt;
        deviation: DeliveryDeviation;
        description: string;
        type: string;
      }
    | null
  >(null);

  // Hold "valgt" leveranse synkron med oppdaterte data fra serveren
  useEffect(() => {
    if (!selected || !list.data) return;
    const fresh = list.data.find((d) => d.id === selected.id);
    if (fresh) setSelected(fresh);
  }, [list.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const data = useMemo(() => {
    const rows = list.data ?? [];
    if (!q.trim()) return rows;
    const term = q.toLowerCase();
    return rows.filter(
      (r) =>
        r.items.some((i) => i.medicineName.toLowerCase().includes(term)) ||
        r.signedBy.includes(term) ||
        r.deviations.some((d) =>
          (d.description ?? "").toLowerCase().includes(term),
        ),
    );
  }, [list.data, q]);

  const updateItem = useMutation({
    mutationFn: () =>
      api.deliveries.updateItem(editingItem!.delivery.id, editingItem!.item.id, {
        quantity: Number(editingItem!.quantity) || 0,
        batchNumber: editingItem!.batchNumber,
        expirationDate: editingItem!.expirationDate,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Leveranse oppdatert — lageret er justert");
      setEditingItem(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke lagre"),
  });

  const updateDeviation = useMutation({
    mutationFn: () =>
      api.deliveries.updateDeviation(
        editingDeviation!.delivery.id,
        editingDeviation!.deviation.id,
        {
          description: editingDeviation!.description,
          type: editingDeviation!.type,
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      toast.success("Avvik oppdatert");
      setEditingDeviation(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke lagre"),
  });

  const exportCsv = () =>
    downloadCsv(
      `leveranser-${range.from.slice(0, 10)}_${range.to.slice(0, 10)}`,
      data.flatMap((r) =>
        r.items.map((i) => ({
          "Leveranse-ID": r.id,
          Tid: fmtDateTime(r.completedAt),
          Medisin: i.medicineName,
          Antall: i.quantity,
          Batch: i.batchNumber,
          Utløp: i.expirationDate,
          "Signert av": r.signedBy,
          "Sign 2": r.signer2Id ?? "—",
          Avvik: r.deviations.map((d) => d.description).join(" | "),
          "Pakkseddel-bilde": r.packingSlipPhotoUrl ?? "—",
        })),
      ),
    );

  return (
    <>
      <PageHeader
        title="Leveranser"
        subtitle="Alle varemottak — inkl. bilde av pakkseddel og avvik"
        action={
          <div className="flex gap-2">
            <RangePicker />
            <Button variant="outline" iconLeft={Download} onClick={exportCsv}>
              CSV
            </Button>
            <Button
              variant="outline"
              iconLeft={Printer}
              onClick={() => printPage("Leveranser · Ventral VaktApotek")}
            >
              Skriv ut
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Søk på medisin, ansattnr eller avvikstekst…"
        />
      </Card>

      <SectionHeader title={`${data.length} leveranser`} />

      <DataTable
        rows={data}
        rowKey={(r) => r.id}
        onRowClick={(r) => setSelected(r)}
        columns={[
          {
            key: "time",
            header: "Mottatt",
            sortValue: (r) => r.completedAt,
            render: (r) => (
              <span className="text-caption text-muted whitespace-nowrap">
                {fmtDateTime(r.completedAt)}
              </span>
            ),
          },
          {
            key: "items",
            header: "Linjer",
            align: "right",
            sortValue: (r) => r.items.length,
            render: (r) => fmtInt(r.items.length),
          },
          {
            key: "preview",
            header: "Medisiner",
            render: (r) => (
              <span className="text-caption text-text break-words whitespace-normal block">
                {r.items.map((i) => `${i.medicineName} (${i.quantity})`).join(", ")}
              </span>
            ),
          },
          {
            key: "deviation",
            header: "Avvik",
            render: (r) =>
              r.deviations.length > 0 ? (
                <StatusPill tone="warning">{r.deviations.length}</StatusPill>
              ) : (
                <StatusPill tone="success">Ingen</StatusPill>
              ),
          },
          {
            key: "signer",
            header: "Signert",
            render: (r) =>
              `#${r.signedBy}${r.signer2Id ? ` + #${r.signer2Id}` : ""}`,
          },
          {
            key: "photo",
            header: "Pakkseddel",
            noPrint: true,
            render: (r) =>
              r.packingSlipPhotoUrl ? (
                <Button
                  size="sm"
                  variant="outline"
                  iconLeft={ImageIcon}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPhoto(r);
                  }}
                >
                  Se bilde
                </Button>
              ) : (
                <span className="text-caption text-muted">—</span>
              ),
          },
        ]}
      />

      {/* ── Detalj-modal: alle linjer + avvik + admin-redigering ── */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Leveransedetaljer"
        description={
          selected
            ? `Mottatt ${fmtDateTime(selected.completedAt)} av #${selected.signedBy}${selected.signer2Id ? ` + #${selected.signer2Id}` : ""}`
            : ""
        }
        size="xl"
        footer={
          selected?.packingSlipPhotoUrl ? (
            <Button
              variant="outline"
              iconLeft={ImageIcon}
              onClick={() => setPhoto(selected)}
            >
              Se pakkseddel
            </Button>
          ) : null
        }
      >
        {selected && (
          <div className="space-y-5">
            <div>
              <SectionHeader
                title={`Medisiner (${selected.items.length})`}
                subtitle="Klikk «Endre» for å justere antall — lageret oppdateres automatisk"
              />
              <div className="overflow-x-auto">
                <table className="min-w-full text-body">
                  <thead className="bg-surface border-b border-border">
                    <tr>
                      <th className="px-3 py-2 text-left text-label text-muted font-semibold">
                        Medisin
                      </th>
                      <th className="px-3 py-2 text-right text-label text-muted font-semibold">
                        Antall
                      </th>
                      <th className="px-3 py-2 text-left text-label text-muted font-semibold">
                        Batch
                      </th>
                      <th className="px-3 py-2 text-left text-label text-muted font-semibold">
                        Utløp
                      </th>
                      <th className="px-3 py-2 no-print" />
                    </tr>
                  </thead>
                  <tbody>
                    {selected.items.map((i, idx) => (
                      <tr
                        key={i.id}
                        className={`border-b border-divider last:border-b-0 ${
                          idx % 2 === 1 ? "bg-surface/40" : ""
                        }`}
                      >
                        <td className="px-3 py-2 text-text">
                          <div className="text-bodyMedium">
                            {i.medicineName}
                          </div>
                          <div className="text-captionSmall text-muted">
                            {i.nameFormStrength || i.navnFormStyrke}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-text">
                          {fmtInt(i.quantity)}{" "}
                          <span className="text-caption text-muted">
                            {i.enhetPakning}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-caption text-muted">
                          {i.batchNumber || "—"}
                        </td>
                        <td className="px-3 py-2 text-caption text-muted whitespace-nowrap">
                          {i.expirationDate ? fmtDate(i.expirationDate) : "—"}
                        </td>
                        <td className="px-3 py-2 no-print text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            iconLeft={Edit}
                            onClick={() =>
                              setEditingItem({
                                delivery: selected,
                                item: i,
                                quantity: String(i.quantity),
                                batchNumber: i.batchNumber ?? "",
                                expirationDate: i.expirationDate ?? "",
                              })
                            }
                          >
                            Endre
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <Divider />

            <div>
              <SectionHeader
                title={`Avvik (${selected.deviations.length})`}
                subtitle={
                  selected.deviations.length === 0
                    ? "Ingen avvik registrert"
                    : "Klikk «Endre» for å justere beskrivelsen"
                }
              />
              {selected.deviations.length === 0 ? (
                <p className="text-caption text-muted">Alt OK ved mottak.</p>
              ) : (
                <ul className="space-y-3">
                  {selected.deviations.map((d) => (
                    <li key={d.id}>
                      <Card padded={false} className="p-4 bg-warning-soft border-0">
                        <div className="flex items-start gap-3">
                          <AlertTriangle
                            size={20}
                            className="text-warning shrink-0 mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-bodyMedium text-text">
                                {DEVIATION_LABELS[d.type] ?? d.type}
                              </span>
                              <span className="text-captionSmall text-muted">
                                {fmtDateTime(d.reportedAt)} · #{d.reportedBy}
                              </span>
                            </div>
                            <p className="text-body text-text mt-1 whitespace-pre-wrap break-words">
                              {d.description || "(Ingen beskrivelse)"}
                            </p>
                            {d.photoUri && (
                              <a
                                href={d.photoUri}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-caption text-primary mt-1"
                              >
                                <ImageIcon size={12} /> Se bilde
                              </a>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            iconLeft={Edit}
                            onClick={() =>
                              setEditingDeviation({
                                delivery: selected,
                                deviation: d,
                                description: d.description ?? "",
                                type: d.type,
                              })
                            }
                          >
                            Endre
                          </Button>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Rediger leveranselinje ─────────────────── */}
      <Modal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Endre leveranselinje"
        description={
          editingItem
            ? `${editingItem.item.medicineName} — endring justerer lageret automatisk`
            : ""
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingItem(null)}>
              Avbryt
            </Button>
            <Button
              iconLeft={Save}
              loading={updateItem.isPending}
              onClick={() => updateItem.mutate()}
            >
              Lagre
            </Button>
          </>
        }
      >
        {editingItem && (
          <div className="space-y-4">
            <div className="bg-surface p-3 rounded-md">
              <div className="text-bodyMedium">
                {editingItem.item.medicineName}
              </div>
              <div className="text-caption text-muted">
                Opprinnelig antall: {editingItem.item.quantity}{" "}
                {editingItem.item.enhetPakning}
              </div>
            </div>
            <label className="text-label text-text font-medium">
              Antall mottatt
            </label>
            <input
              type="number"
              min={0}
              value={editingItem.quantity}
              onChange={(e) =>
                setEditingItem({ ...editingItem, quantity: e.target.value })
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
            />
            <label className="text-label text-text font-medium">Batch-nr</label>
            <input
              type="text"
              value={editingItem.batchNumber}
              onChange={(e) =>
                setEditingItem({ ...editingItem, batchNumber: e.target.value })
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
            />
            <label className="text-label text-text font-medium">
              Utløpsdato (ÅÅÅÅ-MM-DD)
            </label>
            <input
              type="date"
              value={
                editingItem.expirationDate
                  ? editingItem.expirationDate.slice(0, 10)
                  : ""
              }
              onChange={(e) =>
                setEditingItem({
                  ...editingItem,
                  expirationDate: e.target.value,
                })
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
            />
          </div>
        )}
      </Modal>

      {/* ── Rediger avviksbeskrivelse ─────────────────── */}
      <Modal
        open={!!editingDeviation}
        onClose={() => setEditingDeviation(null)}
        title="Endre avvik"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingDeviation(null)}>
              Avbryt
            </Button>
            <Button
              iconLeft={Save}
              loading={updateDeviation.isPending}
              onClick={() => updateDeviation.mutate()}
            >
              Lagre
            </Button>
          </>
        }
      >
        {editingDeviation && (
          <div className="space-y-3">
            <label className="text-label text-text font-medium">
              Avvikstype
            </label>
            <select
              value={editingDeviation.type}
              onChange={(e) =>
                setEditingDeviation({
                  ...editingDeviation,
                  type: e.target.value,
                })
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
            >
              {Object.entries(DEVIATION_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <label className="text-label text-text font-medium">
              Beskrivelse
            </label>
            <textarea
              rows={5}
              value={editingDeviation.description}
              onChange={(e) =>
                setEditingDeviation({
                  ...editingDeviation,
                  description: e.target.value,
                })
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
            />
          </div>
        )}
      </Modal>

      <Modal
        open={!!photo}
        onClose={() => setPhoto(null)}
        title="Pakkseddel"
        description={photo ? fmtDateTime(photo.completedAt) : ""}
        size="lg"
        footer={
          photo?.packingSlipPhotoUrl ? (
            <Button
              variant="outline"
              iconLeft={ExternalLink}
              onClick={() => window.open(photo.packingSlipPhotoUrl, "_blank")}
            >
              Åpne i ny fane
            </Button>
          ) : null
        }
      >
        {photo?.packingSlipPhotoUrl ? (
          <img
            src={photo.packingSlipPhotoUrl}
            alt="Pakkseddel"
            className="max-w-full max-h-[60vh] mx-auto rounded-md border border-border"
          />
        ) : (
          <p className="text-muted text-center py-10">Ingen bilde lagret</p>
        )}
      </Modal>
    </>
  );
}
