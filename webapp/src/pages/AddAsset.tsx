import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import AssetPreviewModal from "../components/modules/AssetPreviewModal.tsx";
import {
  AssetSuggestion,
  connectMailbox,
  createAsset,
  disconnectMailbox,
  getAssetSuggestions,
  getMailboxStatus,
  parseSuggestionAttachment,
  syncMailboxEmails,
} from "../services/gmail.ts";

type AddAssetMethod = "email_sync" | "excel_upload" | "barcode_qr" | "manual_entry";

const AddAsset = () => {
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AssetSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [parsingSuggestionId, setParsingSuggestionId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [mailboxConnected, setMailboxConnected] = useState(false);
  const [mailboxEmail, setMailboxEmail] = useState("");
  const [scanDays, setScanDays] = useState(10);
  const [useCustomScanRange, setUseCustomScanRange] = useState(false);
  const [scanFromDate, setScanFromDate] = useState("");
  const [scanToDate, setScanToDate] = useState("");
  const [subjectKeywordsInput, setSubjectKeywordsInput] = useState("invoice, receipt");
  const [senderEmailsInput, setSenderEmailsInput] = useState("");
  const [mailboxEmailInput, setMailboxEmailInput] = useState("");
  const [mailboxEmailInputError, setMailboxEmailInputError] = useState("");
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [parsingMessage, setParsingMessage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<AddAssetMethod>("email_sync");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [manualForm, setManualForm] = useState({
    name: "",
    category: "",
    vendor: "",
    purchaseDate: "",
    price: "",
    warranty: "",
  });

  const setActionLoading = (action: string, isLoading: boolean) => {
    setLoadingActions((prev) => ({ ...prev, [action]: isLoading }));
  };

  const isActionLoading = (action: string) => Boolean(loadingActions[action]);

  const parseCsvInput = (value: string): string[] => {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

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

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadSuggestions(), loadMailboxStatus()]);
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load Add Asset page");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gmailStatus = params.get("gmail_status");
    const gmailMessage = params.get("gmail_message");

    if (gmailStatus === "connected") {
      setMessage("Gmail connected successfully. You can run mailbox sync now.");
    }
    if (gmailStatus === "error") {
      setError(gmailMessage || "Failed to connect Gmail.");
    }

    if (gmailStatus || gmailMessage) {
      window.history.replaceState({}, "", "/assets/add");
    }
  }, []);

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
      setSuggestions([]);
      setSelectedSuggestion(null);
      setParsingMessage("");
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
      await loadSuggestions();
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

      setSuggestions((prev) =>
        prev.map((item) =>
          item.id === selectedSuggestion.id
            ? {
                ...item,
                already_added: true,
              }
            : item
        )
      );
      setSelectedSuggestion(null);
      setParsingMessage("");
      setMessage("Suggestion added. Asset saved successfully.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save asset");
    } finally {
      setSaveLoading(false);
    }
  };

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

  const standardControlHeight = 36;
  const standardFieldSx = {
    "& .MuiInputBase-root": {
      height: standardControlHeight,
    },
  };

  const handleExcelUpload = () => {
    if (!excelFile) {
      return;
    }
    setMessage("Excel upload UI is ready. Processing will be enabled in the next phase.");
  };

  const handleManualSave = () => {
    setMessage("Manual entry UI is ready. Save processing will be enabled in the next phase.");
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
        <Typography variant="h4">Add Asset</Typography>
      </Box>

      <Box className="col-12">
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <div className="grid align-items-end">
            <div className="col-12 md:col-6 lg:col-4">
              <TextField
                select
                size="small"
                label="Add Asset Method"
                value={selectedMethod}
                onChange={(event) => setSelectedMethod(event.target.value as AddAssetMethod)}
                sx={standardFieldSx}
                fullWidth
              >
                <MenuItem value="email_sync">Email Sync</MenuItem>
                <MenuItem value="excel_upload">Excel Upload</MenuItem>
                <MenuItem value="barcode_qr">Barcode / QR Code Scan</MenuItem>
                <MenuItem value="manual_entry">Manual Entry</MenuItem>
              </TextField>
            </div>
          </div>
        </Paper>
      </Box>

      <Box className="col-12" sx={{ minHeight: 0, display: "flex" }}>
        <Stack spacing={3} sx={{ minHeight: 0, flex: 1, overflow: "hidden" }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          {loading ? (
            <Paper sx={{ p: 4, display: "flex", justifyContent: "center" }}>
              <CircularProgress size={30} />
            </Paper>
          ) : (
            <>
              {selectedMethod === "email_sync" ? (
                <Stack spacing={3} sx={{ minHeight: 0, overflow: "hidden" }}>
                  <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2}>
                      <Typography variant="h6">Mailbox Connection</Typography>
                      <div className="grid align-items-center">
                        <div className="col-12 lg:col-9">
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                bgcolor: mailboxConnected ? "success.main" : "grey.500",
                                flexShrink: 0,
                              }}
                            />
                            <Typography variant="body1" fontWeight={500}>
                              {mailboxConnected ? "Connected" : "Not Connected"}
                            </Typography>
                          </Box>
                        </div>
                        <div className="col-12 lg:col-3 flex lg:justify-content-end">
                          <Button
                            variant="outlined"
                            color={mailboxConnected ? "error" : "primary"}
                            onClick={() => {
                              if (mailboxConnected) {
                                void handleDisconnectMailbox();
                              } else {
                                void handleConnectClick();
                              }
                            }}
                            disabled={isActionLoading("connectMailbox") || isActionLoading("disconnectMailbox")}
                            sx={{ height: standardControlHeight }}
                          >
                            {isActionLoading("connectMailbox")
                              ? "Connecting..."
                              : isActionLoading("disconnectMailbox")
                                ? "Disconnecting..."
                                : mailboxConnected
                                  ? "Disconnect"
                                  : "Connect"}
                          </Button>
                        </div>
                      </div>
                      {mailboxConnected && mailboxEmail ? (
                        <Typography variant="body2" color="text.secondary">
                          Using configured mailbox: {mailboxEmail}
                        </Typography>
                      ) : (
                        <Alert severity="warning">
                          No configured mailbox email found in profile. Connect mailbox once and it will be saved for future sync.
                        </Alert>
                      )}
                    </Stack>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2}>
                      <Typography variant="h6">Mail Filters</Typography>
                      <div className="grid align-items-end">
                        <div className={useCustomScanRange ? "col-12 md:col-6 lg:col-3" : "col-12 md:col-4"}>
                          <TextField
                            size="small"
                            label="From Email"
                            value={senderEmailsInput}
                            onChange={(event) => setSenderEmailsInput(event.target.value)}
                            placeholder="amazon.com, apple.com"
                            sx={standardFieldSx}
                            fullWidth
                          />
                        </div>
                        <div className={useCustomScanRange ? "col-12 md:col-6 lg:col-3" : "col-12 md:col-4"}>
                          <TextField
                            size="small"
                            label="Keyword / Subject"
                            value={subjectKeywordsInput}
                            onChange={(event) => setSubjectKeywordsInput(event.target.value)}
                            placeholder="invoice, receipt"
                            sx={standardFieldSx}
                            fullWidth
                          />
                        </div>
                        <div className={useCustomScanRange ? "col-12 md:col-6 lg:col-2" : "col-12 md:col-4"}>
                          <TextField
                            size="small"
                            select
                            label="Number of Days"
                            value={useCustomScanRange ? -1 : scanDays}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              if (value === -1) {
                                setUseCustomScanRange(true);
                                return;
                              }
                              setUseCustomScanRange(false);
                              setScanDays(value);
                            }}
                            sx={standardFieldSx}
                            fullWidth
                          >
                            <MenuItem value={7}>7 days</MenuItem>
                            <MenuItem value={15}>15 days</MenuItem>
                            <MenuItem value={30}>30 days</MenuItem>
                            <MenuItem value={-1}>Custom</MenuItem>
                          </TextField>
                        </div>
                        {useCustomScanRange ? (
                          <>
                            <div className="col-12 md:col-6 lg:col-2">
                              <TextField
                                size="small"
                                label="From Date"
                                type="date"
                                value={scanFromDate}
                                onChange={(event) => setScanFromDate(event.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={standardFieldSx}
                                fullWidth
                              />
                            </div>
                            <div className="col-12 md:col-6 lg:col-2">
                              <TextField
                                size="small"
                                label="To Date"
                                type="date"
                                value={scanToDate}
                                onChange={(event) => setScanToDate(event.target.value)}
                                InputLabelProps={{ shrink: true }}
                                sx={standardFieldSx}
                                fullWidth
                              />
                            </div>
                          </>
                        ) : null}
                      </div>

                      <div className="grid">
                        <div className="col-12 md:col-4 lg:col-3">
                          <Stack spacing={1}>
                            <Button
                              variant="contained"
                              onClick={handleRunMailboxSync}
                              disabled={isActionLoading("syncMailbox") || !mailboxConnected || isActionLoading("loadSuggestions")}
                              sx={{ height: standardControlHeight, minWidth: 180 }}
                            >
                              Sync from Mailbox
                            </Button>
                            <Box sx={{ height: 4 }}>
                              <LinearProgress
                                sx={{
                                  visibility: isActionLoading("syncMailbox") ? "visible" : "hidden",
                                  borderRadius: 999,
                                }}
                              />
                            </Box>
                          </Stack>
                        </div>
                      </div>
                    </Stack>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}>
                    <Stack spacing={1.5}>
                      <Typography variant="h6">Asset Suggestions</Typography>
                      {isActionLoading("loadSuggestions") ? <CircularProgress size={20} /> : null}

                      {suggestions.length > 0 ? (
                        <Paper variant="outlined" sx={{ height: 420, overflowY: "auto", overflowX: "auto" }}>
                          <Box sx={{ minWidth: 920 }}>
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns: "2fr 1.4fr 1fr 1.2fr 1.1fr 0.9fr",
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
                              <Typography variant="subtitle2">Product Name</Typography>
                              <Typography variant="subtitle2">Vendor</Typography>
                              <Typography variant="subtitle2">Price</Typography>
                              <Typography variant="subtitle2">Purchase Date</Typography>
                              <Typography variant="subtitle2">Status</Typography>
                              <Typography variant="subtitle2">Action</Typography>
                            </Box>

                            {suggestions.map((suggestion) => (
                              <Box
                                key={suggestion.id}
                                sx={{
                                  display: "grid",
                                  gridTemplateColumns: "2fr 1.4fr 1fr 1.2fr 1.1fr 0.9fr",
                                  columnGap: 2,
                                  alignItems: "center",
                                  px: 2,
                                  py: 1.1,
                                  borderBottom: 1,
                                  borderColor: "divider",
                                }}
                              >
                                <Typography variant="body2">{suggestion.product_name || "-"}</Typography>
                                <Typography variant="body2">{suggestion.vendor || suggestion.sender || "-"}</Typography>
                                <Typography variant="body2">{formatSuggestionPrice(suggestion.price)}</Typography>
                                <Typography variant="body2">
                                  {suggestion.purchase_date ? new Date(suggestion.purchase_date).toLocaleDateString() : "-"}
                                </Typography>
                                <Typography variant="body2" color={suggestion.already_added ? "warning.main" : "success.main"}>
                                  {suggestion.already_added ? "Already Added" : "New"}
                                </Typography>
                                <Button
                                  variant="outlined"
                                  onClick={() => {
                                    void handlePrepareSave(suggestion);
                                  }}
                                  disabled={suggestion.already_added || parsingSuggestionId === suggestion.id}
                                  sx={{
                                    height: standardControlHeight,
                                    minWidth: 90,
                                    px: 1.5,
                                    fontSize: "0.875rem",
                                  }}
                                >
                                  {suggestion.already_added ? "Added" : parsingSuggestionId === suggestion.id ? "Parsing..." : "Add"}
                                </Button>
                              </Box>
                            ))}
                          </Box>
                        </Paper>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No asset suggestions available.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                </Stack>
              ) : null}

              {selectedMethod === "excel_upload" ? (
                <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack spacing={2}>
                    <Typography variant="h6">Upload Excel File</Typography>
                    <div className="grid align-items-end">
                      <div className="col-12 md:col-8 lg:col-6">
                        <Button
                          component="label"
                          variant="outlined"
                          sx={{ height: standardControlHeight, justifyContent: "flex-start", width: "100%" }}
                        >
                          {excelFile ? excelFile.name : "Choose File"}
                          <input
                            type="file"
                            accept=".xls,.xlsx"
                            hidden
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null;
                              setExcelFile(file);
                            }}
                          />
                        </Button>
                      </div>
                      <div className="col-12 md:col-4 lg:col-3">
                        <Button
                          variant="contained"
                          onClick={handleExcelUpload}
                          disabled={!excelFile}
                          sx={{ height: standardControlHeight, minWidth: 120 }}
                        >
                          Upload
                        </Button>
                      </div>
                    </div>
                  </Stack>
                </Paper>
              ) : null}

              {selectedMethod === "barcode_qr" ? (
                <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack spacing={1.5}>
                    <Typography variant="h6">Scan Barcode / QR Code</Typography>
                    <Alert severity="info">Use camera or scanner to capture barcode or QR code.</Alert>
                  </Stack>
                </Paper>
              ) : null}

              {selectedMethod === "manual_entry" ? (
                <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack spacing={2}>
                    <Typography variant="h6">Manual Entry</Typography>
                    <div className="grid align-items-end">
                      <div className="col-12 md:col-6 lg:col-4">
                        <TextField
                          size="small"
                          label="Asset Name"
                          value={manualForm.name}
                          onChange={(event) => setManualForm((prev) => ({ ...prev, name: event.target.value }))}
                          sx={standardFieldSx}
                          fullWidth
                        />
                      </div>
                      <div className="col-12 md:col-6 lg:col-4">
                        <TextField
                          size="small"
                          label="Category"
                          value={manualForm.category}
                          onChange={(event) => setManualForm((prev) => ({ ...prev, category: event.target.value }))}
                          sx={standardFieldSx}
                          fullWidth
                        />
                      </div>
                      <div className="col-12 md:col-6 lg:col-4">
                        <TextField
                          size="small"
                          label="Vendor"
                          value={manualForm.vendor}
                          onChange={(event) => setManualForm((prev) => ({ ...prev, vendor: event.target.value }))}
                          sx={standardFieldSx}
                          fullWidth
                        />
                      </div>
                      <div className="col-12 md:col-6 lg:col-4">
                        <TextField
                          size="small"
                          label="Purchase Date"
                          type="date"
                          value={manualForm.purchaseDate}
                          onChange={(event) => setManualForm((prev) => ({ ...prev, purchaseDate: event.target.value }))}
                          InputLabelProps={{ shrink: true }}
                          sx={standardFieldSx}
                          fullWidth
                        />
                      </div>
                      <div className="col-12 md:col-6 lg:col-4">
                        <TextField
                          size="small"
                          label="Price"
                          type="number"
                          value={manualForm.price}
                          onChange={(event) => setManualForm((prev) => ({ ...prev, price: event.target.value }))}
                          sx={standardFieldSx}
                          fullWidth
                        />
                      </div>
                      <div className="col-12 md:col-6 lg:col-4">
                        <TextField
                          size="small"
                          label="Warranty"
                          value={manualForm.warranty}
                          onChange={(event) => setManualForm((prev) => ({ ...prev, warranty: event.target.value }))}
                          sx={standardFieldSx}
                          fullWidth
                        />
                      </div>
                    </div>
                    <div className="grid">
                      <div className="col-12 md:col-4 lg:col-3">
                        <Button variant="contained" sx={{ height: standardControlHeight, minWidth: 120 }} onClick={handleManualSave}>
                          Save
                        </Button>
                      </div>
                    </div>
                  </Stack>
                </Paper>
              ) : null}
            </>
          )}
        </Stack>
      </Box>

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

export default AddAsset;
