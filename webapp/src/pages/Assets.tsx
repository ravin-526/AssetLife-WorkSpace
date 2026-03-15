import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  CircularProgress,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Popover,
  LinearProgress,
  Stack,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useNavigate } from "react-router-dom";

import AssetPreviewModal from "../components/modules/AssetPreviewModal.tsx";
import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import {
  Asset,
  AssetLifecyclePayload,
  AssetSuggestion,
  connectMailbox,
  createAsset,
  deleteAsset,
  disconnectMailbox,
  fetchAssetInvoiceBlob,
  getAssetById,
  getAssetCategories,
  getAssetSuggestions,
  getAssets,
  getMailboxStatus,
  parseSuggestionAttachment,
  updateAsset,
  syncMailboxEmails,
} from "../services/gmail.ts";

const Assets = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AssetSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [parsingSuggestionId, setParsingSuggestionId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [mailFiltersExpanded, setMailFiltersExpanded] = useState(true);
  const [mailboxConnected, setMailboxConnected] = useState(false);
  const [mailboxEmail, setMailboxEmail] = useState("");
  const [scanDays, setScanDays] = useState(10);
  const [useCustomScanRange, setUseCustomScanRange] = useState(false);
  const [scanFromDate, setScanFromDate] = useState("");
  const [scanToDate, setScanToDate] = useState("");
  const [subjectKeywordsInput, setSubjectKeywordsInput] = useState("invoice, receipt");
  const [senderEmailsInput, setSenderEmailsInput] = useState("");
  const [attachmentsMandatory] = useState(true);
  const [parsingMessage, setParsingMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [amountExact, setAmountExact] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const [moreFiltersAnchorEl, setMoreFiltersAnchorEl] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const [viewingAssetId, setViewingAssetId] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);
  const [quickViewAsset, setQuickViewAsset] = useState<Asset | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    brand: "",
    vendor: "",
    price: "",
    purchase_date: "",
    category: "",
    subcategory: "",
  });
  const [assetCategories, setAssetCategories] = useState<{ category: string; subcategories: string[] }[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [mailboxEmailInput, setMailboxEmailInput] = useState("");
  const [mailboxEmailInputError, setMailboxEmailInputError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useAutoDismissMessage(message, setMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 4000 });

  const setActionLoading = (action: string, isLoading: boolean) => {
    setLoadingActions((prev) => ({ ...prev, [action]: isLoading }));
  };

  const isActionLoading = (action: string) => Boolean(loadingActions[action]);

  const isAnyPopupLoading =
    Boolean(parsingSuggestionId) ||
    saveLoading ||
    isActionLoading("connectMailbox") ||
    isActionLoading("disconnectMailbox") ||
    isActionLoading("syncMailbox") ||
    isActionLoading("loadSuggestions");

  const loadAssets = async () => {
    const response = await getAssets();
    setAssets(response);
  };

  const loadSuggestions = async () => {
    setActionLoading("loadSuggestions", true);
    try {
      const response = await getAssetSuggestions();
      setSuggestions(response);
    } finally {
      setActionLoading("loadSuggestions", false);
    }
  };

  const loadMailboxStatus = async () => {
    const status = await getMailboxStatus();
    setMailboxConnected(status.connected);
    setMailboxEmail(status.email_address ?? "");
  };

  const loadAssetCategories = async () => {
    const response = await getAssetCategories();
    setAssetCategories(response);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadAssets(), loadSuggestions(), loadMailboxStatus(), loadAssetCategories()]);
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : "Failed to fetch assets");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wizard = params.get("wizard");

    if (wizard === "gmail") {
      navigate("/assets/add?method=email_sync", { replace: true });
    }
  }, [navigate]);

  const parseCsvInput = (value: string): string[] => {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

  const handleConnectMailbox = async (emailOverride?: string) => {
    setActionLoading("connectMailbox", true);
    try {
      setError("");
      const response = await connectMailbox(emailOverride);
      window.location.href = response.auth_url;
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to start mailbox connection");
    } finally {
      setActionLoading("connectMailbox", false);
    }
  };

  const handleConnectClick = async () => {
    if (mailboxConnected) {
      return;
    }

    if (!mailboxEmail) {
      setMailboxEmailInput("");
      setMailboxEmailInputError("");
      setEmailPromptOpen(true);
      return;
    }

    await handleConnectMailbox();
  };

  const handleConfirmEmailPrompt = async () => {
    const normalizedEmail = mailboxEmailInput.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setMailboxEmailInputError("Enter a valid email address");
      return;
    }

    setMailboxEmailInputError("");
    setEmailPromptOpen(false);
    await handleConnectMailbox(normalizedEmail);
  };

  const handleDisconnectMailbox = async () => {
    setActionLoading("disconnectMailbox", true);
    try {
      setError("");
      setMessage("");
      await disconnectMailbox();
      setMailboxConnected(false);
      setMessage("Mailbox disconnected successfully.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to disconnect mailbox");
    } finally {
      setActionLoading("disconnectMailbox", false);
    }
  };

  const handleRunMailboxSync = async () => {
    setActionLoading("syncMailbox", true);
    try {
      setError("");
      setMessage("");
      let effectiveScanDays = scanDays;

      if (useCustomScanRange) {
        if (!scanFromDate || !scanToDate) {
          throw new Error("Select both From Date and To Date for custom scan.");
        }

        const from = new Date(`${scanFromDate}T00:00:00`);
        const to = new Date(`${scanToDate}T00:00:00`);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
          throw new Error("Custom date range is invalid.");
        }

        const daysDiff = Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        effectiveScanDays = Math.max(1, Math.min(daysDiff, 90));
      }

      const subjectKeywords = parseCsvInput(subjectKeywordsInput);
      const senderEmails = parseCsvInput(senderEmailsInput);

      const response = await syncMailboxEmails(effectiveScanDays, 200, subjectKeywords, senderEmails);
      await Promise.all([loadSuggestions(), loadAssets()]);
      setMessage(
        `Sync completed. Scanned ${response.scanned} emails and created ${response.created_suggestions} temporary suggestions.`
      );
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to sync mailbox");
    } finally {
      setActionLoading("syncMailbox", false);
    }
  };

  const handlePrepareSave = async (suggestion: AssetSuggestion) => {
    if (suggestion.already_added) {
      setMessage("This suggestion is already present in your assets.");
      return;
    }

    try {
      setError("");
      setParsingMessage("");
      setParsingSuggestionId(suggestion.id);
      const parsed = await parseSuggestionAttachment(suggestion.id);

      setSelectedSuggestion({
        ...suggestion,
        product_name: parsed.product_name ?? suggestion.product_name,
        brand: parsed.brand ?? suggestion.brand,
        vendor: parsed.vendor ?? suggestion.vendor,
        price: parsed.price ?? suggestion.price,
        purchase_date: parsed.purchase_date ?? suggestion.purchase_date,
      });

      if (parsed.status !== "parsed") {
        setParsingMessage(parsed.message || "Could not parse attachment. Please enter values manually.");
      }
    } catch (requestError: unknown) {
      setSelectedSuggestion(suggestion);
      setParsingMessage("Could not parse attachment. Please enter values manually.");
      setError(requestError instanceof Error ? requestError.message : "Failed to parse attachment");
    } finally {
      setParsingSuggestionId(null);
    }
  };

  const handleSaveAsset = async (payload: {
    product_name?: string;
    brand?: string;
    vendor?: string;
    price?: number;
    purchase_date?: string;
    category?: string;
    subcategory?: string;
    serial_number?: string;
    model_number?: string;
    invoice_number?: string;
    description?: string;
    notes?: string;
    location?: string;
    assigned_user?: string;
    lifecycle_info?: AssetLifecyclePayload;
    supporting_documents?: File[];
  }) => {
    if (!selectedSuggestion) {
      return;
    }

    try {
      setSaveLoading(true);
      setError("");
      const createdAsset = await createAsset({
        name: payload.product_name ?? selectedSuggestion.product_name,
        brand: payload.brand ?? selectedSuggestion.brand,
        category: payload.category ?? "Other",
        subcategory: payload.subcategory ?? "Custom Asset",
        vendor: payload.vendor ?? selectedSuggestion.vendor,
        purchase_date: payload.purchase_date ?? selectedSuggestion.purchase_date,
        price: payload.price ?? selectedSuggestion.price,
        serial_number: payload.serial_number,
        model_number: payload.model_number,
        invoice_number: payload.invoice_number,
        description: payload.description,
        notes: payload.notes,
        location: payload.location,
        assigned_user: payload.assigned_user,
        lifecycle_info: payload.lifecycle_info,
        source: "gmail",
        suggestion_id: selectedSuggestion.id,
      });

      setSuggestions((prev) => prev.filter((item) => item.id !== selectedSuggestion.id));
      setSelectedSuggestion(null);
      setParsingMessage("");
      await loadAssets();
      const reminderCount = Number(createdAsset.auto_reminders_created || 0);
      if (reminderCount > 0) {
        setMessage(`Suggestion added. Asset saved successfully with ${reminderCount} reminder${reminderCount === 1 ? "" : "s"}.`);
      } else {
        setMessage("Suggestion added. Asset saved successfully.");
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save asset");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleViewInvoice = async (asset: Asset) => {
    try {
      setError("");
      setInvoiceLoadingId(asset.id);
      const blob = await fetchAssetInvoiceBlob(asset.id);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to open invoice attachment");
    } finally {
      setInvoiceLoadingId(null);
    }
  };

  const handleViewAsset = async (assetId: string) => {
    try {
      setError("");
      setViewingAssetId(assetId);
      await getAssetById(assetId);
      navigate(`/assets/${assetId}`);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to open asset details");
    } finally {
      setViewingAssetId(null);
    }
  };

  const handleOpenEdit = (asset: Asset) => {
    setEditingAsset(asset);
    setEditForm({
      name: asset.name || "",
      brand: asset.brand || "",
      vendor: asset.vendor || "",
      price: asset.price !== null && asset.price !== undefined ? String(asset.price) : "",
      purchase_date: asset.purchase_date ? asset.purchase_date.slice(0, 10) : "",
      category: asset.category || "",
      subcategory: asset.subcategory || "",
    });
    setEditDialogOpen(true);
  };

  const getAssetStatusLabel = (asset: Asset) => {
    const value = String((asset as Asset & { status?: string }).status || "").trim();
    if (!value) {
      return "Active";
    }
    return value
      .replaceAll("_", " ")
      .split(" ")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join(" ");
  };

  const getStatusChipColor = (label: string): "success" | "warning" | "default" | "error" => {
    const normalized = label.toLowerCase();
    if (normalized === "active") {
      return "success";
    }
    if (normalized === "in repair") {
      return "warning";
    }
    if (normalized === "disposed") {
      return "error";
    }
    return "default";
  };

  const getWarrantyExpiryDate = (asset: Asset): Date | null => {
    const raw = (asset as Asset & { warranty_expiry?: string | null; warranty?: string | null }).warranty_expiry
      ?? (asset as Asset & { warranty_expiry?: string | null; warranty?: string | null }).warranty
      ?? null;

    if (!raw) {
      return null;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getWarrantyPresentation = (asset: Asset) => {
    const expiry = getWarrantyExpiryDate(asset);
    if (!expiry) {
      return {
        dateText: "-",
        metaText: "No warranty data",
        metaColor: "text.secondary" as const,
        tooltip: "Warranty information is unavailable",
      };
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expiryStart = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const diffDays = Math.ceil((expiryStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const elapsed = Math.abs(diffDays);
      return {
        dateText: expiry.toLocaleDateString(),
        metaText: "Expired",
        metaColor: "error.main" as const,
        tooltip: `Warranty expired ${elapsed} day${elapsed === 1 ? "" : "s"} ago`,
      };
    }

    if (diffDays <= 30) {
      return {
        dateText: expiry.toLocaleDateString(),
        metaText: "Expiring Soon",
        metaColor: "warning.main" as const,
        tooltip: `Warranty expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      };
    }

    return {
      dateText: expiry.toLocaleDateString(),
      metaText: "Valid",
      metaColor: "text.secondary" as const,
      tooltip: `Warranty expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
    };
  };

  const handleSaveEdit = async () => {
    if (!editingAsset) {
      return;
    }

    try {
      setEditSaving(true);
      setError("");
      const payload = {
        name: editForm.name.trim() || undefined,
        brand: editForm.brand.trim() || undefined,
        vendor: editForm.vendor.trim() || undefined,
        price: editForm.price ? Number(editForm.price) : undefined,
        purchase_date: editForm.purchase_date || undefined,
        category: editForm.category.trim() || undefined,
        subcategory: editForm.subcategory.trim() || undefined,
      };
      await updateAsset(editingAsset.id, payload);
      await loadAssets();
      setMessage("Asset updated successfully.");
      setEditDialogOpen(false);
      setEditingAsset(null);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update asset");
    } finally {
      setEditSaving(false);
    }
  };

  const handleOpenDelete = (asset: Asset) => {
    setDeletingAsset(asset);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAsset) {
      return;
    }

    try {
      setDeleteLoading(true);
      setError("");
      await deleteAsset(deletingAsset.id);
      await loadAssets();
      setMessage("Asset deleted successfully.");
      setDeleteDialogOpen(false);
      setDeletingAsset(null);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete asset");
    } finally {
      setDeleteLoading(false);
    }
  };

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const text = [asset.name, asset.brand, asset.vendor, asset.source, asset.category, asset.subcategory]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      const searchMatch = !normalizedQuery || text.includes(normalizedQuery);

      const nameMatch = !nameFilter.trim() || String(asset.name || "").toLowerCase().includes(nameFilter.trim().toLowerCase());
      const brandMatch = !brandFilter.trim() || String(asset.category || "").toLowerCase().includes(brandFilter.trim().toLowerCase());
      const vendorMatch = !vendorFilter.trim() || String(asset.vendor || "").toLowerCase().includes(vendorFilter.trim().toLowerCase());
      const sourceMatch = !sourceFilter.trim() || String(asset.source || "").toLowerCase().includes(sourceFilter.trim().toLowerCase());

      const price = asset.price !== null && asset.price !== undefined ? Number(asset.price) : null;
      const exactMatch = amountExact !== "" ? price === Number(amountExact) : true;
      const minMatch = amountMin !== "" ? price !== null && price >= Number(amountMin) : true;
      const maxMatch = amountMax !== "" ? price !== null && price <= Number(amountMax) : true;

      const purchaseDate = asset.purchase_date ? new Date(asset.purchase_date) : null;
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      const toDate = dateTo ? new Date(dateTo) : null;
      const fromMatch = fromDate ? purchaseDate !== null && purchaseDate >= fromDate : true;
      const toMatch = toDate ? purchaseDate !== null && purchaseDate <= toDate : true;

      return searchMatch && nameMatch && brandMatch && vendorMatch && sourceMatch && exactMatch && minMatch && maxMatch && fromMatch && toMatch;
    });
  }, [assets, normalizedQuery, nameFilter, brandFilter, vendorFilter, sourceFilter, amountExact, amountMin, amountMax, dateFrom, dateTo]);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(assets.map((asset) => String(asset.category || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const editCategoryOptions = useMemo(() => {
    const options = assetCategories.map((item) => item.category);
    if (editForm.category && !options.includes(editForm.category)) {
      return [editForm.category, ...options];
    }
    return options;
  }, [assetCategories, editForm.category]);

  const editSubcategoryOptions = useMemo(() => {
    const matched = assetCategories.find((item) => item.category === editForm.category);
    const options = matched?.subcategories ?? [];
    if (editForm.subcategory && !options.includes(editForm.subcategory)) {
      return [editForm.subcategory, ...options];
    }
    return options;
  }, [assetCategories, editForm.category, editForm.subcategory]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(assets.map((asset) => String(asset.source || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const paginatedAssets = filteredAssets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const formatSuggestionPrice = (price?: number) => {
    if (price === null || price === undefined) {
      return "-";
    }

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(price);
  };

  const downloadTextFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExport = (format: "csv" | "excel") => {
    setExporting(true);
    const rows = filteredAssets.map((asset) => [
      asset.name,
      asset.brand ?? "",
      asset.vendor ?? "",
      asset.purchase_date ? new Date(asset.purchase_date).toISOString().slice(0, 10) : "",
      asset.price ?? "",
      asset.source,
    ]);
    if (format === "csv") {
      const csv = [["Name", "Brand", "Vendor", "Purchase Date", "Price", "Source"], ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
        .join("\n");
      downloadTextFile(csv, "assets-export.csv", "text/csv;charset=utf-8;");
    } else {
      const tsv = [["Name", "Brand", "Vendor", "Purchase Date", "Price", "Source"], ...rows]
        .map((row) => row.map((cell) => String(cell).replaceAll("\t", " ")).join("\t"))
        .join("\n");
      downloadTextFile(tsv, "assets-export.xls", "application/vnd.ms-excel;charset=utf-8;");
    }
    setExporting(false);
    setExportAnchorEl(null);
  };

  // Route directly to the dedicated Add Asset page so it uses the existing page layout
  // instead of opening any Add Asset popup/wizard from the Assets screen.
  const handleAddAssetNavigation = () => {
    navigate("/assets/add");
  };

  return (
    <Box
      className="grid"
      sx={{
        height: "calc(100vh - 112px)",
        overflow: "hidden",
        alignContent: "flex-start",
      }}
    >
      <Box className="col-12">
        <div className="grid align-items-center">
          <div className="col-12 md:col-6">
            <Typography variant="h4">Assets</Typography>
          </div>
          <div className="col-12 md:col-6 flex md:justify-content-end">
            {/* Direct page navigation keeps Add Asset UX in AddAsset.tsx and avoids modal flow here. */}
            <Button variant="contained" onClick={handleAddAssetNavigation}>Add Asset</Button>
          </div>
        </div>
      </Box>

      <Box className="col-12" sx={{ minHeight: 0, display: "flex" }}>
        <Stack spacing={3} sx={{ minHeight: 0, flex: 1, overflow: "hidden" }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h6">Filter Section</Typography>
              <div className="grid align-items-end">
                <div className="col-12 md:col-6 lg:col-5 xl:col-6">
                  <TextField
                    size="small"
                    placeholder="Search by asset name, vendor, or category"
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setPage(0);
                    }}
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </div>
                <div className="col-12 md:col-6 lg:col-2 xl:col-2">
                  <TextField
                    size="small"
                    select
                    label="Category"
                    value={brandFilter}
                    onChange={(event) => {
                      setBrandFilter(event.target.value);
                      setPage(0);
                    }}
                    fullWidth
                  >
                    <MenuItem value="">All</MenuItem>
                    {categoryOptions.map((option) => (
                      <MenuItem key={option} value={option}>{option}</MenuItem>
                    ))}
                  </TextField>
                </div>
                <div className="col-12 md:col-6 lg:col-2 xl:col-2">
                  <TextField
                    size="small"
                    select
                    label="Status"
                    value={sourceFilter}
                    onChange={(event) => {
                      setSourceFilter(event.target.value);
                      setPage(0);
                    }}
                    fullWidth
                  >
                    <MenuItem value="">All</MenuItem>
                    {statusOptions.map((option) => (
                      <MenuItem key={option} value={option}>{option}</MenuItem>
                    ))}
                  </TextField>
                </div>
                <div className="col-12 md:col-6 lg:col-3 xl:col-2">
                  <Button
                    variant="outlined"
                    onClick={(event) => setMoreFiltersAnchorEl(event.currentTarget)}
                    fullWidth
                    sx={{ height: 36 }}
                  >
                    More Filters
                  </Button>
                </div>
              </div>

              <Popover
                open={Boolean(moreFiltersAnchorEl)}
                anchorEl={moreFiltersAnchorEl}
                onClose={() => setMoreFiltersAnchorEl(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
              >
                <Box sx={{ p: 2, width: { xs: 300, sm: 420 } }}>
                  <Stack spacing={1.5}>
                    <Typography variant="subtitle2">Additional Filters</Typography>
                    <div className="grid">
                      <div className="col-12 sm:col-6">
                        <TextField size="small" label="Vendor" value={vendorFilter} onChange={(e) => { setVendorFilter(e.target.value); setPage(0); }} fullWidth />
                      </div>
                      <div className="col-12 sm:col-6">
                        <TextField size="small" type="number" label="Exact Price" value={amountExact} onChange={(e) => { setAmountExact(e.target.value); setPage(0); }} fullWidth />
                      </div>
                      <div className="col-12 sm:col-6">
                        <TextField size="small" type="number" label="Min Price" value={amountMin} onChange={(e) => { setAmountMin(e.target.value); setPage(0); }} fullWidth />
                      </div>
                      <div className="col-12 sm:col-6">
                        <TextField size="small" type="number" label="Max Price" value={amountMax} onChange={(e) => { setAmountMax(e.target.value); setPage(0); }} fullWidth />
                      </div>
                      <div className="col-12 sm:col-6">
                        <TextField size="small" type="date" label="Purchase From" InputLabelProps={{ shrink: true }} value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} fullWidth />
                      </div>
                      <div className="col-12 sm:col-6">
                        <TextField size="small" type="date" label="Purchase To" InputLabelProps={{ shrink: true }} value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} fullWidth />
                      </div>
                    </div>
                  </Stack>
                </Box>
              </Popover>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}>
            <Stack spacing={1.5} sx={{ minHeight: 0, flex: 1 }}>
              <div className="grid align-items-center">
                <div className="col-12 md:col-6">
                  <Typography variant="h6">Asset Grid</Typography>
                </div>
                <div className="col-12 md:col-6 flex md:justify-content-end">
                  <Button
                    variant="outlined"
                    endIcon={exporting ? <CircularProgress size={14} /> : <ArrowDropDownIcon />}
                    onClick={(event) => setExportAnchorEl(event.currentTarget)}
                    disabled={exporting}
                    sx={{ height: 36 }}
                  >
                    Export
                  </Button>
                  <Menu
                    anchorEl={exportAnchorEl}
                    open={Boolean(exportAnchorEl)}
                    onClose={() => setExportAnchorEl(null)}
                  >
                    <MenuItem onClick={() => handleExport("csv")}>CSV</MenuItem>
                    <MenuItem onClick={() => handleExport("excel")}>Excel</MenuItem>
                  </Menu>
                </div>
              </div>

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <>
                  <Paper variant="outlined" sx={{ height: 500, overflowY: "auto", overflowX: "auto", minHeight: 0 }}>
                    <Box sx={{ minWidth: 1120 }}>
                      <Box
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1.8fr 1.2fr 1.2fr 1.2fr 1.2fr 1fr 1.2fr",
                          columnGap: 2,
                          px: 2,
                          py: 1.25,
                          bgcolor: "grey.100",
                          borderBottom: 1,
                          borderColor: "divider",
                          position: "sticky",
                          top: 0,
                          zIndex: 1,
                        }}
                      >
                        <Typography variant="subtitle2">Asset Name</Typography>
                        <Typography variant="subtitle2">Category</Typography>
                        <Typography variant="subtitle2">Vendor</Typography>
                        <Typography variant="subtitle2">Purchase Date</Typography>
                        <Typography variant="subtitle2">Warranty Expiry</Typography>
                        <Typography variant="subtitle2">Status</Typography>
                        <Typography variant="subtitle2">Actions</Typography>
                      </Box>

                      {paginatedAssets.map((asset) => (
                        (() => {
                          const statusLabel = getAssetStatusLabel(asset);
                          const warranty = getWarrantyPresentation(asset);

                          return (
                        <Box
                          key={asset.id}
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "1.8fr 1.2fr 1.2fr 1.2fr 1.2fr 1fr 1.2fr",
                            columnGap: 2,
                            alignItems: "center",
                            px: 2,
                            py: 1.1,
                            borderBottom: 1,
                            borderColor: "divider",
                          }}
                        >
                          <Typography variant="body2">{asset.name || "-"}</Typography>
                          <Typography variant="body2">{asset.category || "-"}</Typography>
                          <Typography variant="body2">{asset.vendor || "-"}</Typography>
                          <Typography variant="body2">{asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : "-"}</Typography>
                          <Tooltip title={warranty.tooltip}>
                            <Box>
                              <Typography variant="body2">{warranty.dateText}</Typography>
                              <Typography variant="caption" sx={{ color: warranty.metaColor }}>
                                {warranty.metaText}
                              </Typography>
                            </Box>
                          </Tooltip>
                          <Box>
                            <Chip size="small" label={statusLabel} color={getStatusChipColor(statusLabel)} variant="filled" />
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <Tooltip title="View">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setQuickViewAsset(asset);
                                  }}
                                >
                                  <VisibilityOutlinedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton size="small" onClick={() => handleOpenEdit(asset)}>
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton size="small" color="error" onClick={() => handleOpenDelete(asset)}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="View Invoice">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    void handleViewInvoice(asset);
                                  }}
                                  disabled={!asset.invoice_attachment_path || invoiceLoadingId === asset.id}
                                >
                                  {invoiceLoadingId === asset.id ? <CircularProgress size={16} /> : <VisibilityOutlinedIcon fontSize="small" />}
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </Box>
                          );
                        })()
                      ))}
                    </Box>
                  </Paper>

                  <TablePagination
                    component="div"
                    count={filteredAssets.length}
                    page={page}
                    onPageChange={(_, nextPage) => setPage(nextPage)}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={(event) => {
                      setRowsPerPage(Number(event.target.value));
                      setPage(0);
                    }}
                    rowsPerPageOptions={[5, 10, 25, 50]}
                  />
                </>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Box>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Asset</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField label="Name" value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} fullWidth />
            <TextField label="Brand" value={editForm.brand} onChange={(e) => setEditForm((prev) => ({ ...prev, brand: e.target.value }))} fullWidth />
            <TextField
              select
              label="Category"
              value={editForm.category}
              onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value, subcategory: "" }))}
              fullWidth
            >
              {editCategoryOptions.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="SubCategory"
              value={editForm.subcategory}
              onChange={(e) => setEditForm((prev) => ({ ...prev, subcategory: e.target.value }))}
              fullWidth
              disabled={!editForm.category}
            >
              {editSubcategoryOptions.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            <TextField label="Vendor" value={editForm.vendor} onChange={(e) => setEditForm((prev) => ({ ...prev, vendor: e.target.value }))} fullWidth />
            <TextField label="Price" type="number" value={editForm.price} onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))} fullWidth />
            <TextField label="Purchase Date" type="date" value={editForm.purchase_date} onChange={(e) => setEditForm((prev) => ({ ...prev, purchase_date: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={editSaving}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveEdit()} disabled={editSaving}>
            {editSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete Asset</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this asset?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => void handleConfirmDelete()} disabled={deleteLoading}>
            {deleteLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer
        anchor="right"
        open={Boolean(quickViewAsset)}
        onClose={() => setQuickViewAsset(null)}
      >
        <Box sx={{ width: { xs: 320, sm: 380 }, p: 2.5, display: "flex", flexDirection: "column", height: "100%" }}>
          <Typography variant="h6">Asset Details</Typography>
          <Divider sx={{ my: 1.5 }} />

          {quickViewAsset ? (
            <Stack spacing={1.25}>
              <Typography variant="body2"><strong>Asset Name:</strong> {quickViewAsset.name || "-"}</Typography>
              <Typography variant="body2"><strong>Category:</strong> {quickViewAsset.category || "-"}</Typography>
              <Typography variant="body2"><strong>Vendor:</strong> {quickViewAsset.vendor || "-"}</Typography>
              <Typography variant="body2"><strong>Purchase Date:</strong> {quickViewAsset.purchase_date ? new Date(quickViewAsset.purchase_date).toLocaleDateString() : "-"}</Typography>
              <Typography variant="body2"><strong>Purchase Price:</strong> {quickViewAsset.price ?? "-"}</Typography>
              <Typography variant="body2"><strong>Warranty Expiry:</strong> {getWarrantyPresentation(quickViewAsset).dateText}</Typography>
              <Typography variant="body2"><strong>Status:</strong> {getAssetStatusLabel(quickViewAsset)}</Typography>
            </Stack>
          ) : null}

          <Box sx={{ mt: "auto", pt: 2, display: "flex", gap: 1, justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              onClick={() => {
                if (!quickViewAsset) {
                  return;
                }
                void handleViewAsset(quickViewAsset.id);
              }}
              disabled={!quickViewAsset || viewingAssetId === quickViewAsset.id}
            >
              {quickViewAsset && viewingAssetId === quickViewAsset.id ? "Opening..." : "Open Full Asset Page"}
            </Button>
            <Button variant="outlined" onClick={() => setQuickViewAsset(null)}>Close</Button>
          </Box>
        </Box>
      </Drawer>

    </Box>
  );
};

export default Assets;
