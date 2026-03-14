import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { useEffect, useMemo, useState } from "react";

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
import { getTheme } from "./styles/theme";

const THEME_MODE_STORAGE_KEY = "assetlife-theme-mode";

const getPageTitle = (pathname: string) => {
  const titleMap: Record<string, string> = {
    "/login": "Login",
    "/register": "Register",
    "/dashboard": "Dashboard",
    "/integrations/email": "Email Integrations",
    "/assets/import-gmail": "Import Gmail",
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

const App = () => {
  const [mode, setMode] = useState<"light" | "dark">(() => {
    const storedMode = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    return storedMode === "dark" ? "dark" : "light";
  });
  const theme = useMemo(() => getTheme(mode), [mode]);

  useEffect(() => {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
  }, [mode]);

  const handleToggleTheme = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
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
            <Route path="/assets/import-gmail" element={<EmailIntegrations />} />
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
