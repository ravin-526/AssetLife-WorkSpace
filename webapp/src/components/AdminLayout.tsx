import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Box,
  Button,
  Drawer,
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
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DashboardIcon from "@mui/icons-material/Dashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import AssessmentIcon from "@mui/icons-material/Assessment";
import GroupIcon from "@mui/icons-material/Group";
import MenuIcon from "@mui/icons-material/Menu";
import SearchIcon from "@mui/icons-material/Search";
import SettingsIcon from "@mui/icons-material/Settings";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";

import { COLORS, HEADER_HEIGHT, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from "../styles/theme.ts";
import { LOGO } from "../constants/logo.ts";
import useUserStore from "../store/userStore.ts";

type MenuItemConfig = {
  label: string;
  path: string;
  icon: JSX.Element;
};

const menuItems: MenuItemConfig[] = [
  { label: "Dashboard", path: "/dashboard", icon: <DashboardIcon /> },
  { label: "Assets", path: "/assets", icon: <Inventory2Icon /> },
  { label: "Reports", path: "/reports", icon: <AssessmentIcon /> },
  { label: "Users", path: "/users", icon: <GroupIcon /> },
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

  useEffect(() => {
    setActivePath(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    setCollapsed(isSmallScreen);
  }, [isSmallScreen]);

  const drawerWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;
  const borderColor = muiTheme.palette.divider;

  const transitionStyle = useMemo(
    () =>
      muiTheme.transitions.create(["width", "left"], {
        easing: muiTheme.transitions.easing.sharp,
        duration: muiTheme.transitions.duration.shorter,
      }),
    [muiTheme]
  );

  const userDisplayName = user?.name || "User";

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchor(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchor(null);
  };

  const handleProfile = () => {
    handleUserMenuClose();
    navigate("/users");
  };

  const handleLogout = () => {
    handleUserMenuClose();
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          transition: transitionStyle,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            bgcolor: "background.paper",
            borderRight: `1px solid ${borderColor}`,
            overflowX: "hidden",
            transition: transitionStyle,
            pt: 2,
          },
        }}
      >
        <Box
          sx={{
            minHeight: HEADER_HEIGHT,
            px: 1.5,
            py: 1,
            borderBottom: `1px solid ${borderColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 1,
          }}
        >
          <Box
            component="img"
            src={LOGO}
            alt="AssetLife Logo"
            sx={{
              width: 32,
              height: 32,
              display: "block",
              mr: collapsed ? 0 : 1,
            }}
          />
          {!collapsed ? (
            <Typography
              variant="h2"
              sx={{
                fontSize: muiTheme.typography.h2.fontSize,
                lineHeight: 1,
                color: "text.primary",
              }}
            >
              AssetLife
            </Typography>
          ) : null}
        </Box>

        <List sx={{ px: 1.5 }}>
          {menuItems.map((item) => {
            const selected = activePath === item.path;

            return (
              <ListItemButton
                key={item.path}
                component={NavLink}
                to={item.path}
                selected={selected}
                onClick={() => setActivePath(item.path)}
                sx={{
                  mb: 1,
                  borderRadius: 2,
                  minHeight: 36,
                  py: 0.25,
                  justifyContent: collapsed ? "center" : "flex-start",
                  bgcolor: selected ? muiTheme.palette.primary.main : "transparent",
                  color: selected ? muiTheme.palette.primary.contrastText : "text.secondary",
                  "&:hover": {
                    bgcolor: selected ? muiTheme.palette.primary.main : "action.hover",
                  },
                }}
              >
                <Tooltip title={collapsed ? item.label : ""} placement="right">
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 36,
                      mr: collapsed ? 0 : 1,
                      color: selected ? muiTheme.palette.primary.contrastText : "text.secondary",
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
                      sx: { lineHeight: 0.5 },
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
            borderBottom: `1px solid ${borderColor}`,
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
                border: `1px solid ${borderColor}`,
                px: 1.5,
                py: 0.5,
                borderRadius: 2,
                minWidth: { xs: 150, sm: 220 },
                maxWidth: { xs: "100%", md: 280 },
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
                gap: 1,
                flexWrap: { xs: "wrap", md: "nowrap" },
              }}
            >

              <IconButton onClick={() => console.log("Settings clicked")}>
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
      </Box>
    </Box>
  );
};

export default AdminLayout;
