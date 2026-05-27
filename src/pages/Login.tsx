import { LogIn, ShieldCheck, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { auth } from "../api";
import {
  Button,
  Card,
  HelpTip,
  Input,
  PasswordInput,
  VentralLogo,
} from "../components";
import { useApp } from "../store";

export default function LoginPage() {
  const [empNum, setEmpNum] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const setSession = useApp((s) => s.setSession);

  useEffect(() => {
    if (auth.isAuthenticated()) navigate("/", { replace: true });
  }, [navigate]);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!empNum.trim() || !password.trim()) {
      setErr("Fyll inn ansattnummer og passord");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const session = await auth.login(empNum.trim(), password);
      setSession(session);
      toast.success(`Velkommen, ${session.user.name}`);
      navigate("/", { replace: true });
    } catch (e: any) {
      setErr(e?.message ?? "Innlogging feilet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <VentralLogo size={48} />
        </div>
        <Card className="animate-slide-up">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="text-primary" size={22} />
            <h1 className="text-h2 text-text">Logg inn</h1>
            <HelpTip text="Din WordPress-konto avgjør automatisk hvilken legevakt eller legekontor du tilhører. Du trenger ikke skrive inn noen kode eller adresse." />
          </div>
          <form onSubmit={submit} className="space-y-4">
            <Input
              label="Ansattnummer"
              iconLeft={User}
              value={empNum}
              onChange={(e) => setEmpNum(e.target.value)}
              placeholder="1000"
              autoFocus
              inputMode="numeric"
              autoComplete="username"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  passwordRef.current?.focus();
                }
              }}
            />
            <PasswordInput
              ref={passwordRef}
              label="Passord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
            />
            {err && (
              <div className="rounded-md bg-danger-soft px-3 py-2 text-caption text-danger">
                {err}
              </div>
            )}
            <Button type="submit" loading={busy} iconLeft={LogIn} fullWidth>
              Logg inn
            </Button>
          </form>
          <p className="text-caption text-muted mt-5 text-center">
            Glemt passord? Kontakt din administrator.
          </p>
        </Card>
        <p className="text-captionSmall text-subtle text-center mt-6">
          © {new Date().getFullYear()} Ventral AS · VaktApotek-administrasjon
        </p>
      </div>
    </div>
  );
}
