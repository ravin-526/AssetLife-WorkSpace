import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api.ts";
import useUserStore from "../store/userStore.ts";
import theme from "../styles/theme.ts";

type LoginForm = {
  phoneOrEmail: string;
};

type LoginErrors = Partial<Record<keyof LoginForm, string>>;

type LoginType = "individual" | "corporate";

type RequestOtpResponse = {
  message?: string;
};

type VerifyOtpResponse = {
  access_token?: string;
  token?: string;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    phone?: string;
    role?: string;
  };
  message?: string;
};

const IndividualLogin = () => {
  const navigate = useNavigate();
  const login = useUserStore((state) => state.login);
  const [loginType, setLoginType] = useState<LoginType>("individual");
  const [form, setForm] = useState<LoginForm>({ phoneOrEmail: "" });
  const [otp, setOtp] = useState<string>("");
  const [otpSent, setOtpSent] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [focusedField, setFocusedField] = useState<keyof LoginForm | "otp" | null>(null);
  const [apiError, setApiError] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    const nextErrors: LoginErrors = {};

    if (!form.phoneOrEmail.trim()) {
      nextErrors.phoneOrEmail = "Phone or Email is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSendOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError("");
    setSuccessMessage("");

    if (loginType === "corporate") {
      navigate("/corporate-login");
      return;
    }

    if (!validate()) {
      return;
    }

    try {
      setIsLoading(true);
      const identifier = form.phoneOrEmail.trim();
      if (identifier.includes("@")) {
        setApiError("Individual login currently supports mobile number only");
        return;
      }

      const response = await api.post<RequestOtpResponse>("/individual/send-otp", {
        mobile: identifier,
      });

      setOtpSent(true);
      setSuccessMessage(response.data.message ?? "OTP sent successfully");
    } catch (error: unknown) {
      setApiError(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setApiError("");
    setSuccessMessage("");

    if (!otp.trim()) {
      setApiError("OTP is required");
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.post<VerifyOtpResponse>("/individual/verify-otp", {
        mobile: form.phoneOrEmail.trim(),
        otp: otp.trim(),
      });

      const token = response.data.access_token ?? response.data.token;
      if (!token) {
        setApiError("Login failed: token not returned");
        return;
      }

      login(token, response.data.user ?? { phone: form.phoneOrEmail.trim() });
      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      setApiError(error instanceof Error ? error.message : "OTP verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = (field: keyof LoginForm | "otp", hasError: boolean) => ({
    width: "100%",
    height: "44px",
    borderRadius: theme.inputs.borderRadius,
    border: `1px solid ${hasError ? theme.inputs.error : focusedField === field ? theme.inputs.focus : theme.inputs.border}`,
    padding: `0 ${theme.spacing.md}`,
    fontSize: theme.fonts.fontSizes.body,
    boxSizing: "border-box" as const,
    outline: "none",
  });

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: theme.colors.background,
        padding: theme.spacing.lg,
        fontFamily: theme.fonts.fontFamily,
      }}
    >
      <form
        onSubmit={handleSendOtp}
        style={{
          width: "100%",
          maxWidth: "420px",
          background: theme.cards.background,
          borderRadius: theme.cards.borderRadius,
          boxShadow: theme.cards.shadow,
          padding: theme.spacing.xl,
          boxSizing: "border-box",
        }}
      >
        <h1 style={{ marginTop: 0, color: theme.colors.textPrimary, fontSize: theme.fonts.fontSizes.heading }}>
          Individual Login
        </h1>

        <div style={{ marginBottom: theme.spacing.md }}>
          <label htmlFor="loginType" style={{ display: "block", marginBottom: theme.spacing.xs }}>
            Login Type
          </label>
          <select
            id="loginType"
            value={loginType}
            onChange={(event) => {
              const selected = event.target.value as LoginType;
              setLoginType(selected);
              if (selected === "corporate") {
                navigate("/corporate-login");
              }
            }}
            style={{
              width: "100%",
              height: "44px",
              borderRadius: theme.inputs.borderRadius,
              border: `1px solid ${theme.inputs.border}`,
              padding: `0 ${theme.spacing.md}`,
              fontSize: theme.fonts.fontSizes.body,
              boxSizing: "border-box",
            }}
          >
            <option value="individual">Individual</option>
            <option value="corporate">Corporate</option>
          </select>
        </div>

        <div style={{ marginBottom: theme.spacing.md }}>
          <label htmlFor="phoneOrEmail" style={{ display: "block", marginBottom: theme.spacing.xs }}>
            Phone or Email
          </label>
          <input
            id="phoneOrEmail"
            type="text"
            value={form.phoneOrEmail}
            onChange={(event) => setForm((prev) => ({ ...prev, phoneOrEmail: event.target.value }))}
            onFocus={() => setFocusedField("phoneOrEmail")}
            onBlur={() => setFocusedField(null)}
            style={inputStyle("phoneOrEmail", Boolean(errors.phoneOrEmail))}
            aria-invalid={Boolean(errors.phoneOrEmail)}
          />
          {errors.phoneOrEmail ? (
            <p style={{ color: theme.colors.error, margin: `${theme.spacing.xs} 0 0` }}>{errors.phoneOrEmail}</p>
          ) : null}
        </div>

        {otpSent ? (
          <div style={{ marginBottom: theme.spacing.md }}>
            <label htmlFor="otp" style={{ display: "block", marginBottom: theme.spacing.xs }}>
              OTP
            </label>
            <input
              id="otp"
              type="text"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              onFocus={() => setFocusedField("otp")}
              onBlur={() => setFocusedField(null)}
              style={inputStyle("otp", false)}
            />
          </div>
        ) : null}

        {apiError ? <p style={{ color: theme.colors.error, marginBottom: theme.spacing.sm }}>{apiError}</p> : null}
        {successMessage ? <p style={{ color: theme.colors.success, marginBottom: theme.spacing.sm }}>{successMessage}</p> : null}

        <button
          type={otpSent ? "button" : "submit"}
          onClick={otpSent ? handleVerifyOtp : undefined}
          disabled={isLoading}
          style={{
            width: "100%",
            height: "44px",
            border: "none",
            borderRadius: theme.buttons.primary.borderRadius,
            background: isLoading ? theme.buttons.disabled.background : theme.buttons.primary.background,
            color: isLoading ? theme.buttons.disabled.text : theme.buttons.primary.text,
            fontWeight: theme.fonts.fontWeights.medium,
            cursor: isLoading ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "Please wait..." : otpSent ? "Verify OTP" : "Request OTP"}
        </button>

        <button
          type="button"
          onClick={() => setOtpSent(false)}
          style={{
            width: "100%",
            height: "44px",
            marginTop: theme.spacing.sm,
            border: "none",
            borderRadius: theme.buttons.secondary.borderRadius,
            background: theme.buttons.secondary.background,
            color: theme.buttons.secondary.text,
            fontWeight: theme.fonts.fontWeights.medium,
            cursor: "pointer",
          }}
        >
          {otpSent ? "Edit Identifier" : "Forgot Password?"}
        </button>

        <p style={{ marginTop: theme.spacing.md, marginBottom: 0, color: theme.colors.textSecondary }}>
          New user? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </main>
  );
};

export default IndividualLogin;
