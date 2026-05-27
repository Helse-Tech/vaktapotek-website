// /src/theme.ts
//
// Sentralt tema-system. Tailwind-klasser leser fra CSS-variabler i
// styles.css, men når vi trenger farger/spacing direkte i JS (Recharts,
// inline SVG, dynamiske gradienter) henter vi dem her.

export type ThemeMode = "light" | "dark";

export const ANIMATION = {
  fast: 120,
  normal: 180,
  slow: 260,
  // CSS easing
  ease: "cubic-bezier(0.2, 0.8, 0.2, 1)",
};

export const SPACING = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  huge: 64,
  massive: 96,
};

export const RADII = {
  xs: 4,
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  round: 9999,
};

/** Brukes til Recharts og inline-SVG som ikke kan lese CSS-variabler. */
export const PALETTE = {
  light: {
    bg: "#F5F7FA",
    surface: "#FFFFFF",
    elevated: "#FFFFFF",
    pressed: "#EFF3F8",
    border: "#E2E8F0",
    divider: "#EBF0F6",
    text: "#0F172A",
    muted: "#475569",
    subtle: "#64748B",
    primary: "#1056A1",
    primaryHover: "#0D4786",
    primarySoft: "#E0EBF8",
    accent: "#0891B2",
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
    info: "#2563EB",
    reseptA: "#DC2626",
    reseptB: "#D97706",
    reseptC: "#16A34A",
    ventral: "#1056A1",
  },
  dark: {
    bg: "#0B0F17",
    surface: "#121823",
    elevated: "#181F2D",
    pressed: "#1E2738",
    border: "#273247",
    divider: "#20293B",
    text: "#F1F5F9",
    muted: "#94A3B8",
    subtle: "#64748B",
    primary: "#60A5FA",
    primaryHover: "#79B8FF",
    primarySoft: "#1C2F50",
    accent: "#38BDDC",
    success: "#4ADE80",
    warning: "#FBBF24",
    danger: "#F87171",
    info: "#60A5FA",
    reseptA: "#F87171",
    reseptB: "#FBBF24",
    reseptC: "#4ADE80",
    ventral: "#79B8FF",
  },
} as const;

/** Hex-paletten for gjeldende mode (brukes av Recharts/SVG). */
export function modePalette(mode: ThemeMode) {
  return mode === "dark" ? PALETTE.dark : PALETTE.light;
}

/** Bytter mellom tema med jevn overgang (legg på `theme-transition`-klasse
 *  i ~250 ms så slipper vi blinking på SVG/Recharts). */
export function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  window.setTimeout(() => root.classList.remove("theme-transition"), 280);
}

/** Tilgangs-rolle UI-farger. */
export const ROLE_BADGE = {
  admin: { bg: "bg-primary-soft", fg: "text-primary" },
  med_ansvarlig: { bg: "bg-accent-soft", fg: "text-accent" },
  abc_prep: { bg: "bg-info-soft", fg: "text-info" },
  c_prep: { bg: "bg-success-soft", fg: "text-success" },
  dobbelsign: { bg: "bg-warning-soft", fg: "text-warning" },
} as const;

export const RESEPT_BADGE = {
  A: { bg: "bg-reseptA-soft", fg: "text-reseptA" },
  B: { bg: "bg-reseptB-soft", fg: "text-reseptB" },
  C: { bg: "bg-reseptC-soft", fg: "text-reseptC" },
  CF: { bg: "bg-reseptC-soft", fg: "text-reseptC" },
  K: { bg: "bg-surface", fg: "text-muted" },
} as const;

/** Skygge-stiger (Tailwind-klasser). */
export const SHADOW = {
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg",
  xl: "shadow-xl",
  glow: "shadow-glow",
} as const;

/** Standard sidebar-bredde og topp-bar-høyde. */
export const LAYOUT = {
  sidebarWidth: 264,
  sidebarCollapsed: 76,
  topbarHeight: 64,
  contentMaxWidth: 1440,
};
