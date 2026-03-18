// Legacy feature component. Active registration screen is src/pages/IndividualRegister.tsx.
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import useAutoDismissMessage from "../../hooks/useAutoDismissMessage.ts";
import api from "../../services/api";
import useUserStore, { UserData } from "../../store/userStore";
import theme from "../../styles/theme";

type RegisterFormState = {
  fullName: string;
  email: string;
  mobile: string;
  dob: string;
};

type RegisterErrors = Partial<Record<keyof RegisterFormState, string>>;

type RegisterApiResponse = {
  access_token?: string;
  token?: string;
  user?: UserData;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const IndividualRegister = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterFormState>({
    fullName: "",
    email: "",
    mobile: "",
    dob: "",
  });
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [apiError, setApiError] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  useAutoDismissMessage(apiError, setApiError, { delay: 5000 });
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
      maxWidth: "520px",
      background: theme.cards.background,
      borderRadius: theme.cards.borderRadius,
      boxShadow: theme.cards.shadow,
      padding: theme.spacing.xl,
      boxSizing: "border-box" as const,
    }),
    []
  );

  const validate = (): boolean => {
    const nextErrors: RegisterErrors = {};

    if (!form.fullName.trim()) {
      nextErrors.fullName = "Full Name is required";
    }
    if (!form.email.trim()) {
      nextErrors.email = "Email is required";
    } else if (!emailRegex.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address";
    }
    if (!form.mobile.trim()) {
      nextErrors.mobile = "Mobile is required";
    } else if (!/^\d{10}$/.test(form.mobile.trim())) {
      nextErrors.mobile = "Mobile must be exactly 10 digits";
    }
    if (!form.dob) {
      nextErrors.dob = "Date of Birth is required";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (field: keyof RegisterFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setApiError("");

    if (!validate()) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await api.post<RegisterApiResponse>("/individual/register", {
        name: form.fullName.trim(),
        email: form.email.trim().toLowerCase() || `${form.mobile.trim()}@assetlife.local`,
        mobile: form.mobile.trim(),
        dob: form.dob || "1970-01-01",
        pan: "AAAAA0000A",
      });

      const token = response.data.access_token ?? response.data.token;
      if (token) {
        login(token, (response.data.user ?? {
          name: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          phone: form.mobile.trim(),
        }) as UserData);
      }

      navigate("/login", { replace: true });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Registration failed. Please try again.";
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
      <form onSubmit={handleSubmit} style={cardStyle} aria-label="Individual registration form">
        <h1
          style={{
            margin: 0,
            color: theme.colors.textPrimary,
            fontSize: theme.fonts.fontSizes.heading,
            fontWeight: theme.fonts.fontWeights.bold,
          }}
        >
          Individual Registration
        </h1>
        <p
          style={{
            marginTop: theme.spacing.sm,
            marginBottom: theme.spacing.lg,
            color: theme.colors.textSecondary,
            fontSize: theme.fonts.fontSizes.body,
          }}
        >
          Create your account to access your dashboard.
        </p>

        {([
          ["fullName", "Full Name", "text"],
          ["email", "Email", "email"],
          ["mobile", "Mobile", "tel"],
        ] as const).map(([field, label, type]) => (
          <div key={field} style={{ marginBottom: theme.spacing.md }}>
            <label
              htmlFor={field}
              style={{
                display: "block",
                marginBottom: theme.spacing.xs,
                color: theme.colors.textPrimary,
                fontSize: theme.fonts.fontSizes.caption,
              }}
            >
              {label}
            </label>
            <input
              id={field}
              name={field}
              type={type}
              value={form[field]}
              onChange={(event) => handleChange(field, event.target.value)}
              style={inputStyle(Boolean(errors[field]))}
              aria-invalid={Boolean(errors[field])}
            />
            {errors[field] ? (
              <p style={{ color: theme.colors.error, margin: `${theme.spacing.xs} 0 0` }}>{errors[field]}</p>
            ) : null}
          </div>
        ))}

        <div style={{ marginBottom: theme.spacing.md }}>
          <label
            htmlFor="dob"
            style={{
              display: "block",
              marginBottom: theme.spacing.xs,
              color: theme.colors.textPrimary,
              fontSize: theme.fonts.fontSizes.caption,
            }}
          >
            Date of Birth
          </label>
          <input
            id="dob"
            name="dob"
            type="date"
            value={form.dob}
            onChange={(event) => handleChange("dob", event.target.value)}
            style={inputStyle(Boolean(errors.dob))}
            aria-invalid={Boolean(errors.dob)}
          />
          {errors.dob ? (
            <p style={{ color: theme.colors.error, margin: `${theme.spacing.xs} 0 0` }}>{errors.dob}</p>
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
          {isLoading ? "Creating account..." : "Register"}
        </button>
      </form>
    </div>
  );
};

export default IndividualRegister;
