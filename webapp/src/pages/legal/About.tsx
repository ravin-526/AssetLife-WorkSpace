import { Stack, Typography, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const About = () => {
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
            About AssetLife
          </Typography>

          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Our Mission
              </Typography>
              <Typography variant="body2" color="textSecondary">
                AssetLife is dedicated to simplifying asset management for individuals and organizations. We provide intuitive tools to track, manage, and maintain assets effortlessly throughout their lifecycle.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                What We Do
              </Typography>
              <Typography variant="body2" color="textSecondary">
                AssetLife enables users to catalog assets, track maintenance schedules, manage warranties, organize documents, and receive timely reminders. Our platform helps users maintain complete control over their valuable possessions.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Key Features
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • Comprehensive asset tracking and categorization<br/>
                • Email integration for rapid asset capture<br/>
                • QR/Barcode scanning for quick reference<br/>
                • Maintenance and warranty reminders<br/>
                • Document and invoice storage<br/>
                • Asset suggestions and insights<br/>
                • Responsive mobile and web experience
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Our Values
              </Typography>
              <Typography variant="body2" color="textSecondary">
                <strong>Simplicity:</strong> We make asset management intuitive and straightforward.<br/>
                <strong>Security:</strong> Your data is protected with industry-standard encryption.<br/>
                <strong>Innovation:</strong> We continuously enhance features based on user feedback.<br/>
                <strong>Reliability:</strong> Our platform is built for consistent, dependable performance.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Technology
              </Typography>
              <Typography variant="body2" color="textSecondary">
                AssetLife is built with modern, secure technologies ensuring fast performance, reliability, and scalability for users worldwide.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Contact Us
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Have questions or feedback? Reach out to us at support@assetlife.com. We'd love to hear from you!
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

export default About;
