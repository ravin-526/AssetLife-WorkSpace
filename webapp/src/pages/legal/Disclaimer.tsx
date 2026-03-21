import { Stack, Typography, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const Disclaimer = () => {
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
            Disclaimer
          </Typography>

          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                1. No Warranty
              </Typography>
              <Typography variant="body2" color="textSecondary">
                AssetLife is provided on an "as-is" basis without any warranties, expressed or implied. We do not guarantee that the platform will be error-free, uninterrupted, or suitable for any particular purpose.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                2. Accuracy of Information
              </Typography>
              <Typography variant="body2" color="textSecondary">
                While we strive to provide accurate information, AssetLife does not guarantee the accuracy, completeness, or timeliness of content. Users are responsible for verifying information.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                3. Use at Your Own Risk
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Your use of AssetLife is entirely at your own risk. We are not liable for any damages, losses, or issues resulting from platform use or data loss.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                4. Third-Party Links
              </Typography>
              <Typography variant="body2" color="textSecondary">
                AssetLife may contain links to third-party websites. We are not responsible for the content, accuracy, or practices of external sites.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                5. Data Backup Responsibility
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Users should maintain regular backups of their data. AssetLife is not responsible for data loss due to technical failures or other causes.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                6. Service Availability
              </Typography>
              <Typography variant="body2" color="textSecondary">
                While we aim for maximum uptime, AssetLife may experience downtime for maintenance or unforeseen issues. We do not guarantee uninterrupted service.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                7. Limitation of Liability
              </Typography>
              <Typography variant="body2" color="textSecondary">
                AssetLife and its owners are not liable for any indirect, incidental, consequential, or punitive damages arising from platform use.
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

export default Disclaimer;
