import { useEffect, useState } from "react";
import { Alert, Box, Link as MuiLink, Paper, Typography } from "@mui/material";
import { Link } from "react-router-dom";

import { getAssetSuggestions } from "../services/gmail.ts";
import { POST_LOGIN_THEME } from "../styles/theme";

const Dashboard = () => {
  const [newSuggestionCount, setNewSuggestionCount] = useState(0);

  useEffect(() => {
    const run = async () => {
      try {
        const suggestions = await getAssetSuggestions();
        setNewSuggestionCount(suggestions.length);
      } catch {
        setNewSuggestionCount(0);
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
        {newSuggestionCount > 0 ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            New assets detected from your email. {" "}
            <MuiLink component={Link} to="/assets/suggestions" underline="hover">
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
