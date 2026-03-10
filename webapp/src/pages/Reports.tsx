import { Box, Paper, Typography } from "@mui/material";

const Reports = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Reports
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Reports page (dummy content).
        </Typography>
      </Paper>
    </Box>
  );
};

export default Reports;
