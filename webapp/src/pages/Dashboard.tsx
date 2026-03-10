import { Box, Paper, Typography } from "@mui/material";

const Dashboard = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Dashboard
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Welcome to the AssetLife admin dashboard.
        </Typography>
      </Paper>
    </Box>
  );
};

export default Dashboard;
