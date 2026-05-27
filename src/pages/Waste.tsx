import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";

import { api } from "../api";
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  RangePicker,
  ReseptBadge,
  SearchBar,
  SectionHeader,
} from "../components";
import { downloadCsv, fmtDateTime, fmtInt, printPage } from "../helpers";
import { useApp } from "../store";

export default function WastePage() {
  const range = useApp((s) => s.range);
  const list = useQuery({
    queryKey: ["waste", range.from, range.to],
    queryFn: () => api.waste.list(range.from, range.to),
  });
  const [q, setQ] = useState("");

  const data = useMemo(() => {
    const rows = list.data ?? [];
    if (!q.trim()) return rows;
    const term = q.toLowerCase();
    return rows.filter(
      (r) =>
        r.medicineName.toLowerCase().includes(term) ||
        r.signedBy.includes(term),
    );
  }, [list.data, q]);

  const exportCsv = () =>
    downloadCsv(
      `svinn-${range.from.slice(0, 10)}_${range.to.slice(0, 10)}`,
      data.map((r) => ({
        Tid: fmtDateTime(r.createdAt),
        Medisin: r.medicineName,
        Gruppe: r.reseptgruppe ?? "",
        Mengde: `${r.amount} ${r.amountUnit}`,
        "Signert av": r.signedBy,
        "Dobbelsign": r.doubleSignCompleted ? "Ja" : "Nei",
      })),
    );

  return (
    <>
      <PageHeader
        title="Svinn"
        subtitle="Alle registrerte svinn-hendelser"
        action={
          <div className="flex gap-2">
            <RangePicker />
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
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Søk på medisin eller ansattnr…"
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
            sortValue: (r) => r.createdAt,
            render: (r) => (
              <span className="text-caption text-muted">
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
            render: (r) => `${fmtInt(r.amount)} ${r.amountUnit}`,
          },
          {
            key: "signer",
            header: "Signert",
            render: (r) =>
              `#${r.signedBy}${r.signer2Id ? ` + #${r.signer2Id}` : ""}`,
          },
        ]}
      />
    </>
  );
}
