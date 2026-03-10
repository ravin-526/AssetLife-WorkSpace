export type ThemeColors = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  error: string;
  success: string;
};

export type ThemeFonts = {
  fontFamily: string;
  fontSizes: {
    heading: string;
    subheading: string;
    body: string;
    caption: string;
  };
  fontWeights: {
    regular: number;
    medium: number;
    bold: number;
  };
};

export type ThemeSpacing = {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
};

export type ThemeBorderRadius = {
  sm: string;
  md: string;
  lg: string;
};

export const colors: ThemeColors = {
  primary: "#1D4ED8",
  secondary: "#9333EA",
  accent: "#F59E0B",
  background: "#F3F4F6",
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  error: "#DC2626",
  success: "#16A34A",
};

export const fonts: ThemeFonts = {
  fontFamily: "Inter, sans-serif",
  fontSizes: {
    heading: "2rem",
    subheading: "1.5rem",
    body: "1rem",
    caption: "0.875rem",
  },
  fontWeights: {
    regular: 400,
    medium: 500,
    bold: 700,
  },
};

export const spacing: ThemeSpacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
};

export const borderRadius: ThemeBorderRadius = {
  sm: "4px",
  md: "8px",
  lg: "12px",
};

export const buttons = {
  primary: {
    background: colors.primary,
    text: "#FFFFFF",
    borderRadius: borderRadius.md,
  },
  secondary: {
    background: colors.secondary,
    text: "#FFFFFF",
    borderRadius: borderRadius.md,
  },
  disabled: {
    background: "#D1D5DB",
    text: "#9CA3AF",
  },
} as const;

export const inputs = {
  border: "#D1D5DB",
  focus: colors.primary,
  error: colors.error,
  borderRadius: borderRadius.md,
} as const;

export const cards = {
  background: "#FFFFFF",
  borderRadius: borderRadius.lg,
  shadow: "0 1px 3px rgba(0,0,0,0.1)",
} as const;

const theme = {
  colors,
  fonts,
  spacing,
  borderRadius,
  buttons,
  inputs,
  cards,
} as const;

export type Theme = typeof theme;

export default theme;
