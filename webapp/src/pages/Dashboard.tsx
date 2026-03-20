import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Link as MuiLink,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import BuildCircleOutlinedIcon from "@mui/icons-material/BuildCircleOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { Link, useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Legend, Tooltip as ChartTooltip, ResponsiveContainer } from "recharts";

import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import { STATUS_OPTIONS } from "../constants/statusOptions.ts";
import { Asset, getAssetSuggestions, getAssets } from "../services/gmail.ts";
import { Reminder, getReminders } from "../services/reminders.ts";
import {
  getWarrantyEndDate,
  getInsuranceEndDate,
  getServiceDueDate,
} from "../utils/assetStatus.ts";
// Status computation moved to backend; these utilities are for alerts only

// Animated Number Component
const AnimatedNumber = ({ value, duration = 600 }: { value: number; duration?: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startValue = 0;
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const currentValue = Math.floor(startValue + (endValue - startValue) * progress);
      setDisplayValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
      }
    };

    animate();
  }, [value, duration]);

  return <>{displayValue}</>;
};

type SummaryCardConfig = {
  key: string;
  label: string;
  value: number;
  color: "text.secondary" | "success.main" | "error.main" | "warning.main" | "info.main" | "grey.600";
  icon: React.ReactNode;
};

type AssetAlert = {
  id: string;
  assetId: string;
  assetName: string;
  alertType: "warranty_due_soon" | "insurance_expired" | "service_due" | "service_overdue";
  date: Date;
  dateText: string;
  priority: number;
};

type DistributionRow = {
  label: string;
  count: number;
};

type ActivityRow = {
  id: string;
  assetName: string;
  action: "Added" | "Updated";
  when: Date;
};

type UpcomingWindowItem = {
  id: string;
  assetId: string;
  assetName: string;
  kind: "Warranty" | "Insurance" | "Service";
  date: Date;
};

const toStartOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const parseUnknownObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
};

const parseDateValue = (value: unknown): Date | null => {
  if (!value) {
    return null;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return toStartOfDay(parsed);
};

const getRecordValue = (record: Record<string, unknown> | null, keys: string[]): unknown => {
  if (!record) {
    return undefined;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined && record[key] !== null) {
      return record[key];
    }
  }

  return undefined;
};

const toOptionalBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes"].includes(normalized)) return true;
    if (["0", "false", "no"].includes(normalized)) return false;
  }
  return null;
};

const formatDate = (value: Date | string | undefined | null) => {
  if (!value) {
    return "-";
  }
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [reminderFilter, setReminderFilter] = useState<"today" | "thisWeek" | "other">("today");
  const [newSuggestionCount, setNewSuggestionCount] = useState(0);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  useAutoDismissMessage(infoMessage, setInfoMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 5000 });

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");

        const [assetsResponse, remindersResponse, suggestions] = await Promise.all([
          getAssets(),
          getReminders(),
          getAssetSuggestions(),
        ]);

        setAssets(assetsResponse);
        setReminders(remindersResponse);

        const actionableNewSuggestions = suggestions.filter((suggestion) => {
          const normalizedStatus = String(suggestion.status || "").trim().toLowerCase();
          return !suggestion.already_added && (normalizedStatus === "new" || normalizedStatus === "pending");
        }).length;

        setNewSuggestionCount(actionableNewSuggestions);
        setInfoMessage(
          actionableNewSuggestions > 0
            ? `You have ${actionableNewSuggestions} new asset suggestion${actionableNewSuggestions === 1 ? "" : "s"}`
            : ""
        );
      } catch {
        setError("Failed to load dashboard data");
        setNewSuggestionCount(0);
        setInfoMessage("");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const summary = useMemo(() => {
    const counts: Record<string, number> = { total: 0 };
    STATUS_OPTIONS.forEach((status) => {
      counts[status] = 0;
    });

    assets.forEach((asset) => {
      // Status is now stored in DB
      const status = String(asset.status || "Active").trim();

      counts.total += 1;

      if (status && counts[status] !== undefined) {
        counts[status] += 1;
      }
    });

    return counts;
  }, [assets]);

  const summaryCards = useMemo<SummaryCardConfig[]>(() => {
    const toCardColor = (label: string): SummaryCardConfig["color"] => {
      const normalized = label.toLowerCase();
      if (normalized === "active") return "success.main";
      if (normalized.includes("warranty")) return "info.main";
      if (normalized.includes("expiring")) return "warning.main";
      if (normalized.includes("expired")) return "error.main";
      if (normalized.includes("inactive")) return "grey.600";
      return "text.secondary";
    };

    const toCardIcon = (label: string): React.ReactNode => {
      const normalized = label.toLowerCase();
      if (normalized === "active") return <CheckCircleOutlineOutlinedIcon fontSize="small" />;
      if (normalized.includes("warranty")) return <InfoOutlinedIcon fontSize="small" />;
      if (normalized.includes("expiring")) return <WarningAmberOutlinedIcon fontSize="small" />;
      if (normalized.includes("expired")) return <ErrorOutlineOutlinedIcon fontSize="small" />;
      if (normalized.includes("inactive")) return <BuildCircleOutlinedIcon fontSize="small" />;
      return <ScheduleOutlinedIcon fontSize="small" />;
    };

    return [
      {
        key: "total",
        label: "Total Assets",
        value: summary.total,
        color: "text.secondary",
        icon: <Inventory2OutlinedIcon fontSize="small" />,
      },
      ...STATUS_OPTIONS.filter((status) => status !== "Lost" && status !== "Damaged").map((status) => ({
        key: status,
        label: status,
        value: summary[status] || 0,
        color: toCardColor(status),
        icon: toCardIcon(status),
      })),
    ];
  }, [summary]);

  const alerts = useMemo<AssetAlert[]>(() => {
    const today = toStartOfDay(new Date());
    const thirtyDays = new Date(today);
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    const rows: AssetAlert[] = [];

    for (const asset of assets) {
      const assetName = asset.name || "Unnamed asset";
      const warrantyEnd = getWarrantyEndDate(asset);
      const insuranceEnd = getInsuranceEndDate(asset);
      const serviceDue = getServiceDueDate(asset);

      if (warrantyEnd && warrantyEnd >= today && warrantyEnd <= thirtyDays) {
        rows.push({
          id: `${asset.id}-warranty-due-soon`,
          assetId: asset.id,
          assetName,
          alertType: "warranty_due_soon",
          date: warrantyEnd,
          dateText: formatDate(warrantyEnd),
          priority: 3,
        });
      }

      if (insuranceEnd && insuranceEnd < today) {
        rows.push({
          id: `${asset.id}-insurance-expired`,
          assetId: asset.id,
          assetName,
          alertType: "insurance_expired",
          date: insuranceEnd,
          dateText: formatDate(insuranceEnd),
          priority: 0,
        });
      }

      if (serviceDue && serviceDue <= thirtyDays) {
        const overdue = serviceDue < today;
        rows.push({
          id: `${asset.id}-${overdue ? "service-overdue" : "service-due"}`,
          assetId: asset.id,
          assetName,
          alertType: overdue ? "service_overdue" : "service_due",
          date: serviceDue,
          dateText: formatDate(serviceDue),
          priority: overdue ? 1 : 2,
        });
      }
    }

    return rows
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }

        const aDistance = Math.abs(a.date.getTime() - today.getTime());
        const bDistance = Math.abs(b.date.getTime() - today.getTime());
        if (aDistance !== bDistance) {
          return aDistance - bDistance;
        }

        return a.date.getTime() - b.date.getTime();
      })
      .slice(0, 5);
  }, [assets]);

  const filteredReminders = useMemo(() => {
    const today = toStartOfDay(new Date());
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 6);

    const activeOrSnoozed = reminders.filter((reminder) => reminder.status !== "completed");

    return activeOrSnoozed
      .filter((reminder) => {
        const date = parseDateValue(reminder.reminder_date);
        if (!date) {
          return reminderFilter === "other";
        }

        if (reminderFilter === "today") {
          return date.getTime() === today.getTime();
        }

        if (reminderFilter === "thisWeek") {
          return date > today && date <= endOfWeek;
        }

        return date > endOfWeek;
      })
      .sort((a, b) => {
        const d1 = parseDateValue(a.reminder_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const d2 = parseDateValue(b.reminder_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return d1 - d2;
      });
  }, [reminders, reminderFilter]);

  const assetsByCategory = useMemo<DistributionRow[]>(() => {
    const counts = new Map<string, number>();
    for (const asset of assets) {
      const key = String(asset.category || "Uncategorized").trim() || "Uncategorized";
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [assets]);

  const assetsByStatus = useMemo<DistributionRow[]>(() => {
    const counts = new Map<string, number>();
    for (const asset of assets) {
      // Status is now stored in DB
      const key = String(asset.status || "Active").trim();
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [assets]);

  const recentActivity = useMemo<ActivityRow[]>(() => {
    const rows: ActivityRow[] = [];

    for (const asset of assets) {
      const createdAt = parseDateValue(asset.created_at);
      const updatedAt = parseDateValue(asset.updated_at);

      if (createdAt) {
        rows.push({
          id: `${asset.id}-added`,
          assetName: asset.name || "Unnamed asset",
          action: "Added",
          when: createdAt,
        });
      }

      if (updatedAt && (!createdAt || updatedAt.getTime() !== createdAt.getTime())) {
        rows.push({
          id: `${asset.id}-updated`,
          assetName: asset.name || "Unnamed asset",
          action: "Updated",
          when: updatedAt,
        });
      }
    }

    return rows
      .sort((a, b) => b.when.getTime() - a.when.getTime())
      .slice(0, 8);
  }, [assets]);

  const dashboardInsights = useMemo(() => {
    const today = toStartOfDay(new Date());
    const nextSevenDays = new Date(today);
    nextSevenDays.setDate(nextSevenDays.getDate() + 7);

    let expiringSoon7Days = 0;
    let overdueService = 0;
    let expiredInsurance = 0;
    let missingInsurance = 0;
    let missingWarranty = 0;

    const upcomingInNext7Days: UpcomingWindowItem[] = [];

    for (const asset of assets) {
      const assetName = asset.name || "Unnamed asset";
      const warranty = parseUnknownObject(asset.warranty);
      const insurance = parseUnknownObject(asset.insurance);

      const warrantyEnd = getWarrantyEndDate(asset);
      const insuranceEnd = getInsuranceEndDate(asset);
      const serviceDue = getServiceDueDate(asset);

      const warrantyAvailable = toOptionalBoolean(getRecordValue(warranty, ["available"]));
      const insuranceAvailable = toOptionalBoolean(getRecordValue(insurance, ["available"]));

      if (warrantyAvailable === false || warrantyEnd === null) {
        missingWarranty += 1;
      }
      if (insuranceAvailable === false || insuranceEnd === null) {
        missingInsurance += 1;
      }

      if (insuranceEnd && insuranceEnd < today) {
        expiredInsurance += 1;
      }

      if (serviceDue && serviceDue < today) {
        overdueService += 1;
      }

      if (warrantyEnd && warrantyEnd >= today && warrantyEnd <= nextSevenDays) {
        expiringSoon7Days += 1;
        upcomingInNext7Days.push({
          id: `${asset.id}-warranty-next7`,
          assetId: asset.id,
          assetName,
          kind: "Warranty",
          date: warrantyEnd,
        });
      }

      if (insuranceEnd && insuranceEnd >= today && insuranceEnd <= nextSevenDays) {
        expiringSoon7Days += 1;
        upcomingInNext7Days.push({
          id: `${asset.id}-insurance-next7`,
          assetId: asset.id,
          assetName,
          kind: "Insurance",
          date: insuranceEnd,
        });
      }

      if (serviceDue && serviceDue >= today && serviceDue <= nextSevenDays) {
        upcomingInNext7Days.push({
          id: `${asset.id}-service-next7`,
          assetId: asset.id,
          assetName,
          kind: "Service",
          date: serviceDue,
        });
      }
    }

    const criticalItemsThisWeek = expiringSoon7Days + overdueService + expiredInsurance;
    const penalties = (summary["Expired"] || 0) * 20 + overdueService * 20 + missingInsurance * 10 + missingWarranty * 10;
    const healthScore =
      assets.length === 0 ? 100 : Math.max(0, Math.min(100, Math.round(100 - penalties / assets.length)));

    return {
      criticalItemsThisWeek,
      expiringSoon7Days,
      overdueService,
      expiredInsurance,
      missingInsurance,
      missingWarranty,
      healthScore,
      upcomingInNext7Days: upcomingInNext7Days
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .slice(0, 5),
    };
  }, [assets, summary]);

  const renderDistributionBars = (rows: DistributionRow[], color: string) => {
    const maxCount = rows.reduce((acc, row) => Math.max(acc, row.count), 0);

    if (rows.length === 0) {
      return <Typography variant="body2" color="text.secondary">No data available.</Typography>;
    }

    return (
      <Stack spacing={1}>
        {rows.map((row) => {
          const widthPercent = maxCount > 0 ? (row.count / maxCount) * 100 : 0;
          return (
            <Box key={row.label}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: "70%" }}>
                  {row.label}
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{row.count}</Typography>
              </Stack>
              <Box sx={{ mt: 0.5, height: 8, bgcolor: "action.hover", borderRadius: 999 }}>
                <Box sx={{ height: "100%", width: `${widthPercent}%`, bgcolor: color, borderRadius: 999 }} />
              </Box>
            </Box>
          );
        })}
      </Stack>
    );
  };

  const renderStatusDonut = (rows: DistributionRow[]) => {
    if (rows.length === 0) {
      return <Typography variant="body2" color="text.secondary">No data available.</Typography>;
    }

    const getStatusColor = (label: string): string => {
      const lowerLabel = label.toLowerCase();
      if (lowerLabel.includes("active") && !lowerLabel.includes("inactive")) {
        return "#28a745"; // Green - success
      }
      if (lowerLabel.includes("inactive")) {
        return "#6c757d"; // Grey - inactive
      }
      if (lowerLabel.includes("expired")) {
        return "#dc3545"; // Red - error
      }
      if (lowerLabel.includes("due") || lowerLabel.includes("pending")) {
        return "#ffc107"; // Orange - warning
      }
      return "#17a2b8"; // Teal - default/info
    };

    const chartData = rows.map((row) => ({
      name: row.label,
      value: row.count,
      fill: getStatusColor(row.label),
    }));

    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <ChartTooltip formatter={(value) => `${value}`} />
          <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const openAlertAsset = (assetId: string) => {
    const asset = assets.find((item) => item.id === assetId) || null;
    setSelectedAsset(asset);
  };

  const handleCardClick = (cardKey: SummaryCardConfig["key"]) => {
    const card = summaryCards.find((item) => item.key === cardKey);
    const statusFilter = cardKey === "total" ? "" : String(card?.label || "");

    navigate("/assets", {
      state: {
        statusFilter,
      },
    });
  };

  const getAlertDisplay = (alertType: AssetAlert["alertType"]) => {
    if (alertType === "insurance_expired") {
      return {
        label: "Insurance expired",
        color: "error.main",
        icon: <ErrorOutlineOutlinedIcon fontSize="small" sx={{ color: "error.main" }} />,
      };
    }
    if (alertType === "warranty_due_soon") {
      return {
        label: "Warranty expiring soon",
        color: "warning.main",
        icon: <WarningAmberOutlinedIcon fontSize="small" sx={{ color: "warning.main" }} />,
      };
    }
    return {
      label: alertType === "service_overdue" ? "Service overdue" : "Service due soon",
      color: "info.main",
      icon: <BuildCircleOutlinedIcon fontSize="small" sx={{ color: "info.main" }} />,
    };
  };

  const recentActivityScrollSx = {
    overflowY: "auto" as const,
    maxHeight: 300,
    scrollbarWidth: "thin" as const,
    scrollbarColor: "rgba(0,0,0,0.2) transparent",
    "&::-webkit-scrollbar": { width: 6 },
    "&::-webkit-scrollbar-thumb": { backgroundColor: "rgba(0,0,0,0.2)", borderRadius: 999 },
  };
  const debugLayoutBorders = false;

  return (
    <Box sx={{ width: "100%" }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Dashboard
      </Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {newSuggestionCount > 0 && infoMessage ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          {infoMessage}{" "}
          <MuiLink component={Link} to="/assets/add?method=email_sync" underline="hover">
            Review suggestions
          </MuiLink>
        </Alert>
      ) : null}

      {loading ? (
        <Paper sx={{ p: { xs: 3, md: 4 }, display: "flex", justifyContent: "center" }}>
          <CircularProgress size={30} />
        </Paper>
      ) : (
        <Grid
          container
          spacing={2}
          alignItems="stretch"
          sx={{
            width: "100%",
            ...(debugLayoutBorders ? { "& > .MuiGrid-root": { border: "1px solid red" } } : {}),
          }}
        >
          <Grid size={12}>
            <Box sx={{ display: "flex", flexWrap: "nowrap", gap: 2, overflowX: "auto", pb: 0.5, width: "100%" }}>
              {summaryCards.map((card, index) => (
                <Box
                  key={card.key}
                  sx={{
                    flex: 1,
                    minWidth: { xs: 220, md: 0 },
                    display: "flex",
                    animation: `fadeInUp 0.4s ease-forwards`,
                    animationDelay: `${index * 0.05}s`,
                  }}
                >
                  <Card
                    elevation={1}
                    sx={{
                      bgcolor: "background.paper",
                      borderRadius: 2,
                      borderLeft: 3,
                      borderColor: card.color,
                      transition: "box-shadow 0.2s ease",
                      "&:hover": { boxShadow: 3 },
                      display: "flex",
                      flexDirection: "column",
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <CardContent
                      sx={{
                        py: 1.6,
                        "&:last-child": { pb: 1.6 },
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                      }}
                    >
                      {/* Top Row: Number + Color Icon */}
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Typography
                          variant="h4"
                          sx={{
                            fontWeight: 700,
                            fontSize: "2rem",
                            lineHeight: 1.2,
                            letterSpacing: "0.5px",
                          }}
                        >
                          <AnimatedNumber value={card.value} duration={600} />
                        </Typography>
                        <Box sx={{ color: card.color, display: "flex", alignItems: "center" }}>
                          {card.icon}
                        </Box>
                      </Stack>

                      {/* Second Row: Label + Eye Icon */}
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mt: 0.5,
                        }}
                      >
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontSize: "0.75rem" }}
                        >
                          {card.label}
                        </Typography>
                        <Tooltip title="View Assets">
                          <IconButton
                            size="small"
                            onClick={() => handleCardClick(card.key)}
                            sx={{
                              opacity: 0.6,
                              p: 0.5,
                              "&:hover": { opacity: 1 },
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </CardContent>
                  </Card>
                </Box>
              ))}
            </Box>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", animation: "fadeInUp 0.4s ease-forwards", animationDelay: "0.3s" }}>
            <Card elevation={1} sx={{ borderRadius: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
              <CardContent
                sx={{
                  p: { xs: 2, md: 2.5 },
                  "&:last-child": { pb: { xs: 2, md: 2.5 } },
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Typography variant="h6">Today's Focus</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => navigate("/assets")}
                  >
                    View critical assets
                  </Button>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                  {dashboardInsights.criticalItemsThisWeek}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                  important item{dashboardInsights.criticalItemsThisWeek === 1 ? "" : "s"} in the next 7 days
                </Typography>
                <Stack direction="row" spacing={1.25} sx={{ flexWrap: "wrap", rowGap: 0.75 }} useFlexGap>
                  <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
                    Expiring: {dashboardInsights.expiringSoon7Days}
                  </Typography>
                  <Typography variant="caption" color="info.main" sx={{ fontWeight: 600 }}>
                    Overdue: {dashboardInsights.overdueService}
                  </Typography>
                  <Typography variant="caption" color="error.main" sx={{ fontWeight: 600 }}>
                    Expired: {dashboardInsights.expiredInsurance}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", animation: "fadeInUp 0.4s ease-forwards", animationDelay: "0.35s" }}>
            <Card elevation={1} sx={{ borderRadius: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
              <CardContent
                sx={{
                  p: { xs: 2, md: 2.5 },
                  "&:last-child": { pb: { xs: 2, md: 2.5 } },
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Typography variant="h6" sx={{ mb: 1.5 }}>Asset Health</Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  {dashboardInsights.healthScore}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={dashboardInsights.healthScore}
                  sx={{ height: 8, borderRadius: 999, mb: 1.5 }}
                  color={dashboardInsights.healthScore >= 80 ? "success" : dashboardInsights.healthScore >= 60 ? "warning" : "error"}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                  {dashboardInsights.missingInsurance} missing insurance
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {dashboardInsights.missingWarranty} missing warranty
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }} sx={{ display: "flex", animation: "fadeInUp 0.4s ease-forwards", animationDelay: "0.4s" }}>
            <Card elevation={1} sx={{ borderRadius: 2, width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
              <CardContent
                sx={{
                  p: { xs: 2, md: 2.5 },
                  "&:last-child": { pb: { xs: 2, md: 2.5 } },
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Typography variant="h6" sx={{ mb: 1.5 }}>Upcoming in 7 Days</Typography>
                {dashboardInsights.upcomingInNext7Days.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No upcoming lifecycle events.</Typography>
                ) : (
                  <Stack spacing={1}>
                    {dashboardInsights.upcomingInNext7Days.map((item) => (
                      <Paper key={item.id} variant="outlined" sx={{ px: 1.5, py: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.assetName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.kind} · {formatDate(item.date)}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid
            container
            spacing={2}
            alignItems="stretch"
            sx={{
              width: "100%",
              margin: 0,
              animation: "fadeInUp 0.4s ease-forwards",
              animationDelay: "0.45s",
            }}
          >
            <Grid size={{ xs: 12, md: 3 }} sx={{ display: "flex" }}>
              <Card
                elevation={1}
                sx={{
                  borderRadius: 2,
                  width: "100%",
                  height: 280,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <CardContent
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    "&:last-child": { pb: { xs: 2, md: 2.5 } },
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2, flexShrink: 0 }}>
                    Attention Needed
                  </Typography>
                  {alerts.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No urgent alerts right now.
                    </Typography>
                  ) : (
                    <List disablePadding sx={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
                      {alerts.slice(0, 4).map((item, index) => {
                        const display = getAlertDisplay(item.alertType);
                        return (
                          <Box key={item.id}>
                            <ListItemButton
                              onClick={() => openAlertAsset(item.assetId)}
                              sx={{
                                borderRadius: 1,
                                "&:hover": { bgcolor: "action.hover" },
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 34 }}>
                                {display.icon}
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {item.assetName}
                                  </Typography>
                                }
                                secondary={
                                  <Typography variant="caption" color="text.secondary">
                                    {display.label} · {item.dateText}
                                  </Typography>
                                }
                              />
                            </ListItemButton>
                            {index <
                            Math.min(
                              alerts.slice(0, 4).length - 1,
                              alerts.length - 1
                            ) ? (
                              <Divider component="li" />
                            ) : null}
                          </Box>
                        );
                      })}
                    </List>
                  )}
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 3 }} sx={{ display: "flex" }}>
              <Card
                elevation={1}
                sx={{
                  borderRadius: 2,
                  width: "100%",
                  height: 280,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <CardContent
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    "&:last-child": { pb: { xs: 2, md: 2.5 } },
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minHeight: 0,
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 1, flexShrink: 0 }}>
                    Upcoming Reminders
                  </Typography>
                  <Box sx={{ mb: 2, flexShrink: 0 }}>
                    <TextField
                      select
                      size="small"
                      variant="outlined"
                      fullWidth
                      value={reminderFilter}
                      onChange={(event) =>
                        setReminderFilter(
                          event.target.value as "today" | "thisWeek" | "other"
                        )
                      }
                      sx={{
                        fontSize: "0.75rem",
                        "& .MuiSelect-select": {
                          padding: "6px 8px",
                          fontSize: "0.75rem",
                        },
                        "& .MuiOutlinedInput-root": {
                          fontSize: "0.75rem",
                        },
                      }}
                      inputProps={{ style: { fontSize: "0.75rem" } }}
                    >
                      <MenuItem value="today">Today</MenuItem>
                      <MenuItem value="thisWeek">This Week</MenuItem>
                      <MenuItem value="other">Other</MenuItem>
                    </TextField>
                  </Box>
                  <Box sx={{ flex: 1, overflowY: "auto", width: "100%", minHeight: 0 }}>
                    {filteredReminders.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No reminders found.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {filteredReminders.slice(0, 20).map((reminder) => (
                          <Paper
                            key={reminder.id}
                            variant="outlined"
                            sx={{
                              px: 1.5,
                              py: 1,
                              borderColor:
                                reminderFilter === "today"
                                  ? "warning.light"
                                  : "divider",
                              bgcolor:
                                reminderFilter === "today"
                                  ? "warning.50"
                                  : "background.paper",
                            }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {reminder.title || "Untitled reminder"}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block" }}
                            >
                              {reminder.asset_name || "Asset"} ·{" "}
                              {formatDate(reminder.reminder_date)}
                            </Typography>
                          </Paper>
                        ))}
                      </Stack>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid
              size={{ xs: 12, md: 6 }}
              sx={{ display: "flex", animation: "fadeInUp 0.4s ease-forwards", animationDelay: "0.55s" }}
            >
              <Card elevation={1} sx={{ borderRadius: 2, width: "100%", height: 280, display: "flex", flexDirection: "column" }}>
                <CardContent
                  sx={{
                    p: { xs: 2, md: 2.5 },
                    "&:last-child": { pb: { xs: 2, md: 2.5 } },
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <Typography variant="h6" sx={{ mb: 2 }}>Distribution</Typography>
                  <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>By Category</Typography>
                    {renderDistributionBars(assetsByCategory, "info.main")}
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>By Status</Typography>
                    {renderStatusDonut(assetsByStatus)}
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
            </Grid>
          </Grid>

          <Grid size={12} sx={{ display: "flex", animation: "fadeInUp 0.4s ease-forwards", animationDelay: "0.6s" }}>
            <Card elevation={1} sx={{ borderRadius: 2, width: "100%", maxWidth: "100%", display: "flex", flexDirection: "column", maxHeight: "250px" }}>
              <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } }, flex: 1, display: "flex", flexDirection: "column" }}>
                <Typography variant="h6" sx={{ mb: 2, flexShrink: 0 }}>Recent Activity</Typography>
                <Box sx={{ flex: 1, overflowY: "auto", width: "100%" }}>
                  {recentActivity.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No recent activity.</Typography>
                  ) : (
                    <List disablePadding>
                      {recentActivity.map((item, index) => (
                        <Box key={item.id}>
                          <ListItemButton sx={{ borderRadius: 1, "&:hover": { bgcolor: "action.hover" } }}>
                            <ListItemIcon sx={{ minWidth: 34 }}>
                              <ScheduleOutlinedIcon fontSize="small" color={item.action === "Added" ? "info" : "success"} />
                            </ListItemIcon>
                            <ListItemText
                              primary={
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {item.assetName}
                                </Typography>
                              }
                              secondary={
                                <Typography variant="caption" color="text.secondary">
                                  {item.action} · {formatDate(item.when)}
                                </Typography>
                              }
                            />
                          </ListItemButton>
                          {index < recentActivity.length - 1 ? <Divider component="li" /> : null}
                        </Box>
                      ))}
                    </List>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Dialog open={Boolean(selectedAsset)} onClose={() => setSelectedAsset(null)} fullWidth maxWidth="sm">
        <DialogTitle>Asset Details</DialogTitle>
        <DialogContent dividers>
          {selectedAsset ? (
            <Stack spacing={1.25}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{selectedAsset.name || "-"}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedAsset.category || "-"} / {selectedAsset.subcategory || "-"}
                </Typography>
              </Box>
              <Typography variant="body2"><strong>Status:</strong> {selectedAsset.status || "-"}</Typography>
              <Typography variant="body2"><strong>Brand:</strong> {selectedAsset.brand || "-"}</Typography>
              <Typography variant="body2"><strong>Vendor:</strong> {selectedAsset.vendor || "-"}</Typography>
              <Typography variant="body2"><strong>Purchase Date:</strong> {formatDate(selectedAsset.purchase_date)}</Typography>
              <Typography variant="body2"><strong>Warranty End:</strong> {formatDate(getWarrantyEndDate(selectedAsset))}</Typography>
              <Typography variant="body2"><strong>Insurance End:</strong> {formatDate(getInsuranceEndDate(selectedAsset))}</Typography>
              <Typography variant="body2"><strong>Next Service:</strong> {formatDate(getServiceDueDate(selectedAsset))}</Typography>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedAsset(null)}>Close</Button>
          {selectedAsset ? (
            <Button
              variant="contained"
              startIcon={<InfoOutlinedIcon />}
              onClick={() => {
                navigate(`/assets/${selectedAsset.id}`);
                setSelectedAsset(null);
              }}
            >
              Open Asset
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
