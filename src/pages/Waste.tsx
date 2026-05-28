import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Edit,
  Plus,
  Printer,
  Redo2,
  Save,
  Undo2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { api } from "../api";
import {
  Button,
  Card,
  Chip,
  DataTable,
  Modal,
  PageHeader,
  RangePicker,
  ReseptBadge,
  SearchBar,
  SectionHeader,
  StatusPill,
} from "../components";
import { downloadCsv, fmtDateTime, fmtInt, printPage } from "../helpers";
import { useApp } from "../store";
import type { InventoryItem, WasteRecord } from "../types";

interface CreateState {
  medicineId: string;
  amount: string;
  note: string;
}

interface EditState {
  id: string;
  medicineName: string;
  amount: string;
  amountUnit: string;
  note: string;
}

export default function WastePage() {
  const range = useApp((s) => s.range);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["waste", range.from, range.to],
    queryFn: () => api.waste.list(range.from, range.to),
  });
  const inventory = useQuery({
    queryKey: ["inventory"],
    queryFn: api.inventory.list,
  });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "reversed">("all");
  const [creating, setCreating] = useState<CreateState | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [reversing, setReversing] = useState<WasteRecord | null>(null);
  const [unreversing, setUnreversing] = useState<WasteRecord | null>(null);
  const [reason, setReason] = useState("");

  const data = useMemo(() => {
    let rows = list.data ?? [];
    if (filter === "active") rows = rows.filter((r) => !r.reversedAt);
    else if (filter === "reversed") rows = rows.filter((r) => !!r.reversedAt);
    if (q.trim()) {
      const term = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.medicineName.toLowerCase().includes(term) ||
          r.signedBy.includes(term) ||
          (r.note ?? "").toLowerCase().includes(term),
      );
    }
    return rows;
  }, [list.data, q, filter]);

  const create = useMutation({
    mutationFn: () =>
      api.waste.create({
        medicineId: creating!.medicineId,
        amount: Number(creating!.amount) || 0,
        note: creating!.note || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waste"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Svinn registrert — lageret er oppdatert");
      setCreating(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke registrere"),
  });

  const update = useMutation({
    mutationFn: () =>
      api.waste.update(editing!.id, {
        amount: Number(editing!.amount) || 0,
        amountUnit: editing!.amountUnit,
        note: editing!.note,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waste"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Svinn oppdatert — lageret er justert");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke lagre"),
  });

  const reverse = useMutation({
    mutationFn: () => api.waste.reverse(reversing!.id, reason || "Admin-reversal"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waste"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Svinn reversert — beholdning lagt tilbake i lager");
      setReversing(null);
      setReason("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke reversere"),
  });

  const unreverse = useMutation({
    mutationFn: () =>
      api.waste.unreverse(unreversing!.id, reason || "Admin-omreversering"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["waste"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Reversering angret — svinn er aktivt igjen");
      setUnreversing(null);
      setReason("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke omreversere"),
  });

  const exportCsv = () =>
    downloadCsv(
      `svinn-${range.from.slice(0, 10)}_${range.to.slice(0, 10)}`,
      data.map((r) => ({
        Tid: fmtDateTime(r.createdAt),
        Medisin: r.medicineName,
        Gruppe: r.reseptgruppe ?? "",
        Mengde: `${r.amount} ${r.amountUnit}`,
        "Signert av": r.signedBy,
        Dobbelsign: r.doubleSignCompleted ? "Ja" : "Nei",
        Notat: r.note ?? "",
        Reversert: r.reversedAt
          ? `Ja (${fmtDateTime(r.reversedAt)} — ${r.reversalReason ?? ""})`
          : "Nei",
      })),
    );

  return (
    <>
      <PageHeader
        title="Svinn"
        subtitle="Alle registrerte svinn-hendelser — admin kan registrere, endre og reversere"
        action={
          <div className="flex gap-2">
            <RangePicker />
            <Button
              iconLeft={Plus}
              onClick={() =>
                setCreating({ medicineId: "", amount: "", note: "" })
              }
            >
              Registrer svinn
            </Button>
            <Button variant="outline" iconLeft={Download} onClick={exportCsv}>
              CSV
            </Button>
            <Button
              variant="outline"
              iconLeft={Printer}
              onClick={() => printPage("Svinn · Ventral VaktApotek")}
            >
              Skriv ut
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <SearchBar
            value={q}
            onChange={setQ}
            placeholder="Søk på medisin, ansattnr eller notat…"
            className="flex-1 min-w-[260px]"
          />
          <div className="flex gap-2">
            {(["all", "active", "reversed"] as const).map((f) => (
              <Chip
                key={f}
                variant={filter === f ? "primary" : "neutral"}
                onPress={() => setFilter(f)}
              >
                {f === "all" ? "Alle" : f === "active" ? "Aktive" : "Reversert"}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      <SectionHeader title={`${data.length} hendelser`} />

      <DataTable
        rows={data}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "time",
            header: "Tid",
            sortValue: (r) => r.createdAt,
            render: (r) => (
              <span className="text-caption text-muted whitespace-nowrap">
                {fmtDateTime(r.createdAt)}
              </span>
            ),
          },
          {
            key: "med",
            header: "Medisin",
            sortValue: (r) => r.medicineName,
            render: (r) => (
              <div className="flex items-center gap-2">
                <ReseptBadge group={r.reseptgruppe} />
                <span className="text-bodyMedium">{r.medicineName}</span>
              </div>
            ),
          },
          {
            key: "amount",
            header: "Mengde",
            align: "right",
            sortValue: (r) => r.amount,
            render: (r) => `${fmtInt(r.amount)} ${r.amountUnit}`,
          },
          {
            key: "signer",
            header: "Signert",
            render: (r) =>
              `#${r.signedBy}${r.signer2Id ? ` + #${r.signer2Id}` : ""}`,
          },
          {
            key: "note",
            header: "Notat",
            render: (r) => (
              <span className="text-caption text-muted break-words whitespace-normal block">
                {r.note || "—"}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (r) =>
              r.reversedAt ? (
                <StatusPill tone="neutral">Reversert</StatusPill>
              ) : (
                <StatusPill tone="success">Aktiv</StatusPill>
              ),
          },
          {
            key: "actions",
            header: "",
            noPrint: true,
            render: (r) =>
              r.reversedAt ? (
                <Button
                  size="sm"
                  variant="ghost"
                  iconLeft={Redo2}
                  onClick={(e) => {
                    e.stopPropagation();
                    setUnreversing(r);
                  }}
                >
                  Omreverser
                </Button>
              ) : (
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    iconLeft={Edit}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing({
                        id: r.id,
                        medicineName: r.medicineName,
                        amount: String(r.amount),
                        amountUnit: r.amountUnit,
                        note: r.note ?? "",
                      });
                    }}
                  >
                    Endre
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    iconLeft={Undo2}
                    onClick={(e) => {
                      e.stopPropagation();
                      setReversing(r);
                    }}
                  >
                    Reverser
                  </Button>
                </div>
              ),
          },
        ]}
      />

      {/* ── Registrer nytt svinn ─────────────────────── */}
      <Modal
        open={!!creating}
        onClose={() => setCreating(null)}
        title="Registrer svinn"
        description="Beholdningen trekkes umiddelbart fra lageret."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(null)}>
              Avbryt
            </Button>
            <Button
              iconLeft={Save}
              loading={create.isPending}
              disabled={!creating?.medicineId || !(Number(creating?.amount) > 0)}
              onClick={() => create.mutate()}
            >
              Lagre svinn
            </Button>
          </>
        }
      >
        {creating && (
          <div className="space-y-3">
            <label className="text-label text-text font-medium">Medisin</label>
            <select
              value={creating.medicineId}
              onChange={(e) =>
                setCreating({ ...creating, medicineId: e.target.value })
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
            >
              <option value="">— Velg medisin —</option>
              {(inventory.data ?? [])
                .slice()
                .sort((a: InventoryItem, b: InventoryItem) =>
                  a.medicineName.localeCompare(b.medicineName, "nb"),
                )
                .map((m: InventoryItem) => (
                  <option key={m.medicineId} value={m.medicineId}>
                    {m.medicineName} ({m.strength}) — {m.form}
                  </option>
                ))}
            </select>
            <label className="text-label text-text font-medium">Mengde</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={creating.amount}
              onChange={(e) =>
                setCreating({ ...creating, amount: e.target.value })
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
            />
            <label className="text-label text-text font-medium">
              Notat (valgfritt)
            </label>
            <textarea
              rows={3}
              value={creating.note}
              onChange={(e) =>
                setCreating({ ...creating, note: e.target.value })
              }
              placeholder="Hvorfor er dette svinn?"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
            />
          </div>
        )}
      </Modal>

      {/* ── Endre eksisterende svinn ────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Endre svinn"
        description={
          editing
            ? `${editing.medicineName} — endring justerer lageret automatisk`
            : ""
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Avbryt
            </Button>
            <Button
              iconLeft={Save}
              loading={update.isPending}
              onClick={() => update.mutate()}
            >
              Lagre
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-3">
            <label className="text-label text-text font-medium">Mengde</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step="0.01"
                value={editing.amount}
                onChange={(e) =>
                  setEditing({ ...editing, amount: e.target.value })
                }
                className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
              />
              <input
                type="text"
                value={editing.amountUnit}
                onChange={(e) =>
                  setEditing({ ...editing, amountUnit: e.target.value })
                }
                className="w-32 rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
                placeholder="enhet"
              />
            </div>
            <label className="text-label text-text font-medium">Notat</label>
            <textarea
              rows={3}
              value={editing.note}
              onChange={(e) =>
                setEditing({ ...editing, note: e.target.value })
              }
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
            />
          </div>
        )}
      </Modal>

      {/* ── Reverser svinn ──────────────────────────── */}
      <Modal
        open={!!reversing}
        onClose={() => {
          setReversing(null);
          setReason("");
        }}
        title="Reverser svinn"
        description="Lageret legges tilbake og hendelsen logges."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setReversing(null);
                setReason("");
              }}
            >
              Avbryt
            </Button>
            <Button
              variant="danger"
              loading={reverse.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => reverse.mutate()}
            >
              Bekreft reversering
            </Button>
          </>
        }
      >
        {reversing && (
          <div className="space-y-3">
            <div className="bg-surface p-3 rounded-md">
              <div className="text-bodyMedium">{reversing.medicineName}</div>
              <div className="text-caption text-muted">
                {fmtInt(reversing.amount)} {reversing.amountUnit} ·{" "}
                {fmtDateTime(reversing.createdAt)}
              </div>
            </div>
            <label className="text-label text-text font-medium">
              Begrunnelse
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Hvorfor reverseres svinnet?"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
            />
          </div>
        )}
      </Modal>

      {/* ── Omreverser (angre reversering) ──────────── */}
      <Modal
        open={!!unreversing}
        onClose={() => {
          setUnreversing(null);
          setReason("");
        }}
        title="Omreverser svinn"
        description="Svinnet blir aktivt igjen og lageret trekkes på nytt."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setUnreversing(null);
                setReason("");
              }}
            >
              Avbryt
            </Button>
            <Button
              loading={unreverse.isPending}
              disabled={reason.trim().length < 3}
              onClick={() => unreverse.mutate()}
            >
              Bekreft omreversering
            </Button>
          </>
        }
      >
        {unreversing && (
          <div className="space-y-3">
            <div className="bg-surface p-3 rounded-md">
              <div className="text-bodyMedium">{unreversing.medicineName}</div>
              <div className="text-caption text-muted">
                {fmtInt(unreversing.amount)} {unreversing.amountUnit} ·{" "}
                {fmtDateTime(unreversing.createdAt)}
              </div>
              {unreversing.reversalReason && (
                <div className="text-caption text-muted mt-1">
                  Opprinnelig begrunnelse: {unreversing.reversalReason}
                </div>
              )}
            </div>
            <label className="text-label text-text font-medium">
              Begrunnelse for omreversering
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Hvorfor angres reverseringen?"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
            />
          </div>
        )}
      </Modal>
    </>
  );
}
