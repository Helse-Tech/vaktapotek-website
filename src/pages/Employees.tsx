import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Edit,
  IdCard,
  Loader2,
  Plus,
  Save,
  UserPlus,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { api } from "../api";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  HelpTip,
  Input,
  Modal,
  PageHeader,
  PasswordInput,
  RoleBadge,
  SearchBar,
  SectionHeader,
  StatusPill,
} from "../components";
import { fmtDateTime, roleLabel } from "../helpers";
import { useApp } from "../store";
import type { User, UserRole } from "../types";

const ROLES: { value: UserRole; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Full tilgang + admin-nettside" },
  {
    value: "med_ansvarlig",
    label: "Med-ansvarlig",
    desc: "Settings + statistikk (ikke ansatte)",
  },
  { value: "abc_prep", label: "ABC-Prep.", desc: "Kan dele ut A, B, C" },
  { value: "c_prep", label: "C-Prep.", desc: "Kan kun dele ut C" },
  { value: "dobbelsign", label: "Dobbelsign.", desc: "Kan kun dobbelsignere" },
];

interface FormState {
  id?: string;
  name: string;
  title: string;
  employeeNumber: string;
  role: UserRole;
  password: string;
  isActive: boolean;
}

const EMPTY: FormState = {
  name: "",
  title: "",
  employeeNumber: "",
  role: "abc_prep",
  password: "",
  isActive: true,
};

export default function EmployeesPage() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["users"], queryFn: api.users.list });
  const openConfirm = useApp((s) => s.openConfirm);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<FormState | null>(null);
  const [nfcMode, setNfcMode] = useState<User | null>(null);
  const [nfcUid, setNfcUid] = useState("");
  const [nfcScanning, setNfcScanning] = useState(false);

  const filtered = useMemo(() => {
    const rows = list.data ?? [];
    if (!q.trim()) return rows;
    const term = q.toLowerCase();
    return rows.filter(
      (u) =>
        u.name.toLowerCase().includes(term) ||
        u.employeeNumber.includes(term) ||
        roleLabel(u.role).toLowerCase().includes(term),
    );
  }, [list.data, q]);

  const create = useMutation({
    mutationFn: (s: FormState) =>
      api.users.create({
        name: s.name.trim(),
        title: s.title.trim() || undefined,
        employeeNumber: s.employeeNumber.trim(),
        role: s.role,
        password: s.password,
        isActive: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Ansatt opprettet");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke opprette"),
  });

  const update = useMutation({
    mutationFn: (s: FormState) =>
      api.users.update(s.id!, {
        name: s.name.trim(),
        title: s.title.trim() || undefined,
        role: s.role,
        ...(s.password ? { password: s.password } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Ansatt oppdatert");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke lagre"),
  });

  const toggleActive = useMutation({
    mutationFn: (u: User) =>
      u.isActive ? api.users.deactivate(u.id) : api.users.activate(u.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke endre status"),
  });

  // ── USB NFC-leser ──────────────────────────────────────────────
  // Mange USB NFC-lesere fungerer som et HID-tastatur og "skriver inn"
  // kortets UID i et input-felt. Vi støtter også Web NFC (Chrome Android)
  // direkte hvis tilgjengelig.
  const registerNfc = useMutation({
    mutationFn: () =>
      api.nfc.register({
        hardwareUid: nfcUid.trim(),
        employeeNumber: nfcMode!.employeeNumber,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("NFC-kort registrert");
      setNfcMode(null);
      setNfcUid("");
    },
    onError: (e: any) => toast.error(e?.message ?? "Kunne ikke registrere"),
  });

  const startWebNfc = async () => {
    if (!("NDEFReader" in window)) {
      toast.message(
        "Bruk USB-leseren — Web NFC er ikke tilgjengelig i denne nettleseren.",
      );
      return;
    }
    try {
      setNfcScanning(true);
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      ndef.onreading = (event: any) => {
        setNfcUid(event.serialNumber);
        setNfcScanning(false);
      };
    } catch (e: any) {
      setNfcScanning(false);
      toast.error(e?.message ?? "NFC-skanning feilet");
    }
  };

  const submit = () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.employeeNumber.trim()) {
      toast.error("Navn og ansattnummer er påkrevd");
      return;
    }
    if (!editing.id) {
      if (editing.password.length < 6) {
        toast.error("Passord må være minst 6 tegn");
        return;
      }
      if (
        (list.data ?? []).some(
          (u) => u.employeeNumber === editing.employeeNumber.trim(),
        )
      ) {
        toast.error("Ansattnummer er allerede i bruk");
        return;
      }
      create.mutate(editing);
    } else {
      update.mutate(editing);
    }
  };

  return (
    <>
      <PageHeader
        title="Ansatte"
        subtitle="Roller, passord, NFC-kort"
        action={
          <Button iconLeft={UserPlus} onClick={() => setEditing({ ...EMPTY })}>
            Ny ansatt
          </Button>
        }
      />

      <Card className="mb-4">
        <SearchBar
          value={q}
          onChange={setQ}
          placeholder="Søk på navn, ansattnummer eller rolle…"
        />
      </Card>

      <SectionHeader title={`${filtered.length} ansatte`} />

      {filtered.length === 0 ? (
        <EmptyState
          title="Ingen ansatte funnet"
          subtitle="Opprett en ny ansatt for å komme i gang."
          action={
            <Button iconLeft={Plus} onClick={() => setEditing({ ...EMPTY })}>
              Ny ansatt
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((u) => (
            <li key={u.id}>
              <Card padded={false} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar name={u.name} size={44} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-bodyMedium text-text truncate">
                        {u.name}
                      </span>
                      {!u.isActive && (
                        <StatusPill tone="neutral">Inaktiv</StatusPill>
                      )}
                    </div>
                    {u.title && (
                      <div className="text-caption text-muted truncate">
                        {u.title}
                      </div>
                    )}
                    <div className="text-caption text-muted">
                      #{u.employeeNumber}
                    </div>
                  </div>
                  <RoleBadge role={u.role} />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    iconLeft={Edit}
                    onClick={() =>
                      setEditing({
                        id: u.id,
                        name: u.name,
                        title: u.title ?? "",
                        employeeNumber: u.employeeNumber,
                        role: u.role,
                        password: "",
                        isActive: u.isActive,
                      })
                    }
                  >
                    Endre
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    iconLeft={IdCard}
                    onClick={() => {
                      setNfcMode(u);
                      setNfcUid("");
                    }}
                  >
                    NFC-kort
                  </Button>
                  <Button
                    size="sm"
                    variant={u.isActive ? "ghost" : "subtle"}
                    onClick={() =>
                      openConfirm({
                        title: u.isActive
                          ? `Deaktiver ${u.name}?`
                          : `Aktiver ${u.name}?`,
                        message: u.isActive
                          ? "Brukeren kan ikke logge inn igjen før du aktiverer kontoen."
                          : "Brukeren får tilgang umiddelbart.",
                        confirmLabel: u.isActive ? "Deaktiver" : "Aktiver",
                        danger: u.isActive,
                        onConfirm: () => toggleActive.mutate(u),
                      })
                    }
                  >
                    {u.isActive ? "Deaktiver" : "Aktiver"}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* ── Opprett/endre-ansatt ─────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.id ? "Endre ansatt" : "Ny ansatt"}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Avbryt
            </Button>
            <Button
              iconLeft={Save}
              loading={create.isPending || update.isPending}
              onClick={submit}
            >
              Lagre
            </Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <Input
              label="Tittel"
              placeholder="Sykepleier, overlege…"
              value={editing.title}
              onChange={(e) =>
                setEditing({ ...editing, title: e.target.value })
              }
            />
            <Input
              label="Navn"
              placeholder="Ola Nordmann"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
            />
            <Input
              label="Ansattnummer"
              placeholder="1001"
              inputMode="numeric"
              value={editing.employeeNumber}
              onChange={(e) =>
                setEditing({ ...editing, employeeNumber: e.target.value })
              }
              disabled={!!editing.id}
              hint={
                editing.id ? "Ansattnummer kan ikke endres" : "Må være unikt"
              }
            />
            <PasswordInput
              label={editing.id ? "Nytt passord (valgfritt)" : "Passord"}
              value={editing.password}
              onChange={(e) =>
                setEditing({ ...editing, password: e.target.value })
              }
              placeholder={editing.id ? "La stå tomt for å beholde" : "Minst 6 tegn"}
            />
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-label font-medium text-text">
                  Rolle
                </label>
                <HelpTip text="Alle roller kan dobbelsignere. ABC-Prep kan dele ut A/B/C. C-Prep kun C. Dobbelsign. kan ikke dele ut." />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ROLES.map((r) => {
                  const sel = editing.role === r.value;
                  return (
                    <button
                      key={r.value}
                      onClick={() => setEditing({ ...editing, role: r.value })}
                      className={`text-left rounded-md border p-3 transition-colors ${
                        sel
                          ? "border-primary bg-primary-soft"
                          : "border-border bg-surface hover:bg-pressed"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-bodyMedium ${sel ? "text-primary" : "text-text"}`}
                        >
                          {r.label}
                        </span>
                        {sel && (
                          <CheckCircle2 size={16} className="text-primary" />
                        )}
                      </div>
                      <div className="text-caption text-muted mt-0.5">
                        {r.desc}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── NFC-registrering ─────────────────────────── */}
      <Modal
        open={!!nfcMode}
        onClose={() => {
          setNfcMode(null);
          setNfcUid("");
        }}
        title="Registrer NFC-kort"
        description={
          nfcMode ? `For ${nfcMode.name} (#${nfcMode.employeeNumber})` : ""
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setNfcMode(null);
                setNfcUid("");
              }}
            >
              Avbryt
            </Button>
            <Button
              loading={registerNfc.isPending}
              disabled={!nfcUid.trim()}
              onClick={() => registerNfc.mutate()}
            >
              Lagre kort
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Card className="bg-info-soft border-0">
            <div className="flex items-start gap-3">
              <IdCard className="text-info shrink-0" />
              <div className="text-caption text-text">
                <p className="font-semibold mb-1">
                  USB-leser eller Web-NFC?
                </p>
                <p>
                  Med USB-NFC-leser: klikk i feltet under og hold kortet mot
                  leseren — UID-en kommer inn automatisk. Med en mobil
                  Chrome-nettleser kan du bruke{" "}
                  <button
                    onClick={startWebNfc}
                    className="text-info font-semibold underline"
                  >
                    Web NFC
                  </button>{" "}
                  i stedet.
                </p>
              </div>
            </div>
          </Card>
          <Input
            label="Kort-UID"
            placeholder="Hold kortet mot leseren…"
            autoFocus
            value={nfcUid}
            onChange={(e) => setNfcUid(e.target.value)}
            rightSlot={
              nfcScanning ? (
                <Loader2 size={16} className="animate-spin text-muted" />
              ) : nfcUid ? (
                <button
                  onClick={() => setNfcUid("")}
                  className="p-1 text-muted"
                  aria-label="Tøm"
                >
                  <X size={16} />
                </button>
              ) : null
            }
          />
        </div>
      </Modal>
    </>
  );
}
