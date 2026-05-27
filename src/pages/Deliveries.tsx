import { useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Image as ImageIcon, Package, Printer } from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "../api";
import {
  Button,
  Card,
  DataTable,
  Modal,
  PageHeader,
  RangePicker,
  SearchBar,
  SectionHeader,
  StatusPill,
} from "../components";
import { downloadCsv, fmtDateTime, fmtInt, printPage } from "../helpers";
import { useApp } from "../store";
import type { DeliveryReceipt } from "../types";

export default function DeliveriesPage() {
  const range = useApp((s) => s.range);
  const list = useQuery({
    queryKey: ["deliveries", range.from, range.to],
    queryFn: () => api.deliveries.list(range.from, range.to),
  });
  const [q, setQ] = useState("");
  const [photo, setPhoto] = useState<DeliveryReceipt | null>(null);

  const data = useMemo(() => {
    const rows = list.data ?? [];
    if (!q.trim()) return rows;
    const term = q.toLowerCase();
    return rows.filter((r) =>
      r.items.some((i) => i.medicineName.toLowerCase().includes(term)) ||
      r.signedBy.includes(term),
    );
  }, [list.data, q]);

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
          Avvik: r.deviations.length,
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
          placeholder="Søk på medisin eller ansattnr…"
        />
      </Card>

      <SectionHeader title={`${data.length} leveranser`} />

      <DataTable
        rows={data}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "time",
            header: "Mottatt",
            sortValue: (r) => r.completedAt,
            render: (r) => (
              <span className="text-caption text-muted">
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
              <span className="text-caption text-text">
                {r.items
                  .slice(0, 3)
                  .map((i) => i.medicineName)
                  .join(", ")}
                {r.items.length > 3 && ` +${r.items.length - 3} til`}
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
