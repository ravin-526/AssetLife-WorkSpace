import { Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { useState } from "react";

import { POST_LOGIN_THEME } from "../styles/theme";

const Settings = () => {
  const [displayName, setDisplayName] = useState("");

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
        </Stack>
      </Paper>
    </Box>
  );
};

export default Settings;
