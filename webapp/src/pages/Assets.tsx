import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableContainer,
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
import {
  Asset,
  AssetSuggestion,
  connectMailbox,
  createAsset,
  deleteAsset,
  disconnectMailbox,
  fetchAssetInvoiceBlob,
  getAssetById,
  getAssetSuggestions,
  getAssets,
  getMailboxStatus,
  parseSuggestionAttachment,
  rejectSuggestion,
  updateAsset,
  syncMailboxEmails,
} from "../services/gmail.ts";

type WizardSource = "gmail" | "qr" | "invoice" | "excel" | "manual";

const Assets = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AssetSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [parsingSuggestionId, setParsingSuggestionId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState<WizardSource>("gmail");
  const [mailboxConnected, setMailboxConnected] = useState(false);
  const [mailboxEmail, setMailboxEmail] = useState("");
  const [scanDays, setScanDays] = useState(10);
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
  const [exporting, setExporting] = useState(false);
  const [viewingAssetId, setViewingAssetId] = useState<string | null>(null);
  const [invoiceLoadingId, setInvoiceLoadingId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    brand: "",
    vendor: "",
    price: "",
    purchase_date: "",
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [mailboxEmailInput, setMailboxEmailInput] = useState("");
  const [mailboxEmailInputError, setMailboxEmailInputError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadAssets = async () => {
    const response = await getAssets();
    setAssets(response);
  };

  const loadSuggestions = async () => {
    const response = await getAssetSuggestions();
    setSuggestions(response);
  };

  const loadMailboxStatus = async () => {
    const status = await getMailboxStatus();
    setMailboxConnected(status.connected);
    setMailboxEmail(status.email_address ?? "");
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadAssets(), loadSuggestions(), loadMailboxStatus()]);
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
    const gmailStatus = params.get("gmail_status");
    const gmailMessage = params.get("gmail_message");

    if (wizard === "gmail") {
      setWizardOpen(true);
      setSelectedSource("gmail");
      if (gmailStatus === "connected") {
        setMessage("Gmail connected successfully. You can continue mailbox sync in the wizard.");
      }
      if (gmailStatus === "error") {
        setError(gmailMessage || "Failed to connect Gmail.");
      }
      window.history.replaceState({}, "", "/assets");
    }
  }, []);

  const parseCsvInput = (value: string): string[] => {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

  const handleConnectMailbox = async (emailOverride?: string) => {
    try {
      setError("");
      const response = await connectMailbox(emailOverride);
      window.location.href = response.auth_url;
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to start mailbox connection");
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
    try {
      setError("");
      setMessage("");
      setDisconnecting(true);
      await disconnectMailbox();
      setMailboxConnected(false);
      setMessage("Mailbox disconnected successfully.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to disconnect mailbox");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleRunMailboxSync = async () => {
    try {
      setError("");
      setMessage("");
      setSyncing(true);
      const subjectKeywords = parseCsvInput(subjectKeywordsInput);
      const senderEmails = parseCsvInput(senderEmailsInput);

      const response = await syncMailboxEmails(scanDays, 200, subjectKeywords, senderEmails);
      await Promise.all([loadSuggestions(), loadAssets()]);
      setMessage(
        `Sync completed. Scanned ${response.scanned} emails and created ${response.created_suggestions} temporary suggestions.`
      );
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to sync mailbox");
    } finally {
      setSyncing(false);
    }
  };

  const handlePrepareSave = async (suggestion: AssetSuggestion) => {
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
    warranty?: string;
    category?: string;
    location?: string;
  }) => {
    if (!selectedSuggestion) {
      return;
    }

    try {
      setSaveLoading(true);
      setError("");
      await createAsset({
        name: payload.product_name ?? selectedSuggestion.product_name,
        brand: payload.brand ?? selectedSuggestion.brand,
        vendor: payload.vendor ?? selectedSuggestion.vendor,
        purchase_date: payload.purchase_date ?? selectedSuggestion.purchase_date,
        price: payload.price ?? selectedSuggestion.price,
        source: "gmail",
        suggestion_id: selectedSuggestion.id,
      });

      setSuggestions((prev) => prev.filter((item) => item.id !== selectedSuggestion.id));
      setSelectedSuggestion(null);
      setParsingMessage("");
      await loadAssets();
      setMessage("Suggestion added. Asset saved successfully.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save asset");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDiscardSuggestion = async (suggestionId: string) => {
    try {
      setError("");
      await rejectSuggestion(suggestionId);
      setSuggestions((prev) => prev.filter((item) => item.id !== suggestionId));
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to discard suggestion");
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
    });
    setEditDialogOpen(true);
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
      const text = [asset.name, asset.brand, asset.vendor, asset.source]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      const searchMatch = !normalizedQuery || text.includes(normalizedQuery);

      const nameMatch = !nameFilter.trim() || String(asset.name || "").toLowerCase().includes(nameFilter.trim().toLowerCase());
      const brandMatch = !brandFilter.trim() || String(asset.brand || "").toLowerCase().includes(brandFilter.trim().toLowerCase());
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

  const paginatedAssets = filteredAssets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

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

  return (
    <Box>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4">Assets</Typography>
        <Button variant="contained" onClick={() => setWizardOpen(true)}>Add Asset</Button>
      </Stack>

      <Paper sx={{ p: { xs: 2, md: 3 }, overflowX: "auto" }}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              placeholder="Search assets"
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
            <Button
              variant="outlined"
              endIcon={exporting ? <CircularProgress size={14} /> : <ArrowDropDownIcon />}
              onClick={(event) => setExportAnchorEl(event.currentTarget)}
              disabled={exporting}
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
          </Stack>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <TableContainer>
              <Table
                size="small"
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  "& .MuiTableCell-root": { border: "1px solid", borderColor: "divider" },
                  "& .MuiTableCell-head": { fontWeight: 700 },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Brand</TableCell>
                    <TableCell>Vendor</TableCell>
                    <TableCell>Purchase Date</TableCell>
                    <TableCell>Price</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Invoice</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <TextField size="small" placeholder="Search" value={nameFilter} onChange={(e) => { setNameFilter(e.target.value); setPage(0); }} fullWidth />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" placeholder="Search" value={brandFilter} onChange={(e) => { setBrandFilter(e.target.value); setPage(0); }} fullWidth />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" placeholder="Search" value={vendorFilter} onChange={(e) => { setVendorFilter(e.target.value); setPage(0); }} fullWidth />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.75}>
                        <TextField size="small" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(0); }} />
                        <TextField size="small" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(0); }} />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.75}>
                        <TextField size="small" type="number" placeholder="Exact" value={amountExact} onChange={(e) => { setAmountExact(e.target.value); setPage(0); }} />
                        <TextField size="small" type="number" placeholder="Min" value={amountMin} onChange={(e) => { setAmountMin(e.target.value); setPage(0); }} />
                        <TextField size="small" type="number" placeholder="Max" value={amountMax} onChange={(e) => { setAmountMax(e.target.value); setPage(0); }} />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <TextField size="small" placeholder="Search" value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); setPage(0); }} fullWidth />
                    </TableCell>
                    <TableCell />
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedAssets.map((asset) => (
                    <TableRow key={asset.id} hover>
                      <TableCell>{asset.name}</TableCell>
                      <TableCell>{asset.brand || "-"}</TableCell>
                      <TableCell>{asset.vendor || "-"}</TableCell>
                      <TableCell>{asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : "-"}</TableCell>
                      <TableCell>{asset.price ?? "-"}</TableCell>
                      <TableCell>
                        <Chip size="small" label={asset.source} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        {asset.invoice_attachment_path ? (
                          <Tooltip title="View Invoice">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  void handleViewInvoice(asset);
                                }}
                                disabled={invoiceLoadingId === asset.id}
                              >
                                {invoiceLoadingId === asset.id ? <CircularProgress size={16} /> : <VisibilityOutlinedIcon fontSize="small" />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="View">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  void handleViewAsset(asset.id);
                                }}
                                disabled={viewingAssetId === asset.id}
                              >
                                {viewingAssetId === asset.id ? <CircularProgress size={16} /> : <VisibilityOutlinedIcon fontSize="small" />}
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
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            </TableContainer>
          )}
        </Stack>
      </Paper>

      <Dialog open={wizardOpen} onClose={() => setWizardOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Add Asset Wizard</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Choose Import Method"
              value={selectedSource}
              onChange={(event) => setSelectedSource(event.target.value as WizardSource)}
              fullWidth
            >
              <MenuItem value="gmail">Sync from Mailbox (Gmail)</MenuItem>
              <MenuItem value="qr">QR/Bar Code Scan</MenuItem>
              <MenuItem value="invoice">Invoice Upload</MenuItem>
              <MenuItem value="excel">Excel Upload</MenuItem>
              <MenuItem value="manual">Manual Entry</MenuItem>
            </TextField>

            {selectedSource === "gmail" ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
                    <Chip label={mailboxConnected ? "Mailbox Connected" : "Mailbox Not Connected"} color={mailboxConnected ? "success" : "default"} />
                    <Button variant="outlined" onClick={() => void handleConnectClick()} disabled={mailboxConnected}>Connect Mailbox</Button>
                    <Button variant="outlined" color="error" onClick={() => void handleDisconnectMailbox()} disabled={!mailboxConnected || disconnecting}>
                      {disconnecting ? "Disconnecting..." : "Disconnect"}
                    </Button>
                  </Stack>
                  {mailboxConnected && mailboxEmail ? (
                    <Typography variant="body2" color="text.secondary">
                      Using configured mailbox: {mailboxEmail}
                    </Typography>
                  ) : (
                    <Alert severity="warning">
                      No configured mailbox email found in profile. Connect mailbox once and it will be saved for future sync.
                    </Alert>
                  )}

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                    <TextField
                      select
                      label="Number of days"
                      value={scanDays}
                      onChange={(event) => setScanDays(Number(event.target.value))}
                      fullWidth
                    >
                      <MenuItem value={7}>7 days</MenuItem>
                      <MenuItem value={10}>10 days</MenuItem>
                      <MenuItem value={30}>30 days</MenuItem>
                      <MenuItem value={60}>60 days</MenuItem>
                      <MenuItem value={90}>90 days</MenuItem>
                    </TextField>
                    <TextField
                      label="Subject keywords (comma-separated)"
                      value={subjectKeywordsInput}
                      onChange={(event) => setSubjectKeywordsInput(event.target.value)}
                      placeholder="invoice, receipt"
                      fullWidth
                    />
                  </Stack>

                  <TextField
                    label="Sender email filters (comma-separated, optional)"
                    value={senderEmailsInput}
                    onChange={(event) => setSenderEmailsInput(event.target.value)}
                    placeholder="amazon.com, apple.com"
                    fullWidth
                  />

                  <FormControlLabel control={<Checkbox checked={attachmentsMandatory} disabled />} label="Attachments mandatory" />
                  <Alert severity="info">Only emails with supported attachments and matching filters are scanned.</Alert>

                  <Button variant="contained" onClick={handleRunMailboxSync} disabled={syncing || !mailboxConnected}>
                    {syncing ? "Scanning Emails..." : "Sync from Mailbox"}
                  </Button>

                  {suggestions.length > 0 ? (
                    <Stack spacing={1.25}>
                      <Typography variant="subtitle1">Suggestions</Typography>
                      {suggestions.map((suggestion) => (
                        <Paper key={suggestion.id} variant="outlined" sx={{ p: 1.5 }}>
                          <Stack spacing={1}>
                            <Typography variant="body2">Sender: {suggestion.sender || "-"}</Typography>
                            <Typography variant="body2">Subject: {suggestion.subject || "-"}</Typography>
                            <Typography variant="body2">Product: {suggestion.product_name || "-"}</Typography>
                            <Typography variant="body2">Attachment: {suggestion.attachment_filename || "-"}</Typography>
                            <Stack direction="row" spacing={1}>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => {
                                  void handlePrepareSave(suggestion);
                                }}
                                disabled={parsingSuggestionId === suggestion.id}
                              >
                                {parsingSuggestionId === suggestion.id ? "Parsing..." : "Add Asset"}
                              </Button>
                              <Button
                                size="small"
                                variant="text"
                                color="error"
                                onClick={() => {
                                  void handleDiscardSuggestion(suggestion.id);
                                }}
                              >
                                Skip
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No temporary suggestions available. Run mailbox sync to fetch suggestions.</Typography>
                  )}
                </Stack>
              </Paper>
            ) : (
              <Alert severity="info">This option will be enabled in the next phase.</Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWizardOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={emailPromptOpen} onClose={() => setEmailPromptOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Enter Mailbox Email</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No profile email was found. Enter the mailbox email to continue connection.
            </Typography>
            <TextField
              label="Email"
              type="email"
              value={mailboxEmailInput}
              onChange={(event) => {
                setMailboxEmailInput(event.target.value);
                if (mailboxEmailInputError) {
                  setMailboxEmailInputError("");
                }
              }}
              error={Boolean(mailboxEmailInputError)}
              helperText={mailboxEmailInputError}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmailPromptOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleConfirmEmailPrompt()}>Continue</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Asset</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField label="Name" value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} fullWidth />
            <TextField label="Brand" value={editForm.brand} onChange={(e) => setEditForm((prev) => ({ ...prev, brand: e.target.value }))} fullWidth />
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

      <AssetPreviewModal
        open={Boolean(selectedSuggestion)}
        suggestion={selectedSuggestion}
        parsingMessage={parsingMessage}
        saveLoading={saveLoading}
        onClose={() => {
          if (saveLoading) {
            return;
          }
          setSelectedSuggestion(null);
          setParsingMessage("");
        }}
        onSave={handleSaveAsset}
      />
    </Box>
  );
};

export default Assets;
