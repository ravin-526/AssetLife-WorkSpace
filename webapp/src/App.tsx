import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CssBaseline, GlobalStyles, ThemeProvider } from "@mui/material";
import { useEffect, useMemo } from "react";

import AdminLayout from "./components/AdminLayout.tsx";
import PrivateRoute from "./components/PrivateRoute.tsx";
import AddAsset from "./pages/AddAsset.tsx";
import AssetSuggestions from "./pages/AssetSuggestions.tsx";
import Assets from "./pages/Assets.tsx";
import AssetView from "./pages/AssetView.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import EmailIntegrations from "./pages/EmailIntegrations.tsx";
import EmailScans from "./pages/EmailScans.tsx";
import IndividualLogin from "./pages/IndividualLogin.tsx";
import IndividualRegister from "./pages/IndividualRegister.tsx";
import Profile from "./pages/Profile.tsx";
import Reminders from "./pages/Reminders.tsx";
import Reports from "./pages/Reports.tsx";
import Settings from "./pages/Settings.tsx";
import Users from "./pages/Users.tsx";
import api from "./services/api.ts";
import useUserStore from "./store/userStore.ts";
import { getTheme } from "./styles/theme";

type JwtPayload = {
  sub?: string;
  role?: string;
};

const getPageTitle = (pathname: string) => {
  const titleMap: Record<string, string> = {
    "/login": "Login",
    "/register": "Register",
    "/dashboard": "Dashboard",
    "/integrations/email": "Email Integrations",
    "/emails": "Email Scans",
    "/assets/suggestions": "Asset Suggestions",
    "/assets": "Assets",
    "/assets/add": "Add Asset",
    "/assets/view": "Asset View",
    "/reminders": "Reminders",
    "/reports": "Reports",
    "/users": "Users",
    "/profile": "Profile",
    "/settings": "Settings",
  };

  return `AssetLife - ${titleMap[pathname] ?? "Dashboard"}`;
};

const DocumentTitleManager = () => {
  const location = useLocation();

  useEffect(() => {
    document.title = getPageTitle(location.pathname);
  }, [location.pathname]);

  return null;
};

const parseJwtPayload = (token: string): JwtPayload | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = window.atob(base64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
};

const App = () => {
  const mode = useUserStore((state) => state.themePreference);
  const token = useUserStore((state) => state.token) ?? localStorage.getItem("access_token") ?? localStorage.getItem("jwt_token");
  const user = useUserStore((state) => state.user);
  const updateUser = useUserStore((state) => state.updateUser);
  const setThemePreference = useUserStore((state) => state.setThemePreference);
  const theme = useMemo(() => getTheme(mode), [mode]);

  const handleToggleTheme = () => {
    const nextMode = mode === "light" ? "dark" : "light";
    setThemePreference(nextMode);

    const jwtPayload = token ? parseJwtPayload(token) : null;
    const resolvedUserId = String(user?.id ?? jwtPayload?.sub ?? "").trim();
    const resolvedRole = String(user?.role ?? jwtPayload?.role ?? "").trim().toLowerCase();

    if (!token || resolvedRole !== "individual" || !resolvedUserId) {
      return;
    }

    void api.put(
      "/individual/update",
      { theme_preference: nextMode },
      { params: { user_id: resolvedUserId } }
    ).then(() => {
      updateUser({ theme_preference: nextMode });
    }).catch((requestError: unknown) => {
      console.error("Failed to persist theme preference", requestError);
    });
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          "@keyframes fadeInUp": {
            from: {
              opacity: 0,
              transform: "translateY(10px)",
            },
            to: {
              opacity: 1,
              transform: "translateY(0)",
            },
          },
        }}
      />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <DocumentTitleManager />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/register" element={<IndividualRegister />} />
          <Route path="/login" element={<IndividualLogin />} />

          <Route
            element={
              <PrivateRoute>
                <AdminLayout mode={mode} onToggleTheme={handleToggleTheme} />
              </PrivateRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/integrations/email" element={<EmailIntegrations />} />
            <Route path="/emails" element={<EmailScans />} />
            <Route path="/assets/suggestions" element={<AssetSuggestions />} />
            <Route path="/assets" element={<Assets />} />
            <Route path="/assets/add" element={<AddAsset />} />
            <Route path="/assets/:assetId" element={<AssetView />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users" element={<Users />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
