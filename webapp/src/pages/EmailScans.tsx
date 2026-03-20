import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import AssetPreviewModal from "../components/modules/AssetPreviewModal.tsx";
import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import {
  AssetLifecyclePayload,
  AssetSuggestion,
  EmailScan,
  createAsset,
  getAssetSuggestions,
  getEmailScans,
  parseSuggestionAttachment,
  rejectSuggestion,
} from "../services/gmail.ts";

const statusColorMap: Record<string, "default" | "success" | "error" | "warning" | "info"> = {
  processing: "warning",
  completed: "success",
  failed: "error",
  skipped_duplicate: "info",
};

const EmailScans = () => {
  const [scans, setScans] = useState<EmailScan[]>([]);
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AssetSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsingSuggestionId, setParsingSuggestionId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [parsingMessage, setParsingMessage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useAutoDismissMessage(message, setMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 5000 });

  const loadData = async () => {
    const [scanResponse, suggestionResponse] = await Promise.all([getEmailScans(), getAssetSuggestions()]);
    setScans(scanResponse);
    setSuggestions(suggestionResponse);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        await loadData();
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : "Failed to fetch email scans");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  const handlePrepareSave = async (suggestion: AssetSuggestion) => {
    try {
      setError("");
      setMessage("");
      setParsingMessage("");
      setParsingSuggestionId(suggestion.id);
      const parsed = await parseSuggestionAttachment(suggestion.id);

      const mergedSuggestion: AssetSuggestion = {
        ...suggestion,
        product_name: parsed.product_name ?? suggestion.product_name,
        brand: parsed.brand ?? suggestion.brand,
        vendor: parsed.vendor ?? suggestion.vendor,
        price: parsed.price ?? suggestion.price,
        purchase_date: parsed.purchase_date ?? suggestion.purchase_date,
      };

      setSelectedSuggestion(mergedSuggestion);
      if (parsed.status !== "parsed") {
        setParsingMessage(parsed.message || "Parsing failed. Please review and enter values manually.");
      }
    } catch (requestError: unknown) {
      setSelectedSuggestion(suggestion);
      setParsingMessage("Could not parse attachment. You can still enter values manually.");
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
    status?: string;
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
        status: payload.status,
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
        source: "email_sync",
        suggestion_id: selectedSuggestion.id,
      });
      const reminderCount = Number(createdAsset.auto_reminders_created || 0);
      if (reminderCount > 0) {
        setMessage(`Asset saved successfully with ${reminderCount} reminder${reminderCount === 1 ? "" : "s"}.`);
      } else {
        setMessage("Asset saved successfully.");
      }
      setSuggestions((prev) => prev.filter((item) => item.id !== selectedSuggestion.id));
      setSelectedSuggestion(null);
      setParsingMessage("");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save asset");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDiscard = async (suggestionId: string) => {
    try {
      setError("");
      await rejectSuggestion(suggestionId);
      setSuggestions((prev) => prev.filter((item) => item.id !== suggestionId));
      setMessage("Suggestion discarded.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to discard suggestion");
    }
  };

  return (
    <Box className="grid">
      <Box className="col-12">
        <Typography variant="h4" sx={{ mb: 2 }}>Email Scans</Typography>
      </Box>
      {loading ? (
        <Box className="col-12" sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}

      <Box className="col-12">
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}

        <div className="grid">
          {scans.map((scan) => (
            <div key={scan.id} className="col-12 md:col-6 lg:col-4">
              <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                <Stack spacing={0.75}>
                  <Typography variant="body2"><strong>Sender:</strong> {scan.sender || "-"}</Typography>
                  <Typography variant="body2"><strong>Subject:</strong> {scan.subject || "-"}</Typography>
                  <Typography variant="body2"><strong>Date:</strong> {scan.email_date ? new Date(scan.email_date).toLocaleDateString() : "-"}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2"><strong>Status:</strong></Typography>
                    <Chip label={scan.scan_status} color={statusColorMap[scan.scan_status] ?? "default"} size="small" />
                  </Stack>
                  <Typography variant="body2"><strong>Detected Items:</strong> {scan.detected_items_count}</Typography>
                  <Typography variant="body2"><strong>Message:</strong> {scan.error_message ? scan.error_message : "-"}</Typography>
                </Stack>
              </Paper>
            </div>
          ))}
        </div>
      </Paper>
      </Box>

      <Box className="col-12">
      <Paper sx={{ p: { xs: 2, md: 3 }, mt: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Asset Suggestions</Typography>

        <div className="grid">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="col-12 md:col-6 lg:col-4">
              <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                <Stack spacing={0.75}>
                  <Typography variant="body2"><strong>Sender:</strong> {suggestion.sender || "-"}</Typography>
                  <Typography variant="body2"><strong>Subject:</strong> {suggestion.subject || "-"}</Typography>
                  <Typography variant="body2"><strong>Date:</strong> {suggestion.email_date ? new Date(suggestion.email_date).toLocaleDateString() : "-"}</Typography>
                  <Typography variant="body2"><strong>Product:</strong> {suggestion.product_name || "-"}</Typography>
                  <Typography variant="body2"><strong>Vendor:</strong> {suggestion.vendor || "-"}</Typography>
                  <Typography variant="body2">
                    <strong>Price:</strong>
                    {" "}
                    {(suggestion.price != null && suggestion.price <= 100_000_000)
                      ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(suggestion.price)
                      : "-"}
                  </Typography>
                  <Typography variant="body2"><strong>Attachment:</strong> {suggestion.attachment_filename || "-"}</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={parsingSuggestionId === suggestion.id}
                      onClick={() => handlePrepareSave(suggestion)}
                    >
                      {parsingSuggestionId === suggestion.id ? "Parsing..." : "Save Asset"}
                    </Button>
                    <Button size="small" color="error" variant="text" onClick={() => handleDiscard(suggestion.id)}>
                      Discard
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </div>
          ))}
        </div>
      </Paper>
      </Box>

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

export default EmailScans;
