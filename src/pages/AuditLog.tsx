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
  actionLabel,
  downloadCsv,
  fmtDateTime,
  fmtLogDetails,
  LOG_CATEGORY_FOR,
  printPage,
} from "../helpers";
import { useApp } from "../store";
import type { ActionType } from "../types";

const CATEGORIES: { key: string; label: string; types: ActionType[] }[] = [
  { key: "all", label: "Alle", types: [] },
  {
    key: "auth",
    label: "Pålogging",
    types: ["LOGIN", "LOGOUT", "AUTO_LOGOUT"],
  },
  {
    key: "disp",
    label: "Uttak",
    types: [
      "DISPENSE",
      "DISPENSE_SIGN_1",
      "DISPENSE_SIGN_2",
      "DISPENSE_POSTPONE_SIGN_2",
      "DISPENSE_UNDO",
      "DISPENSE_UNREVERSED",
    ],
  },
  {
    key: "stock",
    label: "Lager",
    types: [
      "DELIVERY_RECEIPT",
      "DELIVERY_DEVIATION",
      "DELIVERY_PHOTO",
      "INVENTORY_EDIT",
      "BATCH_EDIT",
      "BATCH_DELETE",
      "MIXTURE_OPENED",
      "COUNT_DISCREPANCY",
      "COUNT_CORRECTION",
    ],
  },
  {
    key: "waste",
    label: "Svinn",
    types: [
      "WASTE_REGISTRATION",
      "WASTE_UNDO",
      "WASTE_POSTPONE_SIGN_2",
      "WASTE_COUNT_SKIPPED",
      "WASTE_COUNT_DISCREPANCY",
    ],
  },
  {
    key: "alert",
    label: "Varsler",
    types: [
      "ALERT_CREATED",
      "ALERT_RESOLVED",
      "ALERT_ESCALATED",
      "ALERT_UNRESOLVED",
      "ALERT_DEESCALATED",
    ],
  },
  {
    key: "admin",
    label: "Admin",
    types: [
      "EMPLOYEE_CREATED",
      "NFC_CARD_REGISTERED",
      "SETTINGS_CHANGED",
      "ADMIN_VIEW",
      "ADMIN_EDIT",
      "API_CONFIGURED",
      "EMERGENCY_MODE_ON",
      "EMERGENCY_MODE_OFF",
    ],
  },
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
      // Bruk sentral mapping så ingen handling havner under feil kategori
      rows = rows.filter((r) => LOG_CATEGORY_FOR[r.actionType] === cat);
    }
    if (q.trim()) {
      const term = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          actionLabel(r.actionType).toLowerCase().includes(term) ||
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
                    Handling: actionLabel(r.actionType),
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
            sortValue: (r) => actionLabel(r.actionType),
            width: "240px",
            render: (r) => (
              <span className="text-bodyMedium text-text">
                {actionLabel(r.actionType)}
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
