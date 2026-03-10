import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard.tsx";
import IndividualLogin from "./pages/IndividualLogin.tsx";
import IndividualRegister from "./pages/IndividualRegister.tsx";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<IndividualRegister />} />
        <Route path="/login" element={<IndividualLogin />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
