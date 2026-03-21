import { Stack, Typography, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const CookiePolicy = () => {
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
            Cookie Policy
          </Typography>

          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                1. What Are Cookies?
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Cookies are small text files stored on your device. AssetLife uses cookies to enhance user experience, remember preferences, and track usage patterns.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                2. Types of Cookies
              </Typography>
              <Typography variant="body2" color="textSecondary">
                <strong>Session Cookies:</strong> Temporary cookies deleted after your session ends.<br/>
                <strong>Persistent Cookies:</strong> Remain on your device to remember your preferences.<br/>
                <strong>Analytics Cookies:</strong> Help us understand how users interact with the platform.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                3. Essential Cookies
              </Typography>
              <Typography variant="body2" color="textSecondary">
                These cookies are necessary for platform functionality, including authentication and security. They cannot be disabled without affecting platform function.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                4. Preferences & Analytics
              </Typography>
              <Typography variant="body2" color="textSecondary">
                We use cookies to remember your theme preference, language settings, and navigation patterns. This helps us improve your experience.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                5. Managing Cookies
              </Typography>
              <Typography variant="body2" color="textSecondary">
                You can manage cookie preferences through your browser settings. Disabling cookies may affect platform functionality.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                6. Third-Party Cookies
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Third-party services may place cookies for analytics and advertising. We encourage reviewing their privacy policies.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                7. Contact Us
              </Typography>
              <Typography variant="body2" color="textSecondary">
                For questions about our cookie policy, contact support@assetlife.com.
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

export default CookiePolicy;
