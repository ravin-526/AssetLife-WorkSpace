import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CssBaseline,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  ThemeProvider,
  Typography,
  useMediaQuery,
} from "@mui/material";

import api from "../services/api.ts";
import useUserStore, { UserData } from "../store/userStore.ts";
import { LOGO } from "../constants/logo.ts";
import { getTheme } from "../styles/theme";

type RegisterResponse = {
  message?: string;
  user_id?: string;
  otp?: string;
  dev_otp?: string;
  debug_otp?: string;
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

  const prefersDarkMode = useMediaQuery("(prefers-color-scheme: dark)");
  const mode = prefersDarkMode ? "dark" : "light";
  const theme = useMemo(() => getTheme(mode), [mode]);

  const [name, setName] = useState("");
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [otp, setOtp] = useState("");

  const [registered, setRegistered] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const [errors, setErrors] = useState<{ name?: string; emailOrPhone?: string; otp?: string }>({});
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const [registering, setRegistering] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isOtpButtonDisabled, setIsOtpButtonDisabled] = useState(false);

  const runtimeEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  const isProduction = runtimeEnv?.NODE_ENV === "production";

  useEffect(() => {
    if (otpCooldown <= 0) {
      setIsOtpButtonDisabled(false);
      return;
    }

    const intervalId = window.setInterval(() => {
      setOtpCooldown((prev) => {
        if (prev <= 1) {
          window.clearInterval(intervalId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [otpCooldown]);

  const parseContact = () => {
    const value = emailOrPhone.trim();
    const isEmail = value.includes("@");
    const mobile = isEmail ? "" : value.replace(/\s+/g, "");
    const email = isEmail ? value.toLowerCase() : "";

    return { isEmail, mobile, email };
  };

  const validateRegister = () => {
    const nextErrors: { name?: string; emailOrPhone?: string } = {};

    if (!name.trim()) {
      nextErrors.name = "Name is required";
    }

    if (!emailOrPhone.trim()) {
      nextErrors.emailOrPhone = "Email or phone is required";
    } else {
      const { isEmail, mobile } = parseContact();
      if (isEmail) {
        const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailOrPhone.trim());
        if (!isValidEmail) {
          nextErrors.emailOrPhone = "Please enter a valid email";
        }
      } else if (!/^\d{10,15}$/.test(mobile)) {
        nextErrors.emailOrPhone = "Please enter a valid mobile number";
      }
    }

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return Object.keys(nextErrors).length === 0;
  };

  const validateOtp = () => {
    if (!otp.trim()) {
      setErrors((prev) => ({ ...prev, otp: "OTP is required" }));
      return false;
    }
    if (!/^\d{4,8}$/.test(otp.trim())) {
      setErrors((prev) => ({ ...prev, otp: "Please enter a valid OTP" }));
      return false;
    }

    setErrors((prev) => ({ ...prev, otp: undefined }));
    return true;
  };

  const handleRegister = async () => {
    setError("");
    setMessage("");

    if (!validateRegister()) {
      return;
    }

    const { mobile, email } = parseContact();

    if (!mobile) {
      setError("Registration currently requires phone input for OTP flow.");
      return;
    }

    try {
      setRegistering(true);
      let otpResponse: RegisterResponse | { message?: string; otp?: string; dev_otp?: string; debug_otp?: string } | null = null;
      if (!registered) {
        const response = await api.post<RegisterResponse>("/individual/register", {
          name: name.trim(),
          email: email || undefined,
          mobile,
          dob: "1970-01-01",
          pan: "AAAAA0000A",
        });
        otpResponse = response.data;
      } else {
        const response = await api.post<{ message?: string; otp?: string; dev_otp?: string; debug_otp?: string }>("/individual/send-otp", {
          mobile,
        });
        otpResponse = response.data;
      }

      setRegistered(true);
      setOtpSent(true);
      const otpFromResponse = otpResponse?.otp ?? otpResponse?.dev_otp ?? otpResponse?.debug_otp;
      const otpFromMessage = otpResponse?.message?.match(/\b(\d{4,8})\b/)?.[1];
      setOtp(isProduction ? "" : (otpFromResponse ?? otpFromMessage ?? ""));
      setOtpCooldown(30);
      setIsOtpButtonDisabled(true);
      setMessage("OTP sent. Please verify to complete registration.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Registration failed");
    } finally {
      setRegistering(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setMessage("");

    const { mobile, email } = parseContact();

    if (!mobile) {
      setError("Please enter a valid phone number.");
      return;
    }

    if (!validateOtp()) {
      return;
    }

    try {
      setVerifyingOtp(true);
      const response = await api.post<VerifyOtpResponse>("/individual/verify-otp", {
        mobile,
        otp: otp.trim(),
      });

      const token = response.data.access_token ?? response.data.token;
      if (!token) {
        setError("Verification failed: token not returned");
        return;
      }

      login(token, response.data.user ?? { name: name.trim(), phone: mobile, email });
      setMessage("Registration successful.");

      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 600);
    } catch (requestError: unknown) {
      const backendMessage = requestError instanceof Error ? requestError.message : "OTP verification failed";
      const normalized = backendMessage.toLowerCase();
      if (normalized.includes("expired")) {
        setError("OTP expired. Please request a new OTP.");
      } else if (normalized.includes("invalid otp") || normalized.includes("incorrect otp")) {
        setError("Incorrect OTP");
      } else {
        setError(backendMessage);
      }
      setOtpSent(true);
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          px: 2,
          bgcolor: "background.default",
        }}
      >
        <Paper
          elevation={mode === "dark" ? 2 : 4}
          sx={{
            width: "100%",
            maxWidth: 500,
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack spacing={3}>
            <Box sx={{ textAlign: "center" }}>
              <Box
                component="img"
                src={LOGO}
                alt="AssetLife Logo"
                sx={{
                  width: 56,
                  height: 56,
                  display: "block",
                  mx: "auto",
                  mb: 1,
                }}
              />
              <Typography variant="h5">AssetLife</Typography>
              <Typography variant="body2" color="text.secondary">
                Individual Registration
              </Typography>
            </Box>

            {error ? <Alert severity="error">{error}</Alert> : null}
            {message ? <Alert severity="success">{message}</Alert> : null}

            <TextField
              label="Full Name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (errors.name) {
                  setErrors((prev) => ({ ...prev, name: undefined }));
                }
              }}
              error={Boolean(errors.name)}
              helperText={errors.name}
              fullWidth
            />

            <TextField
              label="Email or Phone"
              placeholder="Enter email or mobile number"
              value={emailOrPhone}
              onChange={(event) => {
                setEmailOrPhone(event.target.value);
                if (errors.emailOrPhone) {
                  setErrors((prev) => ({ ...prev, emailOrPhone: undefined }));
                }
              }}
              error={Boolean(errors.emailOrPhone)}
              helperText={errors.emailOrPhone}
              fullWidth
            />

            {otpSent ? (
              <TextField
                label="OTP"
                placeholder="Enter OTP"
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value);
                  if (errors.otp) {
                    setErrors((prev) => ({ ...prev, otp: undefined }));
                  }
                }}
                error={Boolean(errors.otp)}
                helperText={errors.otp}
                fullWidth
              />
            ) : null}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <Button
                variant="contained"
                onClick={handleRegister}
                disabled={isOtpButtonDisabled || registering || verifyingOtp}
                fullWidth
              >
                {registering
                  ? "Sending OTP..."
                  : otpCooldown > 0
                    ? `Resend OTP (${otpCooldown}s)`
                    : registered
                      ? "Resend OTP"
                      : "Register"}
              </Button>
              <Button
                variant="contained"
                onClick={handleVerifyOtp}
                disabled={!otpSent || registering || verifyingOtp}
                fullWidth
              >
                {verifyingOtp ? "Verifying..." : "Verify OTP"}
              </Button>
            </Stack>

            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
              Already have an account?{" "}
              <MuiLink component={Link} to="/login" underline="hover">
                Login
              </MuiLink>
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </ThemeProvider>
  );
};

export default IndividualRegister;
