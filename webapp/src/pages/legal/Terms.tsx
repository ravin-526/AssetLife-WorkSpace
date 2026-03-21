import { Stack, Typography, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const Terms = () => {
  const navigate = useNavigate();
  
  return (
    <Box sx={{ width: "100%", maxWidth: 1200, mx: "auto", px: { xs: 3, sm: 4 }, py: 5 }}>
      <Stack spacing={3}>
        <Box 
          onClick={() => navigate("/login")} 
          sx={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 1, "&:hover": { opacity: 0.7 } }}
        >
          <ArrowBackIcon fontSize="small" />
          <Typography variant="body2">Back to Login</Typography>
        </Box>

        <Box sx={{ "& .MuiTypography-body2": { fontSize: "15px", lineHeight: 1.7 } }}>
          <Typography variant="h4" sx={{ fontSize: "28px", fontWeight: 600, mb: 2 }}>
            Terms & Conditions
          </Typography>

          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                1. Acceptance of Terms
              </Typography>
              <Typography variant="body2" color="textSecondary">
                By using AssetLife, you agree to these terms and conditions. If you do not accept them, please do not use the platform.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                2. User Responsibilities
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Users are responsible for maintaining the confidentiality of their account credentials and for all activities occurring under their account. You agree to use the platform only for lawful purposes.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                3. Intellectual Property Rights
              </Typography>
              <Typography variant="body2" color="textSecondary">
                AssetLife and its content are protected by copyright and other intellectual property laws. Users may not reproduce, distribute, or transmit content without permission.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                4. Limitation of Liability
              </Typography>
              <Typography variant="body2" color="textSecondary">
                AssetLife is provided "as is" without warranties. We are not liable for indirect, incidental, or consequential damages arising from platform use.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                5. Termination
              </Typography>
              <Typography variant="body2" color="textSecondary">
                We reserve the right to terminate accounts or services that violate these terms or misuse the platform.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                6. Modifications
              </Typography>
              <Typography variant="body2" color="textSecondary">
                AssetLife may modify these terms at any time. Continued use constitutes acceptance of changes.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                7. Governing Law
              </Typography>
              <Typography variant="body2" color="textSecondary">
                These terms are governed by applicable laws. Any disputes shall be resolved in competent courts.
              </Typography>
            </Box>

            <Box pt={2} borderTop={1} borderColor="divider">
              <Typography variant="caption" color="textSecondary">
                Last updated: March 2025
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
};

export default Terms;
