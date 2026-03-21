import { Stack, Typography, Box } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const Contact = () => {
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
            Contact Us
          </Typography>

          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Get in Touch
              </Typography>
              <Typography variant="body2" color="textSecondary">
                We'd love to hear from you! Whether you have questions, feedback, or need assistance, our team is here to help.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Email Support
              </Typography>
              <Typography variant="body2" color="textSecondary">
                General Inquiries: <strong>support@assetlife.com</strong><br/>
                Technical Support: <strong>tech@assetlife.com</strong><br/>
                Privacy & Legal: <strong>privacy@assetlife.com</strong><br/>
                Business Partnerships: <strong>partnerships@assetlife.com</strong>
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Response Time
              </Typography>
              <Typography variant="body2" color="textSecondary">
                We aim to respond to all inquiries within 24 hours during business days. For urgent issues, please mark your email as priority.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Feedback & Suggestions
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Your feedback helps us improve AssetLife. Share your ideas and suggestions at feedback@assetlife.com.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Social Media
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Connect with us on social media for updates, tips, and community engagement.
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Office Hours
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Monday - Friday: 9:00 AM - 6:00 PM (IST)<br/>
                Saturday - Sunday: Closed<br/>
                Holidays: Closed
              </Typography>
            </Box>

            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                Emergency Support
              </Typography>
              <Typography variant="body2" color="textSecondary">
                For critical issues affecting your account, contact emergency support at 24/7@assetlife.com with details.
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

export default Contact;
