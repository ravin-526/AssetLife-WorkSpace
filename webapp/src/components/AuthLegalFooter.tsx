import { Box, Link as MuiLink, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";

type FooterLinkProps = {
  label: string;
  to: string;
};

const FooterLink = ({ label, to }: FooterLinkProps) => (
  <MuiLink
    component={Link}
    to={to}
    sx={{
      color: "text.secondary",
      textDecoration: "none",
      fontSize: "0.75rem",
      "&:hover": {
        color: "primary.main",
        textDecoration: "underline",
      },
      transition: "color 0.2s",
    }}
  >
    {label}
  </MuiLink>
);

const AuthLegalFooter = () => {
  return (
    <Box
      component="footer"
      sx={{
        textAlign: "center",
        px: 2,
        py: { xs: 2, sm: 2.5 },
        fontSize: "13px",
        opacity: 0.8,
        zIndex: 2,
      }}
    >
      <Stack spacing={0.75} alignItems="center">
        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1 }}>
          <FooterLink label="Privacy Policy" to="/privacy-policy" />
          <Typography variant="caption" color="divider">|</Typography>
          <FooterLink label="Terms & Conditions" to="/terms" />
          <Typography variant="caption" color="divider">|</Typography>
          <FooterLink label="Disclaimer" to="/disclaimer" />
          <Typography variant="caption" color="divider">|</Typography>
          <FooterLink label="Cookie Policy" to="/cookies" />
        </Box>
        <Box sx={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 1 }}>
          <FooterLink label="About Us" to="/about" />
          <Typography variant="caption" color="divider">|</Typography>
          <FooterLink label="Contact Us" to="/contact" />
          <Typography variant="caption" color="divider">|</Typography>
          <FooterLink label="Help / FAQ" to="/help" />
        </Box>
        <Typography variant="caption" color="text.secondary">
          © AssetLife {new Date().getFullYear()}
        </Typography>
      </Stack>
    </Box>
  );
};

export default AuthLegalFooter;
