
import { createTheme } from '@mui/material/styles';
import { PaletteMode } from '@mui/material';

// Centralized colors
export const COLORS = {
  PRIMARY: '#17a2b8',
  LIGHT_BG: '#F9FAFB',
  LIGHT_SIDEBAR: '#F9FAFB',
  LIGHT_HEADER: '#FFFFFF',
  LIGHT_TEXT_PRIMARY: '#111827',
  LIGHT_TEXT_SECONDARY: '#4B5563',
  LIGHT_DIVIDER: '#E5E7EB',

  DARK_PRIMARY: '#17a2b8',
  DARK_BG: '#1F2937',
  DARK_SIDEBAR: '#111827',
  DARK_HEADER: '#111827',
  DARK_TEXT_PRIMARY: '#F9FAFB',
  DARK_TEXT_SECONDARY: '#D1D5DB',
  DARK_DIVIDER: '#374151',

  SIDEBAR_ACTIVE: '#17a2b8',
  SIDEBAR_INACTIVE: '#6B7280',
  HEADER_BORDER: '#D1D5DB',
  SIDEBAR_BORDER: '#D1D5DB',
};

// Spacing utility
export const SPACING_UNIT = 4;
export const SPACING = (n: number) => n * SPACING_UNIT;

// Sidebar & header sizes
export const SIDEBAR_WIDTH = 240;
export const SIDEBAR_COLLAPSED_WIDTH = 80;
export const HEADER_HEIGHT = 64;
export const DISABLED_FIELD = {
  LIGHT_BACKGROUND: '#F3F4F6',
  DARK_BACKGROUND: '#2D3748',
  TEXT: '#9CA3AF',
};

export const POST_LOGIN_THEME = {
  form: {
    groupSpacing: SPACING(2),
    rowSpacing: SPACING(1),
  },
  inputs: {
    postLogin: {
      height: 36,
      lineHeight: 1.25,
      fontSize: 14,
      placeholderFontSize: 13,
      padding: `${SPACING(1)}px ${SPACING(1.5)}px`,
      boxSizing: 'border-box' as const,
      width: '100%',
    },
    readOnly: {
      background: 'disabled.dynamicBackground',
      color: DISABLED_FIELD.TEXT,
      cursor: 'default' as const,
    },
  },
  buttons: {
    postLogin: {
      padding: `${SPACING(1.5)}px ${SPACING(3)}px`,
      fontSize: 14,
      height: 36,
    },
  },
  header: {
    searchBoxWidth: 320,
    iconSpacing: SPACING(1),
  },
  sidebar: {
    brandNameSize: '1.8rem',
    menuLineHeight: 0.5,
  },
};

// Theme generator
export const getTheme = (mode: PaletteMode) => {
  const isLight = mode === 'light';
  return createTheme({
    palette: {
      mode,
      primary: {
        main: COLORS.PRIMARY,
        contrastText: isLight ? COLORS.LIGHT_HEADER : COLORS.DARK_TEXT_PRIMARY,
      },
      background: {
        default: isLight ? COLORS.LIGHT_BG : COLORS.DARK_BG,
        paper: isLight ? COLORS.LIGHT_SIDEBAR : COLORS.DARK_SIDEBAR,
      },
      text: {
        primary: isLight ? COLORS.LIGHT_TEXT_PRIMARY : COLORS.DARK_TEXT_PRIMARY,
        secondary: isLight ? COLORS.LIGHT_TEXT_SECONDARY : COLORS.DARK_TEXT_SECONDARY,
      },
      divider: isLight ? COLORS.LIGHT_DIVIDER : COLORS.DARK_DIVIDER,
    },
    typography: {
      fontFamily: '"Inter", "Roboto", sans-serif',
      h1: { fontSize: '32px', fontWeight: 700, lineHeight: 1.2 },
      h2: { fontSize: '1.8rem', fontWeight: 700, lineHeight: 1.2 }, // Brand name
      h3: { fontSize: '24px', fontWeight: 600, lineHeight: 1.3 },
      h4: { fontSize: '20px', fontWeight: 600, lineHeight: 1.3 },
      h5: { fontSize: '16px', fontWeight: 500, lineHeight: 1.4 },
      h6: { fontSize: '14px', fontWeight: 500, lineHeight: 0.5 }, // Nav menu line height
      body1: { fontSize: isLight ? '14px' : '15px', fontWeight: 400, lineHeight: 1.5 },
      body2: { fontSize: isLight ? '12px' : '14px', fontWeight: 400, lineHeight: 1.4 },
      button: { textTransform: 'none', fontWeight: 600, fontSize: isLight ? '14px' : '15px' },
    },
    spacing: SPACING_UNIT,
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: SPACING(2),
            padding: `${SPACING(1.5)}px ${SPACING(3)}px`,
            fontSize: isLight ? '14px' : '15px',
          },
          containedPrimary: {
            backgroundColor: COLORS.PRIMARY,
            color: isLight ? COLORS.LIGHT_HEADER : COLORS.DARK_TEXT_PRIMARY,
            '&:hover': { backgroundColor: '#138796' },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '&.postLogin .MuiInputBase-root': {
              borderRadius: SPACING(1),
              backgroundColor: isLight ? COLORS.LIGHT_HEADER : COLORS.DARK_SIDEBAR,
              color: isLight ? COLORS.LIGHT_TEXT_PRIMARY : COLORS.DARK_TEXT_PRIMARY,
              minHeight: 36,
              alignItems: 'center',
            },
            '&.postLogin .MuiInputBase-input': {
              fontSize: POST_LOGIN_THEME.inputs.postLogin.fontSize,
              lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
              padding: `${SPACING(0.75)}px ${SPACING(1.25)}px`,
              boxSizing: POST_LOGIN_THEME.inputs.postLogin.boxSizing,
            },
            '&.postLogin .MuiInputBase-input::placeholder': {
              lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
              opacity: 1,
            },
            '&.postLogin.readOnly .MuiInputBase-root, &.postLogin .MuiInputBase-root.Mui-disabled': {
              backgroundColor: isLight ? '#E5E7EB' : '#2A2A2A',
              color: DISABLED_FIELD.TEXT,
            },
            '&.postLogin.readOnly .MuiInputBase-input, &.postLogin .MuiInputBase-root.Mui-disabled .MuiInputBase-input': {
              color: DISABLED_FIELD.TEXT,
              WebkitTextFillColor: DISABLED_FIELD.TEXT,
              lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
            },
            '&.postLogin.readOnly .MuiInputBase-input::placeholder, &.postLogin .MuiInputBase-root.Mui-disabled .MuiInputBase-input::placeholder': {
              color: DISABLED_FIELD.TEXT,
              lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
              opacity: 1,
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            height: HEADER_HEIGHT,
            backgroundColor: isLight ? COLORS.LIGHT_HEADER : COLORS.DARK_HEADER,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            borderBottom: `1px solid ${COLORS.HEADER_BORDER}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            width: SIDEBAR_WIDTH,
            backgroundColor: isLight ? COLORS.LIGHT_SIDEBAR : COLORS.DARK_SIDEBAR,
            borderRight: `1px solid ${COLORS.SIDEBAR_BORDER}`,
            transition: 'width 0.3s',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: SPACING(1),
            marginBottom: SPACING(0.5),
            paddingTop: SPACING(0.5),
            paddingBottom: SPACING(0.5),
            lineHeight: 0.5,
            minHeight: 32,
            '&.Mui-selected': {
              backgroundColor: COLORS.SIDEBAR_ACTIVE,
              color: isLight ? COLORS.LIGHT_HEADER : COLORS.DARK_TEXT_PRIMARY,
              '&:hover': { backgroundColor: COLORS.SIDEBAR_ACTIVE },
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            padding: SPACING(1),
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            minWidth: 150, // Dropdown for user menu
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            backgroundColor: isLight ? 'transparent' : '#1f2937',
            borderBottom: isLight ? undefined : '1px solid #374151',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            color: isLight ? undefined : '#e5e7eb',
            fontWeight: 600,
            borderBottom: isLight ? undefined : '1px solid #374151',
          },
        },
      },
      MuiTableSortLabel: {
        styleOverrides: {
          root: {
            color: isLight ? undefined : '#e5e7eb',
            '&.Mui-active': {
              color: isLight ? undefined : '#e5e7eb',
            },
          },
          icon: {
            color: isLight ? undefined : '#e5e7eb !important',
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          '.MuiDataGrid-columnHeaders': {
            backgroundColor: isLight ? undefined : '#1f2937',
            borderBottom: isLight ? undefined : '1px solid #374151',
          },
          '.MuiDataGrid-columnHeaderTitle': {
            color: isLight ? undefined : '#e5e7eb',
            fontWeight: 600,
          },
          '.MuiDataGrid-sortIcon, .MuiDataGrid-menuIconButton, .MuiDataGrid-iconSeparator': {
            color: isLight ? undefined : '#e5e7eb',
          },
        },
      },
    },
  });
};

const theme = {
  ...POST_LOGIN_THEME,
  form: POST_LOGIN_THEME.form,
  header: POST_LOGIN_THEME.header,
  sidebar: POST_LOGIN_THEME.sidebar,
  colors: {
    primary: COLORS.PRIMARY,
    background: COLORS.LIGHT_BG,
    surface: COLORS.LIGHT_HEADER,
    border: COLORS.LIGHT_DIVIDER,
    text: COLORS.LIGHT_TEXT_PRIMARY,
    textPrimary: COLORS.LIGHT_TEXT_PRIMARY,
    textSecondary: COLORS.LIGHT_TEXT_SECONDARY,
    textMuted: COLORS.LIGHT_TEXT_SECONDARY,
    mutedText: COLORS.LIGHT_TEXT_SECONDARY,
    error: '#DC2626',
  },
  spacing: {
    xs: `${SPACING(1)}px`,
    sm: `${SPACING(2)}px`,
    md: `${SPACING(3)}px`,
    lg: `${SPACING(4)}px`,
    xl: `${SPACING(6)}px`,
  },
  fonts: {
    family: '"Inter", "Roboto", sans-serif',
    fontFamily: '"Inter", "Roboto", sans-serif',
    headingSize: '2rem',
    bodySize: '14px',
    labelSize: '12px',
    fontSizes: {
      heading: '2rem',
      subheading: '1.125rem',
      body: '14px',
      caption: '12px',
    },
    fontWeights: {
      medium: 500,
      bold: 700,
    },
  },
  cards: {
    background: COLORS.LIGHT_HEADER,
    borderRadius: '12px',
    shadow: '0 10px 24px rgba(17, 24, 39, 0.08)',
  },
  buttons: {
    ...POST_LOGIN_THEME.buttons,
    height: '44px',
    radius: '8px',
    fontWeight: 600,
    primary: {
      borderRadius: '8px',
      background: COLORS.PRIMARY,
      text: '#FFFFFF',
    },
    secondary: {
      background: '#2563EB',
      text: '#FFFFFF',
    },
    disabled: {
      background: '#9CA3AF',
      text: '#F9FAFB',
    },
  },
  inputs: {
    ...POST_LOGIN_THEME.inputs,
    borderRadius: '8px',
    border: COLORS.LIGHT_DIVIDER,
    error: '#DC2626',
    disabled: {
      lightBackground: DISABLED_FIELD.LIGHT_BACKGROUND,
      darkBackground: DISABLED_FIELD.DARK_BACKGROUND,
      text: DISABLED_FIELD.TEXT,
    },
  },
};

export default theme;
