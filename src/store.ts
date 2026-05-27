// /src/store.ts
import { create } from "zustand";

import { applyThemeMode, type ThemeMode } from "./theme";
import { Keys, Storage } from "./storage";
import type { AuthSession, DateRange, Tenant, User } from "./types";
import { buildRange } from "./helpers";

interface AppState {
  // ── Auth
  session: AuthSession | null;
  setSession: (s: AuthSession | null) => void;
  setUser: (u: User) => void;
  setTenant: (t: Tenant) => void;

  // ── Tema
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  toggleTheme: () => void;

  // ── Sidebar
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;

  // ── Global filter (datovindu) — deles av rapport-sidene
  range: DateRange;
  setRange: (r: DateRange) => void;

  // ── Command palette (Cmd/Ctrl+K)
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;

  // ── Confirm-dialog (global)
  confirm: {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm?: () => void | Promise<void>;
  };
  openConfirm: (cfg: Omit<AppState["confirm"], "open">) => void;
  closeConfirm: () => void;
}

function initialThemeMode(): ThemeMode {
  const saved = Storage.get<ThemeMode | "">(Keys.themeMode, "");
  if (saved === "light" || saved === "dark") return saved;
  if (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
    return "dark";
  return "light";
}

export const useApp = create<AppState>((set, get) => ({
  session: null,
  setSession: (s) => set({ session: s }),
  setUser: (u) =>
    set((st) =>
      st.session ? { session: { ...st.session, user: u } } : st,
    ),
  setTenant: (t) =>
    set((st) =>
      st.session ? { session: { ...st.session, tenant: t } } : st,
    ),

  themeMode: initialThemeMode(),
  setThemeMode: (m) => {
    Storage.set(Keys.themeMode, m);
    applyThemeMode(m);
    set({ themeMode: m });
  },
  toggleTheme: () => {
    const next = get().themeMode === "dark" ? "light" : "dark";
    get().setThemeMode(next);
  },

  sidebarCollapsed: Storage.get<boolean>(Keys.sidebarCollapsed, false),
  setSidebarCollapsed: (v) => {
    Storage.set(Keys.sidebarCollapsed, v);
    set({ sidebarCollapsed: v });
  },

  range: buildRange(
    Storage.get<DateRange["preset"]>(Keys.rangePreference, "last_7"),
  ),
  setRange: (r) => {
    Storage.set(Keys.rangePreference, r.preset);
    set({ range: r });
  },

  paletteOpen: false,
  setPaletteOpen: (v) => set({ paletteOpen: v }),

  confirm: {
    open: false,
    title: "",
    message: "",
  },
  openConfirm: (cfg) =>
    set({
      confirm: {
        open: true,
        title: cfg.title,
        message: cfg.message,
        confirmLabel: cfg.confirmLabel,
        cancelLabel: cfg.cancelLabel,
        danger: cfg.danger,
        onConfirm: cfg.onConfirm,
      },
    }),
  closeConfirm: () =>
    set((st) => ({ confirm: { ...st.confirm, open: false } })),
}));
