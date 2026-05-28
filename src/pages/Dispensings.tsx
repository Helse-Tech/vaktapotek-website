import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Printer, Redo2, Undo2 } from "lucide-react";
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
import { downloadCsv, fmtDate, fmtDateTime, fmtInt, printPage } from "../helpers";
import { useApp } from "../store";
import type { DispensingRecord } from "../types";

export default function DispensingsPage() {
  const range = useApp((s) => s.range);
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["dispensings", range.from, range.to],
    queryFn: () => api.dispensings.list(range.from, range.to),
  });

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "A" | "B" | "C" | "reversed" | "discrepancy">(
    "all",
  );
  const [reversing, setReversing] = useState<DispensingRecord | null>(null);
  const [unreversing, setUnreversing] = useState<DispensingRecord | null>(null);
  const [reason, setReason] = useState("");

  const data = useMemo(() => {
    let rows = list.data ?? [];
    if (q.trim()) {
      const term = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.medicineName.toLowerCase().includes(term) ||
          r.patientInitials.toLowerCase().includes(term) ||
          r.signer1Id.includes(term) ||
          (r.signer2Id ?? "").includes(term),
      );
    }
    if (filter === "reversed") rows = rows.filter((r) => !!r.reversedAt);
    else if (filter === "discrepancy")
      rows = rows.filter((r) => r.countDiscrepancy);
    else if (filter !== "all") rows = rows.filter((r) => r.reseptgruppe === filter);
    return rows;
  }, [list.data, q, filter]);

  const reverse = useMutation({
    mutationFn: () =>
      api.dispensings.reverse(reversing!.id, reason || "Admin-reversal"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dispensings"] });
      toast.success("Uttak reversert");
      setReversing(null);
      setReason("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke reversere"),
  });

  const unreverse = useMutation({
    mutationFn: () =>
      api.dispensings.unreverse(unreversing!.id, reason || "Admin-omreversering"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dispensings"] });
      toast.success("Reversering angret — uttaket er aktivt igjen");
      setUnreversing(null);
      setReason("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke omreversere"),
  });

  const exportCsv = () =>
    downloadCsv(
      `uttak-${range.from.slice(0, 10)}_${range.to.slice(0, 10)}`,
      data.map((d) => ({
        Tid: fmtDateTime(d.dispensedAt),
        Medisin: d.medicineName,
        Gruppe: d.reseptgruppe ?? "",
        Mengde: `${d.amount} ${d.amountUnit}`,
        Pasient: d.patientInitials || "—",
        "Fødselsdato": d.dob || "—",
        "Signer 1": d.signer1Id,
        "Sign 1 metode": d.signer1Method,
        "Signer 2": d.signer2Id ?? "—",
        "Sign 2 metode": d.signer2Method ?? "—",
        Telleavvik: d.countDiscrepancy ? "Ja" : "Nei",
        Reversert: d.reversedAt ? `Ja (${fmtDateTime(d.reversedAt)})` : "Nei",
        Reverseringsbegrunnelse: d.reversalReason ?? "",
      })),
    );

  return (
    <>
      <PageHeader
        title="Uttak"
        subtitle="Alle registrerte medisinuttak — filtrerbart og utskriftsvennlig"
        action={
          <div className="flex gap-2">
            <RangePicker />
            <Button
              variant="outline"
              iconLeft={Download}
              onClick={exportCsv}
            >
              CSV
            </Button>
            <Button
              variant="outline"
              iconLeft={Printer}
              onClick={() => printPage("Uttak · Ventral VaktApotek")}
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
            placeholder="Søk på medisin, pasient eller ansattnr…"
            className="flex-1 min-w-[260px]"
          />
          <div className="flex gap-2">
            {(["all", "A", "B", "C", "discrepancy", "reversed"] as const).map(
              (f) => (
                <Chip
                  key={f}
                  variant={filter === f ? "primary" : "neutral"}
                  onPress={() => setFilter(f)}
                >
                  {f === "all"
                    ? "Alle"
                    : f === "discrepancy"
                      ? "Avvik"
                      : f === "reversed"
                        ? "Reversert"
                        : f}
                </Chip>
              ),
            )}
          </div>
        </div>
      </Card>

      <SectionHeader title={`${data.length} uttak`} />

      <DataTable
        rows={data}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "time",
            header: "Tid",
            sortValue: (r) => r.dispensedAt,
            render: (r) => (
              <span className="text-caption text-muted">
                {fmtDateTime(r.dispensedAt)}
              </span>
            ),
          },
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
            key: "amount",
            header: "Mengde",
            align: "right",
            sortValue: (r) => r.amount,
            render: (r) => `${fmtInt(r.amount)} ${r.amountUnit}`,
          },
          {
            key: "patient",
            header: "Pasient",
            render: (r) => (
              <div className="leading-tight">
                <div className="text-bodyMedium text-text">
                  {r.patientInitials || "—"}
                </div>
                {r.dob && (
                  <div className="text-captionSmall text-muted">
                    f. {fmtDate(r.dob)}
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "signer",
            header: "Signert av",
            render: (r) => (
              <span className="text-caption">
                #{r.signer1Id}
                {r.signer2Id && ` + #${r.signer2Id}`}
              </span>
            ),
          },
          {
            key: "status",
            header: "Status",
            render: (r) => {
              if (r.reversedAt)
                return <StatusPill tone="neutral">Reversert</StatusPill>;
              if (r.countDiscrepancy)
                return <StatusPill tone="warning">Avvik</StatusPill>;
              if (r.doubleSignPostponed)
                return <StatusPill tone="warning">Utsatt sign 2</StatusPill>;
              return <StatusPill tone="success">OK</StatusPill>;
            },
          },
          {
            key: "action",
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
              ),
          },
        ]}
      />

      <Modal
        open={!!reversing}
        onClose={() => {
          setReversing(null);
          setReason("");
        }}
        title="Reverser uttak"
        description="Lageret legges tilbake og hendelsen logges. Krever begrunnelse."
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
              onClick={() => reverse.mutate()}
              disabled={reason.trim().length < 3}
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
                {fmtDateTime(reversing.dispensedAt)}
              </div>
            </div>
            <label className="text-label text-text font-medium">
              Begrunnelse
            </label>
            <textarea
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Hvorfor reverseres uttaket?"
            />
          </div>
        )}
      </Modal>

      {/* ── Omreverser (angre reversering) ───────────── */}
      <Modal
        open={!!unreversing}
        onClose={() => {
          setUnreversing(null);
          setReason("");
        }}
        title="Omreverser uttak"
        description="Uttaket blir aktivt igjen og lageret trekkes på nytt. Krever begrunnelse."
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
              onClick={() => unreverse.mutate()}
              disabled={reason.trim().length < 3}
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
                {fmtDateTime(unreversing.dispensedAt)}
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
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-body text-text focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Hvorfor angres reverseringen?"
            />
          </div>
        )}
      </Modal>
    </>
  );
}
