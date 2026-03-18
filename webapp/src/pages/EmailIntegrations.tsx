import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";

import { connectMailbox, disconnectMailbox, getMailboxStatus, syncMailboxEmails } from "../services/gmail.ts";
import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import useUserStore from "../store/userStore.ts";


const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EmailIntegrations = () => {
  const profileEmail = String(useUserStore((state) => state.user?.email ?? "")).trim().toLowerCase();
  const [connected, setConnected] = useState(false);
  const [mailboxType, setMailboxType] = useState("gmail");
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [manualEmail, setManualEmail] = useState<string>("");
  const [lastSyncAt, setLastSyncAt] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  useAutoDismissMessage(message, setMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 5000 });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scanDays, setScanDays] = useState(10);

  const loadStatus = async () => {
    const status = await getMailboxStatus();
    setConnected(status.connected);
    setMailboxType(status.mailbox_type ?? "gmail");
    setEmailAddress(status.email_address ?? "");
    if (!status.connected) {
      setManualEmail(status.email_address ?? profileEmail);
    }
    setLastSyncAt(status.last_sync_at ?? "");
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams(window.location.search);
        const status = params.get("status");
        const callbackMessage = params.get("message");

        if (status === "connected") {
          setMessage("Mailbox connected successfully. You can now scan your emails for asset invoices.");
        }
        if (status === "error") {
          setError(callbackMessage || "Failed to connect mailbox");
        }

        if (status) {
          window.history.replaceState({}, "", "/assets/add?method=email_sync");
        }

        await loadStatus();
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load mailbox integration status");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const handleConnect = async () => {
    try {
      setError("");
      const candidateEmail = profileEmail || manualEmail.trim().toLowerCase();
      if (!candidateEmail) {
        setError("Please enter an email to connect your mailbox.");
        return;
      }
      if (!emailRegex.test(candidateEmail)) {
        setError("Please enter a valid email address.");
        return;
      }
      setLoading(true);
      const response = await connectMailbox(candidateEmail);
      window.location.href = response.auth_url;
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to start mailbox connection");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setError("");
      setLoading(true);
      await disconnectMailbox();
      await loadStatus();
      setMessage("Mailbox disconnected.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to disconnect mailbox");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setError("");
      setMessage("");
      setSyncing(true);
      const response = await syncMailboxEmails(scanDays, 200);
      await loadStatus();
      setMessage(
        `Sync completed. Scanned ${response.scanned} emails, detected ${response.purchase_emails_detected} purchase emails, and created ${response.created_suggestions} suggestions.`
      );
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to sync mailbox emails");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Box className="grid">
      <Box className="col-12">
        <Typography variant="h4" sx={{ mb: 2 }}>Email Integrations</Typography>
      </Box>
      <Box className="col-12 lg:col-10 xl:col-8">
        <Paper sx={{ p: { xs: 2, md: 3 } }}>
          <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

            <div className="grid align-items-center">
              <div className="col-12 md:col-6">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body1">Mailbox ({mailboxType.toUpperCase()})</Typography>
                  <Chip label={connected ? "Connected" : "Not Connected"} color={connected ? "success" : "default"} />
                </Stack>
              </div>
              <div className="col-12 md:col-6">
                {emailAddress ? (
                  <Typography variant="body2" color="text.secondary">Connected email: {emailAddress}</Typography>
                ) : null}
                {lastSyncAt ? (
                  <Typography variant="body2" color="text.secondary">
                    Last sync: {new Date(lastSyncAt).toLocaleString()}
                  </Typography>
                ) : null}
              </div>
            </div>

            {!connected && !profileEmail ? (
              <div className="grid">
                <div className="col-12 md:col-8 lg:col-6">
                  <TextField
                    label="Mailbox Email"
                    value={manualEmail}
                    onChange={(event) => setManualEmail(event.target.value)}
                    size="small"
                    type="email"
                    fullWidth
                    disabled={loading || syncing}
                    helperText="Enter the email to use for mailbox OAuth"
                  />
                </div>
              </div>
            ) : null}

            {!connected && profileEmail ? (
              <Typography variant="body2" color="text.secondary">
                Using profile email: {profileEmail}
              </Typography>
            ) : null}

          {syncing ? (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "flex-start", sm: "center" }}>
                <CircularProgress size={24} />
                <Stack spacing={0.5}>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    Scanning your Gmail for purchase invoices (last {scanDays} days)...
                  </Typography>
                  <Typography variant="body2" color="text.secondary">Scanning Gmail...</Typography>
                  <Typography variant="body2" color="text.secondary">Detecting invoice attachments...</Typography>
                  <Typography variant="body2" color="text.secondary">Extracting asset details...</Typography>
                </Stack>
              </Stack>
            </Paper>
          ) : null}

            <div className="grid">
              <div className="col-12 md:col-6 lg:col-4">
                <TextField
                  select
                  label="Scan Emails From"
                  value={scanDays}
                  onChange={(event) => setScanDays(Number(event.target.value))}
                  size="small"
                  fullWidth
                  disabled={loading || syncing}
                >
                  <MenuItem value={7}>7 days</MenuItem>
                  <MenuItem value={10}>10 days</MenuItem>
                  <MenuItem value={30}>30 days</MenuItem>
                  <MenuItem value={60}>60 days</MenuItem>
                  <MenuItem value={90}>90 days</MenuItem>
                </TextField>
              </div>
            </div>

            <div className="grid">
              <div className="col-12 md:col-4">
                <Button variant="contained" onClick={handleConnect} disabled={connected || loading || syncing} fullWidth>Connect Mailbox</Button>
              </div>
              <div className="col-12 md:col-4">
                <Button variant="outlined" onClick={handleDisconnect} disabled={!connected || loading || syncing} fullWidth>Disconnect</Button>
              </div>
              <div className="col-12 md:col-4">
                <Button variant="contained" onClick={handleSync} disabled={!connected || loading || syncing} fullWidth>
                  {syncing ? "Scanning..." : "Sync Emails"}
                </Button>
              </div>
            </div>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
};

export default EmailIntegrations;
