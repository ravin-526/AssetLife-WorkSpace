import { Box, Paper, Typography } from "@mui/material";

const Assets = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Assets
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Assets page (dummy content).
        </Typography>
      </Paper>
    </Box>
  );
};

export default Assets;
