import { Stack, Typography, Box, Accordion, AccordionSummary, AccordionDetails } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const Help = () => {
  const navigate = useNavigate();

  const faqs = [
    {
      question: "How do I create an account?",
      answer: "Click 'Register' on the login page, enter your mobile number, verify the OTP, and set up your profile. You can then start adding assets."
    },
    {
      question: "How do I add assets manually?",
      answer: "Go to Assets > Add Asset > Manual Entry. Fill in the asset details (name, category, purchase date, price, etc.) and save. You can also upload photos."
    },
    {
      question: "Can I import assets from email receipts?",
      answer: "Yes! Use the Email Sync feature. Forward your purchase receipts to your AssetLife email, and the system will automatically capture asset details."
    },
    {
      question: "How do I upload invoices?",
      answer: "In Add Asset, select 'Upload Invoice'. You can upload images or PDFs. AssetLife will extract relevant details automatically."
    },
    {
      question: "How does QR code scanning work?",
      answer: "Select 'QR/Barcode' in Add Asset and scan your product barcode. AssetLife will attempt to fetch product details and create an asset."
    },
    {
      question: "Can I set maintenance reminders?",
      answer: "Yes! When adding an asset, set maintenance dates and intervals. You'll receive reminders before scheduled maintenance."
    },
    {
      question: "How do I export my assets?",
      answer: "In the Assets page, use the Export option to download your asset list as CSV or Excel for backup or analysis."
    },
    {
      question: "Is my data secure?",
      answer: "Yes, we use industry-standard encryption for data in transit and at rest. Your personal information is never shared without consent."
    },
    {
      question: "Can I change my theme?",
      answer: "Yes! Click the theme toggle in the top-right corner to switch between light and dark modes. Your preference is saved automatically."
    },
    {
      question: "How do I delete an asset?",
      answer: "Open the asset details, click Delete, and confirm. This action cannot be undone, so ensure you have backups if needed."
    },
    {
      question: "What should I do if I forgot my password?",
      answer: "AssetLife uses OTP-based login. If you lose access, simply enter your mobile number and verify the OTP to regain access."
    },
    {
      question: "How do I contact support?",
      answer: "Visit the Contact Us page for email addresses, response times, and office hours. We typically respond within 24 hours."
    }
  ];
  
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
            Help & FAQ
          </Typography>

          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Find answers to common questions about AssetLife. If you need further assistance, contact our support team.
          </Typography>

          <Stack spacing={2}>
            {faqs.map((faq, index) => (
              <Accordion key={index}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {faq.question}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="textSecondary">
                    {faq.answer}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>

          <Box pt={4} borderTop={1} borderColor="divider">
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Still Need Help?
            </Typography>
            <Typography variant="body2" color="textSecondary">
              If you couldn't find the answer, please reach out to our support team at support@assetlife.com or visit the Contact Us page.
            </Typography>
          </Box>

          <Box pt={2}>
            <Typography variant="caption" color="textSecondary">
              Last updated: March 2025
            </Typography>
          </Box>
        </Box>
      </Stack>
    </Box>
  );
};

export default Help;
