import { Box, Paper, Typography } from "@mui/material";

const Users = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Users
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Users page (dummy content).
        </Typography>
      </Paper>
    </Box>
  );
};

export default Users;
