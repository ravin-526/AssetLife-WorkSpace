import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Drawer,
  Fab,
  IconButton,
  InputBase,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
  SpeedDial,
  SpeedDialAction,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DashboardIcon from "@mui/icons-material/Dashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AlarmIcon from "@mui/icons-material/Alarm";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TableChartOutlinedIcon from "@mui/icons-material/TableChartOutlined";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import AddIcon from "@mui/icons-material/Add";

import theme, { COLORS, HEADER_HEIGHT, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH, SPACING, getTheme } from "../styles/theme";
import { LOGO } from "../constants/logo.ts";
import useUserStore from "../store/userStore.ts";

type MenuItemConfig = {
  label: string;
  to?: string;
  icon?: JSX.Element;
  children?: MenuItemConfig[];
  match?: (pathname: string, search: string) => boolean;
};

const menuItems: MenuItemConfig[] = [
  { label: "Dashboard", to: "/dashboard", icon: <DashboardIcon /> },
  {
    label: "Assets",
    icon: <Inventory2Icon />,
    children: [
      {
        label: "View Assets",
        to: "/assets",
        match: (pathname: string) => pathname === "/assets",
      },
      {
        label: "Add Assets",
        to: "/assets/add?method=email_sync",
        match: (pathname: string) => pathname === "/assets/add",
        children: [
          {
            label: "Email Sync",
            to: "/assets/add?method=email_sync",
            match: (pathname: string, search: string) => pathname === "/assets/add" && search.includes("method=email_sync"),
          },
          {
            label: "Invoice Upload",
            to: "/assets/add?method=invoice_upload",
            match: (pathname: string, search: string) => pathname === "/assets/add" && search.includes("method=invoice_upload"),
          },
          {
            label: "Excel Upload",
            to: "/assets/add?method=excel_upload",
            match: (pathname: string, search: string) => pathname === "/assets/add" && search.includes("method=excel_upload"),
          },
          {
            label: "Barcode / QR Code Scan",
            to: "/assets/add?method=barcode_qr",
            match: (pathname: string, search: string) => pathname === "/assets/add" && search.includes("method=barcode_qr"),
          },
          {
            label: "Manual Entry",
            to: "/assets/add?method=manual_entry",
            match: (pathname: string, search: string) => pathname === "/assets/add" && search.includes("method=manual_entry"),
          },
        ],
      },
    ],
  },
  { label: "Reminders", to: "/reminders", icon: <AlarmIcon /> },
];

type AdminLayoutProps = {
  mode: "light" | "dark";
  onToggleTheme: () => void;
};

const AdminLayout = ({ mode, onToggleTheme }: AdminLayoutProps) => {
  const muiTheme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isSmallScreen = useMediaQuery(muiTheme.breakpoints.down("md"));

  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);

  const [collapsed, setCollapsed] = useState(false);
  const [activePath, setActivePath] = useState("/dashboard");
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [addAssetDialOpen, setAddAssetDialOpen] = useState(false);
  const [mainFabHovered, setMainFabHovered] = useState(false);
  const [assetsMenuOpen, setAssetsMenuOpen] = useState(true);
  const [addAssetsMenuOpen, setAddAssetsMenuOpen] = useState(true);
  const [expandedDrawerWidth, setExpandedDrawerWidth] = useState(SIDEBAR_WIDTH);
  const [isScrolling, setIsScrolling] = useState(false);

  const addAssetActions = [
    { name: "Manual Entry", icon: <EditOutlinedIcon />, mode: "manual" },
    { name: "Email Sync", icon: <MailOutlineIcon />, mode: "email" },
    { name: "Upload Invoice", icon: <ReceiptLongOutlinedIcon />, mode: "invoice" },
    { name: "Excel Upload", icon: <TableChartOutlinedIcon />, mode: "excel" },
    { name: "QR / Barcode Scan", icon: <QrCodeScannerOutlinedIcon />, mode: "qr" },
  ] as const;
  const drawerPaperRef = useRef<HTMLDivElement | null>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolling(true);
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
      scrollTimerRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 200);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setActivePath(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname.startsWith("/assets")) {
      setAssetsMenuOpen(true);
      setAddAssetsMenuOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    setCollapsed(isSmallScreen);
  }, [isSmallScreen]);

  useEffect(() => {
    if (collapsed) {
      return;
    }

    const timer = window.setTimeout(() => {
      const paper = drawerPaperRef.current;
      if (!paper) {
        return;
      }

      const measuredWidth = Math.ceil(paper.scrollWidth + 8);
      const constrainedWidth = Math.max(SIDEBAR_WIDTH, Math.min(measuredWidth, 360));
      setExpandedDrawerWidth(constrainedWidth);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [addAssetsMenuOpen, assetsMenuOpen, collapsed, location.pathname, location.search]);

  const drawerWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : expandedDrawerWidth;
  const sidebarBorderColor = COLORS.SIDEBAR_BORDER;
  const headerBorderColor = COLORS.HEADER_BORDER;

  const transitionStyle = useMemo(
    () =>
      muiTheme.transitions.create(["width", "left"], {
        easing: muiTheme.transitions.easing.sharp,
        duration: muiTheme.transitions.duration.shorter,
      }),
    [muiTheme]
  );
  const layoutTheme = useMemo(() => getTheme(mode), [mode]);
  const isReminderShortcutVisible = mainFabHovered;
  const mainFabSize = 56;
  const fabGap = 10;

  const userDisplayName = user?.name || "User";

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleProfile = () => {
    handleUserMenuClose();
    navigate("/profile");
  };

  const handleSettings = () => {
    navigate("/settings");
  };

  const handleLogout = () => {
    handleUserMenuClose();
    logout();
    navigate("/login", { replace: true });
  };

  const isItemActive = (item: MenuItemConfig): boolean => {
    if (item.match) {
      return item.match(location.pathname, location.search);
    }
    if (item.to) {
      const [pathOnly] = item.to.split("?");
      return location.pathname === pathOnly;
    }
    return (item.children || []).some((child) => isItemActive(child));
  };

  const baseItemSx = {
    mb: `${SPACING(0.5)}px`,
    borderRadius: 2,
    minHeight: 32,
    py: `${SPACING(0.5)}px`,
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Drawer
        variant="permanent"
        PaperProps={{ ref: drawerPaperRef }}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          transition: transitionStyle,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: "background.paper",
            borderRight: `1px solid ${sidebarBorderColor}`,
            overflowX: "hidden",
            transition: transitionStyle,
            pt: 0,
          },
        }}
      >
        <Box
          sx={{
            height: HEADER_HEIGHT,
            px: `${SPACING(1.5)}px`,
            pb: `${SPACING(1.5)}px`,
            mb: 0,
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: `${SPACING(1)}px`,
            boxSizing: "border-box",
          }}
        >
          <Box
            component="img"
            src={LOGO}
            alt="AssetLife Logo"
            sx={{
              width: 48,
              height: 48,
              display: "block",
              mr: collapsed ? 0 : 1,
            }}
          />
          {!collapsed ? (
            <Typography
              variant="h2"
              sx={{
                fontSize: theme.sidebar.brandNameSize,
                lineHeight: 1,
                color: "text.primary",
              }}
            >
              <span className="brand-gradient">AssetLife</span>
            </Typography>
          ) : null}
        </Box>

        <List sx={{ px: 1.5 }}>
          {menuItems.map((item) => {
            const selected = isItemActive(item);

            if (item.label === "Assets") {
              return (
                <Box key="assets-root">
                  <ListItemButton
                    onClick={() => {
                      if (collapsed) {
                        setCollapsed(false);
                        setAssetsMenuOpen(true);
                        return;
                      }
                      setAssetsMenuOpen((prev) => !prev);
                    }}
                    sx={{
                      ...baseItemSx,
                      justifyContent: collapsed ? "center" : "flex-start",
                      bgcolor: collapsed && selected ? COLORS.SIDEBAR_ACTIVE : "transparent",
                      color: collapsed && selected ? layoutTheme.palette.primary.contrastText : "text.secondary",
                      "&:hover": {
                        bgcolor: collapsed && selected ? COLORS.SIDEBAR_ACTIVE : "action.hover",
                      },
                    }}
                  >
                    <Tooltip title={collapsed ? item.label : ""} placement="right">
                      <ListItemIcon
                        sx={{
                          minWidth: collapsed ? 0 : 36,
                          mr: collapsed ? 0 : 1,
                          color: collapsed && selected ? layoutTheme.palette.primary.contrastText : "text.secondary",
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                    </Tooltip>
                    {!collapsed ? (
                      <>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            variant: "h6",
                            sx: {
                              lineHeight: theme.sidebar.menuLineHeight,
                              whiteSpace: "normal",
                              overflowWrap: "anywhere",
                            },
                          }}
                        />
                        {assetsMenuOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </>
                    ) : null}
                  </ListItemButton>

                  {!collapsed ? (
                    <Collapse in={assetsMenuOpen} timeout="auto" unmountOnExit>
                      <List component="div" disablePadding>
                        <ListItemButton
                          component={NavLink}
                          to="/assets"
                          selected={isItemActive({ label: "View Assets", to: "/assets", match: (pathname) => pathname === "/assets" })}
                          sx={{
                            ...baseItemSx,
                            pl: 5,
                            color: isItemActive({ label: "View Assets", to: "/assets", match: (pathname) => pathname === "/assets" })
                              ? layoutTheme.palette.primary.contrastText
                              : "text.secondary",
                            bgcolor: isItemActive({ label: "View Assets", to: "/assets", match: (pathname) => pathname === "/assets" })
                              ? COLORS.SIDEBAR_ACTIVE
                              : "transparent",
                            "&:hover": {
                              bgcolor: isItemActive({ label: "View Assets", to: "/assets", match: (pathname) => pathname === "/assets" })
                                ? COLORS.SIDEBAR_ACTIVE
                                : "action.hover",
                            },
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              minWidth: 28,
                              color: isItemActive({ label: "View Assets", to: "/assets", match: (pathname) => pathname === "/assets" })
                                ? layoutTheme.palette.primary.contrastText
                                : "text.secondary",
                            }}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary="View Assets"
                            primaryTypographyProps={{
                              variant: "h6",
                              sx: {
                                whiteSpace: "normal",
                                overflowWrap: "anywhere",
                              },
                            }}
                          />
                        </ListItemButton>

                        <ListItemButton
                          onClick={() => setAddAssetsMenuOpen((prev) => !prev)}
                          sx={{
                            ...baseItemSx,
                            pl: 5,
                            color: "text.secondary",
                            bgcolor: "transparent",
                            "&:hover": {
                              bgcolor: "action.hover",
                            },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 28, color: "text.secondary" }}>
                            <AddCircleOutlineIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Add Assets"
                            primaryTypographyProps={{
                              variant: "h6",
                              sx: {
                                whiteSpace: "normal",
                                overflowWrap: "anywhere",
                              },
                            }}
                          />
                          {addAssetsMenuOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                        </ListItemButton>

                        <Collapse in={addAssetsMenuOpen} timeout="auto" unmountOnExit>
                          <List component="div" disablePadding>
                            {[
                              { label: "Email Sync", query: "email_sync", icon: <MailOutlineIcon fontSize="small" /> },
                              { label: "Invoice Upload", query: "invoice_upload", icon: <ReceiptLongOutlinedIcon fontSize="small" /> },
                              { label: "Excel Upload", query: "excel_upload", icon: <TableChartOutlinedIcon fontSize="small" /> },
                              { label: "Barcode / QR Code Scan", query: "barcode_qr", icon: <QrCodeScannerOutlinedIcon fontSize="small" /> },
                              { label: "Manual Entry", query: "manual_entry", icon: <EditOutlinedIcon fontSize="small" /> },
                            ].map((option) => {
                              const to = `/assets/add?method=${option.query}`;
                              const isAddAssetPage = location.pathname === "/assets/add";
                              const selectedMethod = isAddAssetPage
                                && (location.search.includes(`method=${option.query}`) || (!location.search && option.query === "email_sync"));
                              return (
                                <ListItemButton
                                  key={option.query}
                                  component={NavLink}
                                  to={to}
                                  selected={selectedMethod}
                                  sx={{
                                    ...baseItemSx,
                                    pl: 8,
                                    color: selectedMethod ? layoutTheme.palette.primary.contrastText : "text.secondary",
                                    bgcolor: selectedMethod ? COLORS.SIDEBAR_ACTIVE : "transparent",
                                    "&:hover": {
                                      bgcolor: selectedMethod ? COLORS.SIDEBAR_ACTIVE : "action.hover",
                                    },
                                  }}
                                >
                                  <ListItemIcon
                                    sx={{
                                      minWidth: 26,
                                      color: selectedMethod ? layoutTheme.palette.primary.contrastText : "text.secondary",
                                    }}
                                  >
                                    {option.icon}
                                  </ListItemIcon>
                                  <ListItemText
                                    primary={option.label}
                                    primaryTypographyProps={{
                                      variant: "h6",
                                      sx: {
                                        whiteSpace: "normal",
                                        overflowWrap: "anywhere",
                                        lineHeight: 1.25,
                                      },
                                    }}
                                  />
                                </ListItemButton>
                              );
                            })}
                          </List>
                        </Collapse>
                      </List>
                    </Collapse>
                  ) : null}
                </Box>
              );
            }

            return (
              <ListItemButton
                key={item.to || item.label}
                component={NavLink}
                to={item.to || "/dashboard"}
                selected={selected}
                onClick={() => setActivePath(item.to || "/dashboard")}
                sx={{
                  ...baseItemSx,
                  justifyContent: collapsed ? "center" : "flex-start",
                  bgcolor: selected ? COLORS.SIDEBAR_ACTIVE : "transparent",
                  color: selected ? layoutTheme.palette.primary.contrastText : "text.secondary",
                  "&:hover": {
                    bgcolor: selected ? COLORS.SIDEBAR_ACTIVE : "action.hover",
                  },
                }}
              >
                <Tooltip title={collapsed ? item.label : ""} placement="right">
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 36,
                      mr: collapsed ? 0 : 1,
                      color: selected ? layoutTheme.palette.primary.contrastText : "text.secondary",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                </Tooltip>

                {!collapsed ? (
                  <ListItemText
                    primary={item.label}
                    primaryTypographyProps={{
                      variant: "h6",
                      sx: {
                        lineHeight: theme.sidebar.menuLineHeight,
                        whiteSpace: "normal",
                        overflowWrap: "anywhere",
                      },
                    }}
                  />
                ) : null}
              </ListItemButton>
            );
          })}
        </List>
      </Drawer>

      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <AppBar
          position="fixed"
          elevation={0}
          sx={{
            left: drawerWidth,
            width: `calc(100% - ${drawerWidth}px)`,
            height: HEADER_HEIGHT,
            bgcolor: mode === "light" ? COLORS.LIGHT_HEADER : COLORS.DARK_HEADER,
            color: "text.primary",
            borderBottom: "1px solid",
            borderColor: "divider",
            boxShadow: "none",
            transition: transitionStyle,
          }}
        >
          <Toolbar
            sx={{
              minHeight: `${HEADER_HEIGHT}px !important`,
              px: 2,
              display: "flex",
              alignItems: "center",
              gap: { xs: 1, md: 2 },
              flexWrap: { xs: "wrap", md: "nowrap" },
            }}
          >
            <IconButton
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <MenuIcon />
            </IconButton>

            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                bgcolor: "background.paper",
                border: `1px solid ${headerBorderColor}`,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                minWidth: { xs: 150, sm: 220 },
                maxWidth: { xs: "100%", md: theme.header.searchBoxWidth },
                flex: { xs: "1 1 220px", md: "0 0 auto" },
              }}
            >
              <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
              <InputBase placeholder="Search..." sx={{ fontSize: 14, width: "100%" }} />
            </Box>

            <Box
              sx={{
                ml: { xs: 0, md: "auto" },
                width: { xs: "100%", md: "auto" },
                display: "flex",
                alignItems: "center",
                justifyContent: { xs: "space-between", md: "flex-end" },
                gap: theme.header.iconSpacing,
                flexWrap: { xs: "wrap", md: "nowrap" },
              }}
            >

              <IconButton onClick={handleSettings} aria-label="Open settings">
                <SettingsIcon />
              </IconButton>

              <IconButton onClick={onToggleTheme} aria-label="Toggle theme">
                {mode === "light" ? <DarkModeIcon /> : <LightModeIcon />}
              </IconButton>

              <Button
                onClick={handleUserMenuOpen}
                endIcon={<KeyboardArrowDownIcon />}
                sx={{
                  color: "text.primary",
                  fontWeight: 500,
                  px: 1,
                  minWidth: "auto",
                }}
              >
                {`Welcome, ${userDisplayName}`}
              </Button>

              <Menu
                anchorEl={userMenuAnchor}
                open={Boolean(userMenuAnchor)}
                onClose={handleUserMenuClose}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                transformOrigin={{ vertical: "top", horizontal: "right" }}
              >
                <MenuItem onClick={handleProfile}>Profile</MenuItem>
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{
            mt: `${HEADER_HEIGHT}px`,
            p: { xs: 2, md: 3 },
            bgcolor: "background.default",
            minHeight: `calc(100vh - ${HEADER_HEIGHT}px)`,
          }}
        >
          <Outlet />
        </Box>

        <Box
          sx={{
            position: "fixed",
            right: 24,
            bottom: 24,
            width: mainFabSize * 2 + fabGap + 60,
            height: mainFabSize,
            pl: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            zIndex: muiTheme.zIndex.modal - 1,
            opacity: isScrolling ? 0.1 : 0.85,
            transition: "opacity 0.25s ease",
          }}
          onMouseEnter={() => setMainFabHovered(true)}
          onMouseLeave={() => setMainFabHovered(false)}
        >
          <Fab
            size="large"
            color="primary"
            aria-label="Add Reminder"
            onClick={() => {
              setAddAssetDialOpen(false);
              navigate("/reminders", { state: { openCreate: true } });
            }}
            sx={{
              position: "absolute",
              right: mainFabSize + fabGap,
              bottom: 0,
              visibility: isReminderShortcutVisible ? "visible" : "hidden",
              pointerEvents: isReminderShortcutVisible ? "auto" : "none",
              opacity: isReminderShortcutVisible ? 1 : 0,
              transform: isReminderShortcutVisible ? "translateX(0)" : "translateX(10px)",
              transition: "opacity 0.22s ease, transform 0.22s ease",
              boxShadow: muiTheme.shadows[8],
              "&:hover": {
                transform: "scale(1.06)",
                boxShadow: muiTheme.shadows[12],
              },
            }}
          >
            <AlarmIcon />
          </Fab>

          <SpeedDial
            ariaLabel="Add Asset"
            icon={<AddIcon />}
            onClose={() => {
              setAddAssetDialOpen(false);
            }}
            onOpen={() => setAddAssetDialOpen(true)}
            open={addAssetDialOpen}
            sx={{
              position: "absolute",
              right: 0,
              bottom: 0,
              "& .MuiFab-primary": {
                boxShadow: muiTheme.shadows[8],
                transition: "transform 0.25s ease, box-shadow 0.25s ease",
              },
              "& .MuiFab-primary:hover": {
                transform: "scale(1.06)",
                boxShadow: muiTheme.shadows[12],
              },
            }}
          >
            {addAssetActions.map((action) => (
              <SpeedDialAction
                key={action.name}
                icon={action.icon}
                tooltipTitle={action.name}
                tooltipOpen={isSmallScreen}
                onClick={() => {
                  setAddAssetDialOpen(false);
                  setMainFabHovered(false);
                  navigate(`/assets/add?mode=${action.mode}`);
                }}
              />
            ))}
          </SpeedDial>
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;
