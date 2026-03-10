import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import api from "../services/api.ts";
import useUserStore, { UserData } from "../store/userStore.ts";
import theme from "../styles/theme.ts";

type RegisterForm = {
  name: string;
  email?: string;
  phone: string;
  date_of_birth?: string;
  pan?: string;
};

type RegisterErrors = Partial<Record<keyof RegisterForm, string>>;

type RequestOtpResponse = {
  message?: string;
};

type VerifyOtpResponse = {
  access_token?: string;
  token?: string;
  user?: UserData;
  message?: string;
};

const IndividualRegister = () => {
  const navigate = useNavigate();
  const login = useUserStore((state) => state.login);
  const [form, setForm] = useState<RegisterForm>({
    name: "",
    email: "",
    phone: "",
    date_of_birth: "",
    pan: "",
  });
  const [otp, setOtp] = useState<string>("");
  const [otpSent, setOtpSent] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [focusedField, setFocusedField] = useState<keyof RegisterForm | "otp" | null>(null);
  const [message, setMessage] = useState<string>("");
  const [apiError, setApiError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    const nextErrors: RegisterErrors = {};

    if (!form.name.trim()) {
      nextErrors.name = "Name is required";
    }
    if (form.email && form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      nextErrors.email = "Email format is invalid";
    }
    if (!form.phone.trim()) {
      nextErrors.phone = "Phone is required";
    } else if (!/^\d{10}$/.test(form.phone.trim())) {
      nextErrors.phone = "Phone must be 10 digits";
    }
    if (form.pan && form.pan.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(form.pan.trim())) {
      nextErrors.pan = "PAN format is invalid";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setApiError("");

    if (!validate()) {
      return;
    }

    try {
      setIsLoading(true);
      await api.post("/individual/register", {
        name: form.name.trim(),
        email: form.email?.trim() ? form.email.trim().toLowerCase() : `${form.phone.trim()}@assetlife.local`,
        mobile: form.phone.trim(),
        dob: form.date_of_birth || "1970-01-01",
        pan: form.pan?.trim() ? form.pan.trim().toUpperCase() : "AAAAA0000A",
      });

      const otpResponse = await api.post<RequestOtpResponse>("/individual/send-otp", {
        mobile: form.phone.trim(),
      });

      setOtpSent(true);
      setMessage(otpResponse.data.message ?? "OTP sent. Verify to complete registration.");
    } catch (error: unknown) {
      setApiError(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setApiError("");
    setMessage("");

    if (!otp.trim()) {
      setApiError("OTP is required");
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.post<VerifyOtpResponse>("/individual/verify-otp", {
        mobile: form.phone.trim(),
        otp: otp.trim(),
      });

      const token = response.data.access_token ?? response.data.token;
      if (!token) {
        setApiError("Verification failed: token not returned");
        return;
      }

      login(token, response.data.user ?? {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email?.trim() || undefined,
      });

      navigate("/dashboard", { replace: true });
    } catch (error: unknown) {
      setApiError(error instanceof Error ? error.message : "OTP verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = (field: keyof RegisterForm | "otp", hasError: boolean) => ({
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
        onSubmit={handleRegistration}
        style={{
          width: "100%",
          maxWidth: "460px",
          background: theme.cards.background,
          borderRadius: theme.cards.borderRadius,
          boxShadow: theme.cards.shadow,
          padding: theme.spacing.xl,
          boxSizing: "border-box",
        }}
      >
        <h1 style={{ marginTop: 0, color: theme.colors.textPrimary, fontSize: theme.fonts.fontSizes.heading }}>
          Individual Registration
        </h1>

        {([
          ["name", "Name", "text"],
          ["email", "Email (optional)", "email"],
          ["phone", "Phone", "tel"],
          ["date_of_birth", "Date of Birth (optional)", "date"],
          ["pan", "PAN (optional)", "text"],
        ] as const).map(([key, label, type]) => (
          <div key={key} style={{ marginBottom: theme.spacing.md }}>
            <label htmlFor={key} style={{ display: "block", marginBottom: theme.spacing.xs }}>
              {label}
            </label>
            <input
              id={key}
              type={type}
              value={form[key]}
              onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
              onFocus={() => setFocusedField(key)}
              onBlur={() => setFocusedField(null)}
              style={inputStyle(key, Boolean(errors[key]))}
              aria-invalid={Boolean(errors[key])}
            />
            {errors[key] ? <p style={{ color: theme.colors.error, margin: `${theme.spacing.xs} 0 0` }}>{errors[key]}</p> : null}
          </div>
        ))}

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

        {message ? <p style={{ color: theme.colors.success, marginBottom: theme.spacing.sm }}>{message}</p> : null}
        {apiError ? <p style={{ color: theme.colors.error, marginBottom: theme.spacing.sm }}>{apiError}</p> : null}

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
          {isLoading ? "Please wait..." : otpSent ? "Verify OTP" : "Register & Send OTP"}
        </button>

        <button
          type="button"
          onClick={() => navigate("/login")}
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
          Login
        </button>

        <p style={{ marginTop: theme.spacing.md, marginBottom: 0, color: theme.colors.textSecondary }}>
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </form>
    </main>
  );
};

export default IndividualRegister;
