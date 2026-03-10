// webapp/src/styles/theme.ts
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
            '& .MuiInputBase-root': {
              borderRadius: SPACING(1),
              backgroundColor: isLight ? COLORS.LIGHT_HEADER : COLORS.DARK_SIDEBAR,
              color: isLight ? COLORS.LIGHT_TEXT_PRIMARY : COLORS.DARK_TEXT_PRIMARY,
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
            paddingTop: SPACING(2),
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
      paddingTop: SPACING(0.5),      // further reduced
      paddingBottom: SPACING(0.5),   // further reduced
      lineHeight: 0.5,
      minHeight: 32,                 // ensure compactness
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
    },
  });
};