import { Stack, Typography, Box, Link as MuiLink } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useState } from "react";

const PrivacyPolicy = () => {
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
            Privacy Policy
          </Typography>

          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                1. Information We Collect
              </Typography>
              <Typography variant="body2" color="textSecondary">
                AssetLife collects personal information to provide asset management services, including name, email, phone number, and asset details. We also collect usage data and device information.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                2. How We Use Your Information
              </Typography>
              <Typography variant="body2" color="textSecondary">
                We use collected information to deliver services, improve our platform, communicate updates, and ensure security. Your data helps us enhance the asset management experience.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                3. Data Security
              </Typography>
              <Typography variant="body2" color="textSecondary">
                We implement industry-standard encryption and security measures to protect your personal information. All sensitive data is encrypted in transit and at rest.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                4. Third-Party Sharing
              </Typography>
              <Typography variant="body2" color="textSecondary">
                AssetLife does not sell or share your personal information with third parties without your consent, except as required by law or for service delivery.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                5. Your Rights
              </Typography>
              <Typography variant="body2" color="textSecondary">
                You have the right to access, modify, or delete your personal information. Contact us at privacy@assetlife.com for requests.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                6. Cookies
              </Typography>
              <Typography variant="body2" color="textSecondary">
                We use cookies to enhance user experience and remember preferences. You can manage cookie settings in your browser.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                7. Changes to Privacy Policy
              </Typography>
              <Typography variant="body2" color="textSecondary">
                We may update this policy periodically. Continued use of AssetLife implies acceptance of changes.
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

export default PrivacyPolicy;
