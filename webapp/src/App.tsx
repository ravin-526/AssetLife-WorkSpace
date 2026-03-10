import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { useMemo, useState } from "react";

import AdminLayout from "./components/AdminLayout.tsx";
import PrivateRoute from "./components/PrivateRoute.tsx";
import Assets from "./pages/Assets.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import IndividualLogin from "./pages/IndividualLogin.tsx";
import IndividualRegister from "./pages/IndividualRegister.tsx";
import Reports from "./pages/Reports.tsx";
import Users from "./pages/Users.tsx";
import { getTheme } from "./styles/theme.ts";

const App = () => {
  const [mode, setMode] = useState<"light" | "dark">("light");
  const theme = useMemo(() => getTheme(mode), [mode]);

  const handleToggleTheme = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
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
            <Route path="/assets" element={<Assets />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/users" element={<Users />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
