import { Box, useTheme } from "@mui/material";
import { keyframes } from "@emotion/react";
import { Outlet } from "react-router-dom";

import AuthLegalFooter from "./AuthLegalFooter.tsx";
import AuthPageHeader from "./AuthPageHeader.tsx";

type BackgroundIcon = {
  src: string;
  size: number;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  hideOnMobile?: boolean;
  rotate?: number;
  duration?: number;
  delay?: number;
};

const BACKGROUND_ICONS: BackgroundIcon[] = [
  // Left column — top to bottom
  { src: "/assets/icon-car.svg",      size: 110, top: "10%",    left: "4%",   hideOnMobile: true, duration: 5.0, delay: 0.0 },
  { src: "/assets/icon-laptop.svg",   size: 100, top: "38%",    left: "5%",   hideOnMobile: true, duration: 7.0, delay: 0.5 },
  { src: "/assets/icon-phone.svg",    size: 88,  bottom: "12%", left: "8%",   rotate: -8,         duration: 6.0, delay: 1.0 },
  // Centre-left / centre-right (mid depth)
  { src: "/assets/icon-document.svg", size: 96,  top: "18%",    left: "22%",  hideOnMobile: true, duration: 8.0, delay: 0.3 },
  { src: "/assets/icon-barcode.svg",  size: 96,  bottom: "16%", right: "22%", hideOnMobile: true, duration: 5.5, delay: 1.5 },
  // Right column — top to bottom
  { src: "/assets/icon-warranty.svg", size: 100, top: "8%",     right: "6%",  hideOnMobile: true, duration: 7.0, delay: 0.8 },
  { src: "/assets/icon-tv.svg",       size: 108, top: "38%",    right: "5%",  hideOnMobile: true, duration: 6.5, delay: 0.2 },
  { src: "/assets/icon-fridge.svg",   size: 100, bottom: "8%",  right: "6%",  hideOnMobile: true, duration: 8.0, delay: 1.2 },
  // Extra mid-screen accents
  { src: "/assets/icon-qrcode.svg",   size: 88,  top: "65%",    right: "18%", hideOnMobile: true, duration: 5.0, delay: 2.0 },
  { src: "/assets/icon-washing.svg",  size: 100, bottom: "22%", left: "22%",  hideOnMobile: true, duration: 7.5, delay: 0.7 },
];

// Combined keyframe: vertical float (-20px) + horizontal drift (+15px) + slight tilt (3deg)
// Single keyframe avoids CSS transform-animation conflict (multi-property transforms overwrite each other)
const floatAnim = keyframes`
  0%   { transform: translateY(0px)   translateX(0px)   rotate(0deg); }
  25%  { transform: translateY(-10px) translateX(7px)   rotate(1.5deg); }
  50%  { transform: translateY(-20px) translateX(15px)  rotate(3deg); }
  75%  { transform: translateY(-10px) translateX(7px)   rotate(1.5deg); }
  100% { transform: translateY(0px)   translateX(0px)   rotate(0deg); }
`;

const AuthLayout = () => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";

  return (
    <Box
      className="auth-layout login-page"
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
        background: isDarkMode
          ? "linear-gradient(135deg, #0f172a 0%, #1f2937 50%, #111827 100%)"
          : "linear-gradient(135deg, #e6f7fb 0%, #f0f9ff 50%, #ffffff 100%)",
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          backgroundImage: "url('/assets/login-bg.svg')",
          backgroundSize: "contain",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: isDarkMode ? 0.08 : 0.12,
          pointerEvents: "none",
          zIndex: 0,
        },
      }}
    >
      <AuthPageHeader />

      <Box
        component="main"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          px: { xs: 2, sm: 3 },
          pt: { xs: 2, sm: 3 },
          pb: { xs: 3, sm: 4 },
          position: "relative",
          zIndex: 1,
        }}
      >
        <Outlet />
      </Box>

      <AuthLegalFooter />

      {BACKGROUND_ICONS.map((icon, index) => (
        <Box
          key={`${icon.src}-${index}`}
          sx={{
            position: "absolute",
            top: icon.top,
            right: icon.right,
            bottom: icon.bottom,
            left: icon.left,
            width: icon.size,
            height: icon.size,
            pointerEvents: "none",
            zIndex: 0,
            // Rotation is static on outer box — does not conflict with float animation
            transform: icon.rotate ? `rotate(${icon.rotate}deg)` : undefined,
            display: icon.hideOnMobile ? { xs: "none", md: "block" } : { xs: "none", sm: "block" },
          }}
        >
          {/* Inner box: animation (float) + opacity */}
          <Box
            sx={{
              width: "100%",
              height: "100%",
              opacity: isDarkMode ? 0.10 : 0.14,
              animation: `${floatAnim} ${icon.duration ?? 6}s ease-in-out ${icon.delay ?? 0}s infinite`,
              "@media (prefers-reduced-motion: reduce)": { animation: "none" },
            }}
          >
            <Box
              component="img"
              src={icon.src}
              alt=""
              aria-hidden="true"
              sx={{ width: "100%", height: "100%" }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

export default AuthLayout;
