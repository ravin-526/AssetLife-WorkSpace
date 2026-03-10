import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import useUserStore from "../store/userStore";

type PrivateRouteProps = {
  children: ReactNode;
};

const isTokenValid = (token: string | null): boolean => {
  if (!token) {
    return false;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  try {
    const payload = JSON.parse(atob(parts[1]));
    if (typeof payload.exp === "number") {
      return payload.exp * 1000 > Date.now();
    }
    return true;
  } catch {
    return false;
  }
};

const PrivateRoute = ({ children }: PrivateRouteProps) => {
  const token = useUserStore((state) => state.token);
  const location = useLocation();

  if (!isTokenValid(token)) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default PrivateRoute;
