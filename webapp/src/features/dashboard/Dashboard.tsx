// Legacy feature component. Active dashboard screen is src/pages/Dashboard.tsx.
import theme from "../../styles/theme";
import useUserStore from "../../store/userStore";

const Dashboard = () => {
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: theme.colors.background,
        padding: theme.spacing.lg,
        fontFamily: theme.fonts.family,
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "840px",
          margin: "0 auto",
          background: theme.colors.surface,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: "12px",
          padding: theme.spacing.xl,
          boxSizing: "border-box",
        }}
      >
        <h1
          style={{
            marginTop: 0,
            marginBottom: theme.spacing.sm,
            color: theme.colors.text,
            fontSize: theme.fonts.headingSize,
          }}
        >
          Dashboard
        </h1>
        <p
          style={{
            marginTop: 0,
            marginBottom: theme.spacing.lg,
            color: theme.colors.mutedText,
            fontSize: theme.fonts.bodySize,
          }}
        >
          Welcome, {user?.name ?? "User"}
        </p>

        <button
          type="button"
          onClick={logout}
          style={{
            height: theme.buttons.height,
            padding: `0 ${theme.spacing.lg}`,
            borderRadius: theme.buttons.radius,
            border: "none",
            background: theme.colors.primary,
            color: "#ffffff",
            fontWeight: theme.buttons.fontWeight,
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </section>
    </main>
  );
};

export default Dashboard;
