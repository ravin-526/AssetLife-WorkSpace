import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import theme from "../styles/theme.ts";

type JwtPayload = {
  name?: string;
  full_name?: string;
  username?: string;
};

const decodeToken = (token: string | null): JwtPayload | null => {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload = JSON.parse(atob(parts[1])) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("jwt_token");
  const storedName = localStorage.getItem("user_name");

  const decoded = useMemo(() => decodeToken(token), [token]);
  const displayName = storedName || decoded?.name || decoded?.full_name || decoded?.username || "User";

  const handleLogout = () => {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_name");
    navigate("/login", { replace: true });
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: theme.colors.background,
        padding: theme.spacing.lg,
        fontFamily: theme.fonts.fontFamily,
      }}
    >
      <section
        style={{
          maxWidth: "800px",
          margin: "0 auto",
          background: theme.cards.background,
          borderRadius: theme.cards.borderRadius,
          boxShadow: theme.cards.shadow,
          padding: theme.spacing.xl,
        }}
      >
        <h1 style={{ marginTop: 0, color: theme.colors.textPrimary, fontSize: theme.fonts.fontSizes.heading }}>
          Welcome, {displayName}
        </h1>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            marginTop: theme.spacing.lg,
            height: "44px",
            padding: `0 ${theme.spacing.lg}`,
            border: "none",
            borderRadius: theme.buttons.secondary.borderRadius,
            background: theme.buttons.secondary.background,
            color: theme.buttons.secondary.text,
            cursor: "pointer",
            fontWeight: theme.fonts.fontWeights.medium,
          }}
        >
          Logout
        </button>
      </section>
    </main>
  );
};

export default Dashboard;
