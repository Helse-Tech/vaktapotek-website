import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "../api";
import {
  Button,
  Card,
  Chip,
  DataTable,
  PageHeader,
  RangePicker,
  SearchBar,
  SectionHeader,
} from "../components";
import {
  actionLabelFor,
  downloadCsv,
  fmtDateTime,
  fmtLogDetails,
  logCategoryFor,
  printPage,
} from "../helpers";
import { useApp } from "../store";

const CATEGORIES: { key: string; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "auth", label: "Pålogging" },
  { key: "disp", label: "Uttak" },
  { key: "stock", label: "Lager" },
  { key: "waste", label: "Svinn" },
  { key: "alert", label: "Varsler" },
  { key: "admin", label: "Admin" },
];

export default function AuditLogPage() {
  const range = useApp((s) => s.range);
  const list = useQuery({
    queryKey: ["logs", range.from, range.to],
    queryFn: () => api.logs.list(range.from, range.to),
  });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const data = useMemo(() => {
    let rows = list.data ?? [];
    if (cat !== "all") {
      // Bruk sentral mapping (pakker log.action ut først) så ingen handling
      // havner under feil kategori.
      rows = rows.filter((r) => logCategoryFor(r) === cat);
    }
    if (q.trim()) {
      const term = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          actionLabelFor(r).toLowerCase().includes(term) ||
          r.actionType.toLowerCase().includes(term) ||
          r.userId.includes(term) ||
          (r.medicineId ?? "").includes(term) ||
          fmtLogDetails(r.details).toLowerCase().includes(term),
      );
    }
    return rows;
  }, [list.data, q, cat]);

  return (
    <>
      <PageHeader
        title="Revisjonslogg"
        subtitle="Alle hendelser, tamper-evident og uredigerbar"
        action={
          <div className="flex gap-2">
            <RangePicker />
            <Button
              variant="outline"
              iconLeft={Download}
              onClick={() =>
                downloadCsv(
                  `revisjonslogg-${range.from.slice(0, 10)}_${range.to.slice(0, 10)}`,
                  data.map((r) => ({
                    Tid: fmtDateTime(r.timestamp),
                    Handling: actionLabelFor(r),
                    "Ansatt-#": r.userId,
                    "Medisin-ID": r.medicineId ?? "",
                    Detaljer: fmtLogDetails(r.details),
                  })),
                )
              }
            >
              CSV
            </Button>
            <Button
              variant="outline"
              iconLeft={Printer}
              onClick={() => printPage("Revisjonslogg · Ventral VaktApotek")}
            >
              Skriv ut
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {CATEGORIES.map((c) => (
            <Chip
              key={c.key}
              variant={cat === c.key ? "primary" : "neutral"}
              onPress={() => setCat(c.key)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Søk på handling, ansattnr eller medisin…"
        />
      </Card>

      <SectionHeader title={`${data.length} hendelser`} />

      <DataTable
        rows={data}
        rowKey={(r) => r.id}
        columns={[
          {
            key: "time",
            header: "Tid",
            sortValue: (r) => r.timestamp,
            width: "180px",
            render: (r) => (
              <span className="text-caption text-muted whitespace-nowrap">
                {fmtDateTime(r.timestamp)}
              </span>
            ),
          },
          {
            key: "action",
            header: "Handling",
            sortValue: (r) => actionLabelFor(r),
            width: "240px",
            render: (r) => (
              <span className="text-bodyMedium text-text">
                {actionLabelFor(r)}
              </span>
            ),
          },
          {
            key: "user",
            header: "Ansatt",
            width: "100px",
            render: (r) => (
              <span className="whitespace-nowrap">#{r.userId}</span>
            ),
          },
          {
            key: "details",
            header: "Detaljer",
            render: (r) => (
              <span className="text-caption text-text break-words whitespace-normal block">
                {fmtLogDetails(r.details)}
              </span>
            ),
          },
        ]}
      />
    </>
  );
}
