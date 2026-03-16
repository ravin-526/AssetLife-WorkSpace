import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";

import { POST_LOGIN_THEME } from "../styles/theme";
import { resetUserTestData } from "../services/gmail.ts";

const Settings = () => {
  const [displayName, setDisplayName] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  const handleResetData = async () => {
    // TEMPORARY TESTING FEATURE: remove before production deployment.
    setResetLoading(true);
    setResetError("");
    setResetMessage("");
    try {
      const response = await resetUserTestData();
      setResetMessage(response.message || "All assets and related test data have been removed successfully.");
      setResetDialogOpen(false);
      window.location.reload();
    } catch (error: unknown) {
      setResetError(error instanceof Error ? error.message : "Failed to reset test data");
    } finally {
      setResetLoading(false);
    }
  };

  const fieldSx = {
    "& .MuiInputLabel-root": {
      lineHeight: 1.2,
    },
    "& .MuiInputBase-root": {
      height: POST_LOGIN_THEME.inputs.postLogin.height,
      alignItems: "center",
      lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
      bgcolor: "background.paper",
    },
    "& .MuiInputBase-input": {
      fontSize: POST_LOGIN_THEME.inputs.postLogin.fontSize,
      lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
      padding: POST_LOGIN_THEME.inputs.postLogin.padding,
      height: POST_LOGIN_THEME.inputs.postLogin.height,
      boxSizing: POST_LOGIN_THEME.inputs.postLogin.boxSizing,
      width: POST_LOGIN_THEME.inputs.postLogin.width,
    },
    "& .MuiInputBase-input::placeholder": {
      fontSize: POST_LOGIN_THEME.inputs.postLogin.placeholderFontSize,
      lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
      opacity: 1,
    },
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Settings
      </Typography>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack sx={{ gap: POST_LOGIN_THEME.form.groupSpacing }}>
          {resetMessage ? <Alert severity="success">{resetMessage}</Alert> : null}
          {resetError ? <Alert severity="error">{resetError}</Alert> : null}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              columnGap: 2,
              rowGap: POST_LOGIN_THEME.form.rowSpacing,
            }}
          >
            <TextField
              label="Display Name"
              placeholder="Enter display name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              sx={fieldSx}
              fullWidth
            />
          </Box>

          <Button
            variant="contained"
            sx={{
              alignSelf: "flex-start",
              fontSize: POST_LOGIN_THEME.buttons.postLogin.fontSize,
              px: POST_LOGIN_THEME.buttons.postLogin.padding.split(" ")[1],
              py: POST_LOGIN_THEME.buttons.postLogin.padding.split(" ")[0],
              minHeight: POST_LOGIN_THEME.buttons.postLogin.height,
            }}
          >
            Save Settings
          </Button>

          <Box sx={{ pt: 2, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Testing Tools
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              TEMPORARY TESTING FEATURE: remove this action before production deployment.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              onClick={() => {
                setResetDialogOpen(true);
              }}
            >
              Reset Test Data
            </Button>
          </Box>
        </Stack>
      </Paper>

      <Dialog
        open={resetDialogOpen}
        onClose={() => {
          if (!resetLoading) {
            setResetDialogOpen(false);
          }
        }}
      >
        <DialogTitle>Reset Test Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to remove all assets, suggestions, reminders, and uploaded files? This action is for
            testing purposes and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setResetDialogOpen(false);
            }}
            disabled={resetLoading}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              void handleResetData();
            }}
            disabled={resetLoading}
          >
            {resetLoading ? "Resetting..." : "Confirm Reset"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Settings;
