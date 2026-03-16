// Legacy feature component. Active login screen is src/pages/IndividualLogin.tsx.
import { FormEvent, useMemo, useState } from "react";

import OtpInput from "../../components/OtpInput.tsx";
import api from "../../services/api";
import theme from "../../styles/theme";
import useUserStore from "../../store/userStore";

type LoginResponse = {
  access_token?: string;
  token?: string;
  user?: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
    role?: string;
  };
  message?: string;
};

const Login = () => {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [errors, setErrors] = useState<{ phone?: string; otp?: string }>({});
  const [apiError, setApiError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const login = useUserStore((state) => state.login);

  const formCardStyle = useMemo(
    () => ({
      width: "100%",
      maxWidth: "420px",
      background: theme.colors.surface,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: "12px",
      padding: theme.spacing.xl,
      boxSizing: "border-box" as const,
    }),
    []
  );

  const validate = () => {
    const nextErrors: { phone?: string; otp?: string } = {};

    if (!phone.trim()) {
      nextErrors.phone = "Phone is required";
    }
    if (!otp.trim()) {
      nextErrors.otp = "OTP is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError("");

    if (!validate()) {
      return;
    }

    try {
      setIsLoading(true);

      const response = await api.post<LoginResponse>("/individual/verify-otp", {
        mobile: phone.trim(),
        otp: otp.trim(),
      });

      const token = response.data.access_token ?? response.data.token;
      if (!token) {
        setApiError("Login failed: token not returned by server.");
        return;
      }

      login(token, response.data.user ?? { phone: phone.trim() });
    } catch (error: unknown) {
      setApiError(error instanceof Error ? error.message : "Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: theme.spacing.lg,
        background: theme.colors.background,
        fontFamily: theme.fonts.family,
      }}
    >
      <form onSubmit={handleSubmit} style={formCardStyle} aria-label="Login form">
        <h1
          style={{
            marginTop: 0,
            marginBottom: theme.spacing.sm,
            color: theme.colors.text,
            fontSize: theme.fonts.headingSize,
          }}
        >
          Individual Login
        </h1>
        <p
          style={{
            marginTop: 0,
            marginBottom: theme.spacing.lg,
            color: theme.colors.mutedText,
            fontSize: theme.fonts.bodySize,
          }}
        >
          Enter your phone number and OTP.
        </p>

        <label
          htmlFor="phone"
          style={{
            display: "block",
            marginBottom: theme.spacing.xs,
            color: theme.colors.text,
            fontSize: theme.fonts.labelSize,
          }}
        >
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          aria-invalid={Boolean(errors.phone)}
          aria-describedby={errors.phone ? "phone-error" : undefined}
          style={{
            width: "100%",
            height: theme.buttons.height,
            borderRadius: theme.buttons.radius,
            border: `1px solid ${errors.phone ? theme.colors.error : theme.colors.border}`,
            padding: `0 ${theme.spacing.md}`,
            marginBottom: theme.spacing.xs,
            boxSizing: "border-box",
            fontSize: theme.fonts.bodySize,
          }}
        />
        {errors.phone ? (
          <p id="phone-error" style={{ margin: 0, color: theme.colors.error }}>
            {errors.phone}
          </p>
        ) : null}

        <label
          style={{
            display: "block",
            marginTop: theme.spacing.md,
            marginBottom: theme.spacing.xs,
            color: theme.colors.text,
            fontSize: theme.fonts.labelSize,
          }}
        >
          OTP
        </label>
        <OtpInput
          length={6}
          value={otp}
          onChange={setOtp}
          disabled={isLoading}
        />
        {errors.otp ? (
          <p id="otp-error" style={{ margin: 0, color: theme.colors.error }}>
            {errors.otp}
          </p>
        ) : null}

        {apiError ? (
          <p
            role="alert"
            style={{
              marginTop: theme.spacing.md,
              marginBottom: 0,
              color: theme.colors.error,
            }}
          >
            {apiError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: "100%",
            height: theme.buttons.height,
            marginTop: theme.spacing.lg,
            borderRadius: theme.buttons.radius,
            border: "none",
            background: theme.colors.primary,
            color: "#ffffff",
            fontWeight: theme.buttons.fontWeight,
            cursor: isLoading ? "not-allowed" : "pointer",
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default Login;
