import MenuIcon from "@mui/icons-material/Menu";
import {
  Box,
  IconButton,
  Link as MuiLink,
  Menu,
  MenuItem,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";

type HeaderMenuLinkProps = {
  label: string;
  to: string;
  isDarkMode: boolean;
};

const HeaderMenuLink = ({ label, to, isDarkMode }: HeaderMenuLinkProps) => (
  <MuiLink
    component={Link}
    to={to}
    sx={{
      ml: 3,
      cursor: "pointer",
      fontWeight: 500,
      fontSize: "16px",
      color: isDarkMode ? "#e5e7eb" : "#1f2937",
      textDecoration: "none",
      position: "relative",
      "&:hover": {
        color: isDarkMode ? "#38bdf8" : "#17a2b8",
      },
      "&::after": {
        content: '""',
        position: "absolute",
        width: 0,
        height: "2px",
        bottom: -4,
        left: 0,
        backgroundColor: isDarkMode ? "#38bdf8" : "#17a2b8",
        transition: "width 0.3s",
      },
      "&:hover::after": {
        width: "100%",
      },
    }}
  >
    {label}
  </MuiLink>
);

const AuthPageHeader = () => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const mobileMenuOpen = Boolean(anchorEl);

  const handleOpenMobileMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMobileMenu = () => {
    setAnchorEl(null);
  };

  const mobileMenuItems = [
    { label: "About Us", to: "/about" },
    { label: "Contact Us", to: "/contact" },
    { label: "Help / FAQ", to: "/help" },
  ];

  return (
    <>
      <Box
        component="header"
        sx={{
          height: { xs: 78, sm: 90 },
          px: { xs: 2, sm: 5 },
          background: isDarkMode ? "#111827" : "#ffffff",
          borderBottom: isDarkMode ? "1px solid #374151" : "1px solid #e5e7eb",
          color: isDarkMode ? "#e5e7eb" : "#1f2937",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 2,
        }}
      >
        <Typography className="brand-logo" sx={{ fontSize: "28px", fontWeight: 600, lineHeight: 1 }}>
          <span className="brand-gradient">AssetLife</span>
        </Typography>

        <Stack direction="row" sx={{ display: { xs: "none", md: "flex" } }}>
          <HeaderMenuLink label="About Us" to="/about" isDarkMode={isDarkMode} />
          <HeaderMenuLink label="Contact Us" to="/contact" isDarkMode={isDarkMode} />
          <HeaderMenuLink label="Help / FAQ" to="/help" isDarkMode={isDarkMode} />
        </Stack>

        <IconButton
          aria-label="Open menu"
          onClick={handleOpenMobileMenu}
          sx={{
            display: { xs: "inline-flex", md: "none" },
            color: isDarkMode ? "#e5e7eb" : "#1f2937",
          }}
        >
          <MenuIcon />
        </IconButton>
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={mobileMenuOpen}
        onClose={handleCloseMobileMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        PaperProps={{
          sx: {
            minWidth: 220,
            mt: 0.5,
            background: isDarkMode ? "#111827" : "#ffffff",
            color: isDarkMode ? "#e5e7eb" : "#1f2937",
            boxShadow: isDarkMode
              ? "0 8px 24px rgba(0, 0, 0, 0.5)"
              : "0 8px 24px rgba(15, 23, 42, 0.12)",
          },
        }}
      >
        {mobileMenuItems.map((item) => (
          <MenuItem
            key={item.to}
            component={Link}
            to={item.to}
            onClick={handleCloseMobileMenu}
            sx={{ py: 1.25, px: 2, fontSize: "0.95rem", fontWeight: 500 }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default AuthPageHeader;
