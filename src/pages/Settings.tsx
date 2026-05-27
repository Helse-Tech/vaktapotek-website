import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlarmClock,
  Bell,
  Camera,
  Save,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { api } from "../api";
import {
  Button,
  Card,
  HelpTip,
  Input,
  Loader,
  PageHeader,
  SectionHeader,
} from "../components";

export default function SettingsPage() {
  const qc = useQueryClient();
  const cfg = useQuery({ queryKey: ["config"], queryFn: api.config.get });
  const [form, setForm] = useState<{
    autoLogoutMinutes: number;
    lowStockThresholdDefault: number;
    expirationWarningDays: number;
    postponedDoubleSignMinutes: number;
    countDiscrepancyMinutes: number;
    requireDeliveryPhoto: boolean;
    cPrepRequiresPatientId: boolean;
    enableNfc: boolean;
    enableEmergencyMode: boolean;
  } | null>(null);

  useEffect(() => {
    if (cfg.data) {
      setForm({
        autoLogoutMinutes: cfg.data.autoLogoutMinutes,
        lowStockThresholdDefault: cfg.data.lowStockThresholdDefault,
        expirationWarningDays: cfg.data.expirationWarningDays,
        postponedDoubleSignMinutes:
          cfg.data.alertDeadlines.postponedDoubleSignMinutes,
        countDiscrepancyMinutes:
          cfg.data.alertDeadlines.countDiscrepancyMinutes,
        requireDeliveryPhoto: cfg.data.features.requireDeliveryPhoto,
        cPrepRequiresPatientId: cfg.data.features.cPrepRequiresPatientId,
        enableNfc: cfg.data.features.enableNfc,
        enableEmergencyMode: cfg.data.features.enableEmergencyMode,
      });
    }
  }, [cfg.data]);

  const save = useMutation({
    mutationFn: () =>
      api.config.update({
        autoLogoutMinutes: form!.autoLogoutMinutes,
        lowStockThresholdDefault: form!.lowStockThresholdDefault,
        expirationWarningDays: form!.expirationWarningDays,
        alertDeadlines: {
          ...cfg.data!.alertDeadlines,
          postponedDoubleSignMinutes: form!.postponedDoubleSignMinutes,
          countDiscrepancyMinutes: form!.countDiscrepancyMinutes,
        },
        features: {
          ...cfg.data!.features,
          requireDeliveryPhoto: form!.requireDeliveryPhoto,
          cPrepRequiresPatientId: form!.cPrepRequiresPatientId,
          enableNfc: form!.enableNfc,
          enableEmergencyMode: form!.enableEmergencyMode,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config"] });
      toast.success("Innstillinger lagret — pushes til appene umiddelbart");
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke lagre"),
  });

  if (cfg.isLoading || !form) return <Loader label="Henter innstillinger…" />;

  return (
    <>
      <PageHeader
        title="Innstillinger"
        subtitle="Disse verdiene synces ned til alle ansatte i din legevakt umiddelbart"
        action={
          <Button
            iconLeft={Save}
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            Lagre alle endringer
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <SectionHeader
            title="Sikkerhet"
            subtitle="Automatisk utlogging av brukere ved inaktivitet"
          />
          <div className="flex items-center gap-2 mb-2">
            <AlarmClock size={16} className="text-muted" />
            <label className="text-label">Auto-utlogging (minutter)</label>
            <HelpTip text="Etter denne tiden uten aktivitet logges brukeren ut av mobilappen." />
          </div>
          <Input
            type="number"
            min={1}
            value={form.autoLogoutMinutes}
            onChange={(e) =>
              setForm({ ...form, autoLogoutMinutes: Number(e.target.value) })
            }
          />
        </Card>

        <Card>
          <SectionHeader
            title="Lager"
            subtitle="Standardverdier for nye varer"
          />
          <Input
            label="Standard lav-terskel (kan overstyres pr. medisin)"
            type="number"
            min={0}
            value={form.lowStockThresholdDefault}
            onChange={(e) =>
              setForm({
                ...form,
                lowStockThresholdDefault: Number(e.target.value),
              })
            }
            containerClassName="mb-3"
          />
          <Input
            label="Utløpsvarsel (dager)"
            type="number"
            min={1}
            value={form.expirationWarningDays}
            onChange={(e) =>
              setForm({
                ...form,
                expirationWarningDays: Number(e.target.value),
              })
            }
          />
        </Card>

        <Card>
          <SectionHeader
            title="Varselfrister"
            subtitle="Hvor lenge før varslene eskaleres til admin"
          />
          <Input
            label="Utsatt dobbelsign — frist (minutter)"
            type="number"
            min={1}
            value={form.postponedDoubleSignMinutes}
            onChange={(e) =>
              setForm({
                ...form,
                postponedDoubleSignMinutes: Number(e.target.value),
              })
            }
            containerClassName="mb-3"
          />
          <Input
            label="Telleavvik — frist (minutter)"
            type="number"
            min={1}
            value={form.countDiscrepancyMinutes}
            onChange={(e) =>
              setForm({
                ...form,
                countDiscrepancyMinutes: Number(e.target.value),
              })
            }
          />
        </Card>

        <Card>
          <SectionHeader title="Funksjoner" subtitle="Slå av eller på i appen" />
          <Toggle
            icon={<Camera size={16} />}
            label="Krev bilde av pakkseddel ved varemottak"
            value={form.requireDeliveryPhoto}
            onChange={(v) => setForm({ ...form, requireDeliveryPhoto: v })}
          />
          <Toggle
            icon={<Stethoscope size={16} />}
            label="Krev pasient-ID for C-preparater"
            value={form.cPrepRequiresPatientId}
            onChange={(v) => setForm({ ...form, cPrepRequiresPatientId: v })}
            hint="Av default: nei. Kun signatur kreves."
          />
          <Toggle
            icon={<ShieldCheck size={16} />}
            label="Aktiver NFC-pålogging"
            value={form.enableNfc}
            onChange={(v) => setForm({ ...form, enableNfc: v })}
          />
          <Toggle
            icon={<Bell size={16} />}
            label="Tillat nødmodus"
            value={form.enableEmergencyMode}
            onChange={(v) => setForm({ ...form, enableEmergencyMode: v })}
            hint="Reduserer signeringskrav midlertidig ved kriser."
          />
        </Card>
      </div>
    </>
  );
}

function Toggle({
  icon,
  label,
  value,
  onChange,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-3 py-3 border-b border-divider last:border-b-0 cursor-pointer">
      <div className="flex items-start gap-2">
        <span className="text-muted mt-0.5">{icon}</span>
        <div>
          <div className="text-body text-text">{label}</div>
          {hint && <div className="text-caption text-muted mt-0.5">{hint}</div>}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`shrink-0 mt-0.5 w-11 h-6 rounded-full transition-colors ${
          value ? "bg-primary" : "bg-border"
        }`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
