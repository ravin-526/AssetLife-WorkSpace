import { useEffect, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";

import { connectGmail, disconnectGmail, getGmailStatus, syncEmails } from "../services/gmail.ts";

const EmailIntegrations = () => {
  const [connected, setConnected] = useState(false);
  const [emailAddress, setEmailAddress] = useState<string>("");
  const [lastSyncAt, setLastSyncAt] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [scanDays, setScanDays] = useState(10);

  const loadStatus = async () => {
    const status = await getGmailStatus();
    setConnected(status.connected);
    setEmailAddress(status.email_address ?? "");
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
          setMessage("Gmail connected successfully. You can now scan your emails for asset invoices.");
        }
        if (status === "error") {
          setError(callbackMessage || "Failed to connect Gmail");
        }

        if (status) {
          window.history.replaceState({}, "", "/assets/import-gmail");
        }

        await loadStatus();
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load Gmail integration status");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const handleConnect = async () => {
    try {
      setError("");
      setLoading(true);
      const response = await connectGmail();
      window.location.href = response.auth_url;
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to start Gmail connection");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setError("");
      setLoading(true);
      await disconnectGmail();
      await loadStatus();
      setMessage("Gmail account disconnected.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to disconnect Gmail");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setError("");
      setMessage("");
      setSyncing(true);
      const response = await syncEmails(scanDays, 200);
      await loadStatus();
      setMessage(
        `Sync completed. Scanned ${response.scanned} emails, detected ${response.purchase_emails_detected} purchase emails, and created ${response.created_suggestions} suggestions.`
      );
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to sync Gmail emails");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Email Integrations</Typography>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "flex-start", sm: "center" }}>
            <Typography variant="body1">Gmail</Typography>
            <Chip label={connected ? "Connected" : "Not Connected"} color={connected ? "success" : "default"} />
          </Stack>

          {emailAddress ? (
            <Typography variant="body2" color="text.secondary">Connected email: {emailAddress}</Typography>
          ) : null}

          {lastSyncAt ? (
            <Typography variant="body2" color="text.secondary">
              Last sync: {new Date(lastSyncAt).toLocaleString()}
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

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
            <TextField
              select
              label="Scan Emails From"
              value={scanDays}
              onChange={(event) => setScanDays(Number(event.target.value))}
              size="small"
              sx={{ minWidth: 220 }}
              disabled={loading || syncing}
            >
              <MenuItem value={7}>7 days</MenuItem>
              <MenuItem value={10}>10 days</MenuItem>
              <MenuItem value={30}>30 days</MenuItem>
              <MenuItem value={60}>60 days</MenuItem>
              <MenuItem value={90}>90 days</MenuItem>
            </TextField>
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button variant="contained" onClick={handleConnect} disabled={connected || loading || syncing}>Connect Gmail</Button>
            <Button variant="outlined" onClick={handleDisconnect} disabled={!connected || loading || syncing}>Disconnect Gmail</Button>
            <Button variant="contained" onClick={handleSync} disabled={!connected || loading || syncing}>
              {syncing ? "Scanning..." : "Sync Emails"}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default EmailIntegrations;
