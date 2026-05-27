import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BellRing, CheckCircle2, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { api } from "../api";
import {
  Button,
  Card,
  Chip,
  EmptyState,
  PageHeader,
  StatusPill,
} from "../components";
import { fmtDateTime, fmtRelativeShort } from "../helpers";

export default function AlertsPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["alerts"], queryFn: api.alerts.list });
  const [filter, setFilter] = useState<"open" | "resolved" | "escalated" | "all">(
    "open",
  );

  const resolve = useMutation({
    mutationFn: (id: string) => api.alerts.resolve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Varsel løst");
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke lukke"),
  });

  const escalate = useMutation({
    mutationFn: (id: string) => api.alerts.escalate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alerts"] });
      toast.warning("Varsel eskalert");
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke eskalere"),
  });

  const filtered = useMemo(() => {
    const rows = list.data ?? [];
    if (filter === "open") return rows.filter((r) => !r.resolvedAt);
    if (filter === "resolved") return rows.filter((r) => !!r.resolvedAt);
    if (filter === "escalated") return rows.filter((r) => r.escalated);
    return rows;
  }, [list.data, filter]);

  return (
    <>
      <PageHeader
        title="Varsler"
        subtitle="Telleavvik, utsatte signaturer, lav beholdning og utløpsdato"
      />

      <Card className="mb-4">
        <div className="flex gap-2 flex-wrap">
          {(["open", "escalated", "resolved", "all"] as const).map((f) => (
            <Chip
              key={f}
              variant={filter === f ? "primary" : "neutral"}
              onPress={() => setFilter(f)}
            >
              {f === "open"
                ? "Åpne"
                : f === "escalated"
                  ? "Eskalert"
                  : f === "resolved"
                    ? "Løst"
                    : "Alle"}
            </Chip>
          ))}
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Ingen varsler"
          subtitle="Alt er under kontroll."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => (
            <li key={a.id}>
              <Card>
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${
                      a.escalated
                        ? "bg-danger-soft text-danger"
                        : a.resolvedAt
                          ? "bg-success-soft text-success"
                          : "bg-warning-soft text-warning"
                    }`}
                  >
                    {a.escalated ? (
                      <ShieldAlert size={20} />
                    ) : a.resolvedAt ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <AlertTriangle size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-bodyMedium text-text">{a.title}</h3>
                      {a.resolvedAt ? (
                        <StatusPill tone="success">Løst</StatusPill>
                      ) : a.escalated ? (
                        <StatusPill tone="danger">Eskalert</StatusPill>
                      ) : (
                        <StatusPill tone="warning">Åpen</StatusPill>
                      )}
                    </div>
                    <p className="text-body text-muted mt-1">{a.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-caption text-subtle">
                      <span>Opprettet {fmtDateTime(a.createdAt)}</span>
                      {a.deadline && (
                        <span>Frist {fmtRelativeShort(a.deadline)}</span>
                      )}
                      {a.relatedUserId && (
                        <span>Ansatt #{a.relatedUserId}</span>
                      )}
                    </div>
                  </div>
                  {!a.resolvedAt && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <Button
                        size="sm"
                        iconLeft={CheckCircle2}
                        loading={resolve.isPending && resolve.variables === a.id}
                        onClick={() => resolve.mutate(a.id)}
                      >
                        Lukk
                      </Button>
                      {!a.escalated && (
                        <Button
                          size="sm"
                          variant="outline"
                          iconLeft={BellRing}
                          loading={
                            escalate.isPending && escalate.variables === a.id
                          }
                          onClick={() => escalate.mutate(a.id)}
                        >
                          Eskaler
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
