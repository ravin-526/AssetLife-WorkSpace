import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import useUserStore from "../../store/userStore";
import theme from "../../styles/theme";

type JwtPayload = {
  name?: string;
  fullName?: string;
  full_name?: string;
  username?: string;
};

type DashboardWidget = {
  key: "assets" | "tasks" | "activities";
  title: string;
  description: string;
  icon: string;
};

const decodeJwtPayload = (token: string | null): JwtPayload | null => {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const decoded = atob(padded);
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
};

const IndividualDashboard = () => {
  const navigate = useNavigate();
  const user = useUserStore((state) => state.user);
  const token = useUserStore((state) => state.token);
  const logout = useUserStore((state) => state.logout);

  const jwtPayload = useMemo(() => decodeJwtPayload(token), [token]);
  const displayName =
    (typeof user?.fullName === "string" && user.fullName) ||
    user?.name ||
    jwtPayload?.fullName ||
    jwtPayload?.name ||
    jwtPayload?.full_name ||
    jwtPayload?.username ||
    "User";

  const widgets: DashboardWidget[] = [
    {
      key: "assets",
      title: "Assets",
      description: "No assets yet",
      icon: "📦",
    },
    {
      key: "tasks",
      title: "Tasks",
      description: "No tasks yet",
      icon: "✅",
    },
    {
      key: "activities",
      title: "Activities",
      description: "No activities yet",
      icon: "🕒",
    },
  ];

  const handleLogout = () => {
    logout();
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
          maxWidth: "980px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            margin: 0,
            color: theme.colors.textPrimary,
            fontSize: theme.fonts.fontSizes.heading,
            fontWeight: theme.fonts.fontWeights.bold,
          }}
        >
          Welcome, {displayName}
        </h1>
        <p
          style={{
            marginTop: theme.spacing.sm,
            marginBottom: theme.spacing.xl,
            color: theme.colors.textSecondary,
            fontSize: theme.fonts.fontSizes.body,
          }}
        >
          Here is your quick summary.
        </p>

        <button
          type="button"
          onClick={handleLogout}
          style={{
            height: "44px",
            padding: `0 ${theme.spacing.lg}`,
            marginBottom: theme.spacing.lg,
            border: "none",
            borderRadius: theme.buttons.primary.borderRadius,
            background: theme.buttons.secondary.background,
            color: theme.buttons.secondary.text,
            fontSize: theme.fonts.fontSizes.body,
            fontWeight: theme.fonts.fontWeights.medium,
            cursor: "pointer",
          }}
        >
          Logout
        </button>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: theme.spacing.lg,
          }}
        >
          {widgets.map((widget) => (
            <article
              key={widget.key}
              style={{
                background: theme.cards.background,
                borderRadius: theme.cards.borderRadius,
                boxShadow: theme.cards.shadow,
                padding: theme.spacing.lg,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: theme.spacing.sm,
                  marginBottom: theme.spacing.sm,
                }}
              >
                <span aria-hidden="true" style={{ fontSize: theme.fonts.fontSizes.subheading }}>
                  {widget.icon}
                </span>
                <h2
                  style={{
                    margin: 0,
                    color: theme.colors.textPrimary,
                    fontSize: theme.fonts.fontSizes.subheading,
                    fontWeight: theme.fonts.fontWeights.medium,
                  }}
                >
                  {widget.title}
                </h2>
              </div>
              <p
                style={{
                  margin: 0,
                  color: theme.colors.textMuted,
                  fontSize: theme.fonts.fontSizes.body,
                }}
              >
                {widget.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
};

export default IndividualDashboard;
