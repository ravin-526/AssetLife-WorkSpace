import { useEffect, useState } from "react";
import { Alert, Box, Link as MuiLink, Paper, Typography } from "@mui/material";
import { Link } from "react-router-dom";

import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import { getAssetSuggestions } from "../services/gmail.ts";
import { POST_LOGIN_THEME } from "../styles/theme";

const Dashboard = () => {
  const [newSuggestionCount, setNewSuggestionCount] = useState(0);
  const [infoMessage, setInfoMessage] = useState("");

  useAutoDismissMessage(infoMessage, setInfoMessage, { delay: 3000 });

  useEffect(() => {
    const run = async () => {
      try {
        const suggestions = await getAssetSuggestions();
        const actionableNewSuggestions = suggestions.filter((suggestion) => {
          const normalizedStatus = String(suggestion.status || "").trim().toLowerCase();
          return !suggestion.already_added && (normalizedStatus === "new" || normalizedStatus === "pending");
        }).length;

        setNewSuggestionCount(actionableNewSuggestions);
        setInfoMessage(
          actionableNewSuggestions > 0
            ? `You have ${actionableNewSuggestions} new asset suggestion${actionableNewSuggestions === 1 ? "" : "s"}`
            : ""
        );
      } catch {
        setNewSuggestionCount(0);
        setInfoMessage("");
      }
    };

    void run();
  }, []);

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Dashboard
      </Typography>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        {newSuggestionCount > 0 && infoMessage ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            {infoMessage} {" "}
            <MuiLink component={Link} to="/assets/add?method=email_sync" underline="hover">
              Review suggestions
            </MuiLink>
          </Alert>
        ) : null}

        <Typography variant="body1" color="text.secondary">
          Welcome to the AssetLife admin dashboard.
        </Typography>
        <Box sx={{ mt: POST_LOGIN_THEME.form.groupSpacing }}>
          <Typography variant="body2" color="text.secondary">
            Post-login spacing and typography follow the shared theme tokens.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default Dashboard;
