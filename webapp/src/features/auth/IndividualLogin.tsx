import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../services/api";
import useUserStore, { UserData } from "../../store/userStore";
import theme from "../../styles/theme";

type LoginFormState = {
  mobile: string;
  otp: string;
};

type LoginErrors = Partial<Record<keyof LoginFormState, string>>;

type LoginApiResponse = {
  access_token?: string;
  token?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
  };
};

const IndividualLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginFormState>({ mobile: "", otp: "" });
  const [errors, setErrors] = useState<LoginErrors>({});
  const [apiError, setApiError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const login = useUserStore((state) => state.login);

  const containerStyle = useMemo(
    () => ({
      minHeight: "100vh",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      padding: theme.spacing.lg,
      background: theme.colors.background,
      fontFamily: theme.fonts.fontFamily,
    }),
    []
  );

  const cardStyle = useMemo(
    () => ({
      width: "100%",
      maxWidth: "460px",
      background: theme.cards.background,
      borderRadius: theme.cards.borderRadius,
      boxShadow: theme.cards.shadow,
      padding: theme.spacing.xl,
      boxSizing: "border-box" as const,
    }),
    []
  );

  const validate = (): boolean => {
    const nextErrors: LoginErrors = {};

    if (!form.mobile.trim()) {
      nextErrors.mobile = "Mobile is required";
    } else if (!/^\d{10}$/.test(form.mobile.trim())) {
      nextErrors.mobile = "Mobile must be exactly 10 digits";
    }

    if (!form.otp.trim()) {
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
      const response = await api.post<LoginApiResponse>("/individual/verify-otp", {
        mobile: form.mobile.trim(),
        otp: form.otp.trim(),
      });

      const token = response.data.access_token ?? response.data.token;
      if (!token) {
        setApiError("Login failed. Token not returned.");
        return;
      }

      login(token, (response.data.user ?? { phone: form.mobile.trim() }) as UserData);

      navigate("/individual/dashboard", { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Login failed. Please check your credentials.";
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = (hasError: boolean) => ({
    width: "100%",
    height: "44px",
    borderRadius: theme.inputs.borderRadius,
    border: `1px solid ${hasError ? theme.inputs.error : theme.inputs.border}`,
    padding: `0 ${theme.spacing.md}`,
    fontSize: theme.fonts.fontSizes.body,
    boxSizing: "border-box" as const,
  });

  return (
    <div style={containerStyle}>
      <form onSubmit={handleSubmit} style={cardStyle} aria-label="Individual login form">
        <h1
          style={{
            margin: 0,
            color: theme.colors.textPrimary,
            fontSize: theme.fonts.fontSizes.heading,
            fontWeight: theme.fonts.fontWeights.bold,
          }}
        >
          Individual Login
        </h1>
        <p
          style={{
            marginTop: theme.spacing.sm,
            marginBottom: theme.spacing.lg,
            color: theme.colors.textSecondary,
            fontSize: theme.fonts.fontSizes.body,
          }}
        >
          Enter your mobile number and OTP (mock).
        </p>

        <div style={{ marginBottom: theme.spacing.md }}>
          <label
            htmlFor="mobile"
            style={{
              display: "block",
              marginBottom: theme.spacing.xs,
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.fontSizes.caption,
            }}
          >
            Mobile
          </label>
          <input
            id="mobile"
            name="mobile"
            type="tel"
            inputMode="numeric"
            value={form.mobile}
            onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value }))}
            style={inputStyle(Boolean(errors.mobile))}
            aria-invalid={Boolean(errors.mobile)}
          />
          {errors.mobile ? (
            <p style={{ color: theme.colors.error, margin: `${theme.spacing.xs} 0 0` }}>{errors.mobile}</p>
          ) : null}
        </div>

        <div style={{ marginBottom: theme.spacing.md }}>
          <label
            htmlFor="otp"
            style={{
              display: "block",
              marginBottom: theme.spacing.xs,
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.fontSizes.caption,
            }}
          >
            OTP
          </label>
          <input
            id="otp"
            name="otp"
            type="text"
            value={form.otp}
            onChange={(event) => setForm((prev) => ({ ...prev, otp: event.target.value }))}
            style={inputStyle(Boolean(errors.otp))}
            aria-invalid={Boolean(errors.otp)}
          />
          {errors.otp ? (
            <p style={{ color: theme.colors.error, margin: `${theme.spacing.xs} 0 0` }}>{errors.otp}</p>
          ) : null}
        </div>

        {apiError ? (
          <p role="alert" style={{ color: theme.colors.error, marginBottom: theme.spacing.md }}>
            {apiError}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: "100%",
            height: "44px",
            border: "none",
            borderRadius: theme.buttons.primary.borderRadius,
            background: isLoading ? theme.buttons.disabled.background : theme.buttons.primary.background,
            color: isLoading ? theme.buttons.disabled.text : theme.buttons.primary.text,
            fontSize: theme.fonts.fontSizes.body,
            fontWeight: theme.fonts.fontWeights.medium,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Signing in..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default IndividualLogin;
