import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import api from "../services/api.ts";
import OtpInput from "../components/OtpInput.tsx";
import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import useUserStore from "../store/userStore.ts";
import { LOGO } from "../constants/logo.ts";

type RequestOtpResponse = {
  message?: string;
  otp?: string;
  dev_otp?: string;
  debug_otp?: string;
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
    theme_preference?: "light" | "dark";
  };
  message?: string;
};

const IndividualLogin = () => {
  const navigate = useNavigate();
  const login = useUserStore((state) => state.login);

  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; otp?: string }>({});
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  useAutoDismissMessage(message, setMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 5000 });
  const [sendingOtp, setSendingOtp] = useState(false);
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

  const validateIdentifier = () => {
    if (!identifier.trim()) {
      setErrors((prev) => ({ ...prev, identifier: "Email or phone is required" }));
      return false;
    }

    if (identifier.includes("@")) {
      setErrors((prev) => ({ ...prev, identifier: "Individual login currently supports mobile number only" }));
      return false;
    }

    const mobile = identifier.trim().replace(/\s+/g, "");
    if (!/^\d{10,15}$/.test(mobile)) {
      setErrors((prev) => ({ ...prev, identifier: "Please enter a valid mobile number" }));
      return false;
    }

    setErrors((prev) => ({ ...prev, identifier: undefined }));
    return true;
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

  const handleSendOtp = async () => {
    setError("");
    setMessage("");

    if (!validateIdentifier()) {
      return;
    }

    try {
      setSendingOtp(true);
      const response = await api.post<RequestOtpResponse>("/individual/send-otp", {
        mobile: identifier.trim(),
      });

      setOtpSent(true);
      const otpFromResponse = response.data.otp ?? response.data.dev_otp ?? response.data.debug_otp;
      const otpFromMessage = response.data.message?.match(/\b(\d{4,8})\b/)?.[1];
      setOtp(isProduction ? "" : (otpFromResponse ?? otpFromMessage ?? ""));
      setMessage(response.data.message ?? "OTP sent successfully");
      setOtpCooldown(30);
      setIsOtpButtonDisabled(true);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError("");
    setMessage("");

    if (!validateIdentifier() || !validateOtp()) {
      return;
    }

    try {
      setVerifyingOtp(true);
      const response = await api.post<VerifyOtpResponse>("/individual/verify-otp", {
        mobile: identifier.trim(),
        otp: otp.trim(),
      });

      const token = response.data.access_token ?? response.data.token;
      if (!token) {
        setError("Login failed: token not returned");
        return;
      }

      login(token, response.data.user ?? { phone: identifier.trim() });
      setMessage(response.data.message ?? "OTP verified successfully. Redirecting...");

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
        elevation={4}
        sx={{
          width: "100%",
          maxWidth: 440,
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
                width: 84,
                height: 84,
                display: "block",
                mx: "auto",
                mb: 1,
              }}
            />
            <Typography variant="h5"><span className="brand-gradient">AssetLife</span></Typography>
            <Typography variant="body2" color="text.secondary">
              Individual Login
            </Typography>
          </Box>

          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          <TextField
            label="Email or Phone"
            placeholder="Enter mobile number"
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              if (errors.identifier) {
                setErrors((prev) => ({ ...prev, identifier: undefined }));
              }
            }}
            error={Boolean(errors.identifier)}
            helperText={errors.identifier}
            fullWidth
          />

          {otpSent ? (
            <Box>
              <Typography variant="body2" sx={{ mb: 1 }}>OTP</Typography>
              <OtpInput
                length={6}
                value={otp}
                onChange={(nextOtp) => {
                  setOtp(nextOtp);
                  if (errors.otp) {
                    setErrors((prev) => ({ ...prev, otp: undefined }));
                  }
                }}
                disabled={sendingOtp || verifyingOtp}
              />
              {errors.otp ? (
                <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
                  {errors.otp}
                </Typography>
              ) : null}
            </Box>
          ) : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button
              variant="contained"
              onClick={handleSendOtp}
              disabled={isOtpButtonDisabled || sendingOtp || verifyingOtp}
              fullWidth
            >
              {sendingOtp ? "Sending OTP..." : otpCooldown > 0 ? `Resend OTP (${otpCooldown}s)` : "Send OTP"}
            </Button>
            <Button
              variant="contained"
              onClick={handleVerifyOtp}
              disabled={!otpSent || sendingOtp || verifyingOtp}
              fullWidth
            >
              {verifyingOtp ? "Verifying..." : "Verify OTP"}
            </Button>
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            New user?{" "}
            <MuiLink component={Link} to="/register" underline="hover">
              Create an account
            </MuiLink>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
};

export default IndividualLogin;
