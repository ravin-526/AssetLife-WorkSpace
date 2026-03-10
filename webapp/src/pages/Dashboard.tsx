import { Box, Paper, Typography } from "@mui/material";
import { POST_LOGIN_THEME } from "../styles/theme";

const Dashboard = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Dashboard
      </Typography>
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
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
