import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import PrivateRoute from "./components/PrivateRoute";
import IndividualLogin from "./features/auth/IndividualLogin";
import IndividualRegister from "./features/auth/IndividualRegister";
import IndividualDashboard from "./features/dashboard/IndividualDashboard";

const AppRoutes = () => {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<IndividualRegister />} />
        <Route path="/login" element={<IndividualLogin />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <IndividualDashboard />
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRoutes;
