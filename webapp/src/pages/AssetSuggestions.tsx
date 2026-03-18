import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";

import RefreshIcon from "@mui/icons-material/Refresh";
import AssetPreviewModal from "../components/modules/AssetPreviewModal.tsx";
import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import { AssetLifecyclePayload, AssetSuggestion, createAsset, getAssetSuggestions, parseSuggestionAttachment } from "../services/gmail.ts";

const AssetSuggestions = () => {
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [parsingSuggestionId, setParsingSuggestionId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [parsingMessage, setParsingMessage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useAutoDismissMessage(message, setMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 5000 });

  const loadSuggestions = useCallback(async () => {
    const response = await getAssetSuggestions();
    setSuggestions(response);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        await loadSuggestions();
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : "Failed to fetch asset suggestions");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [loadSuggestions]);

  // NOTE: No auto-polling. list_suggestions returns confirmed (already-saved) items too
  // (status != "rejected"), so a background refresh would restore saved items into
  // the list as "Already Added", which is confusing. Manual refresh is intentional
  // and safe because the user expects to see the current server state when they click it.

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadSuggestions();
    } catch {
      setError("Failed to refresh suggestions");
    } finally {
      setRefreshing(false);
    }
  };

  const handleConfirm = async (suggestion: AssetSuggestion, index: number) => {
    try {
      setSelectedSuggestionIndex(index);
      setParsingSuggestionId(suggestion.id);
      setParsingMessage("");
      const parsed = await parseSuggestionAttachment(suggestion.id);
      const parsedSuggestion: AssetSuggestion = {
        ...suggestion,
        product_name: parsed.product_name ?? suggestion.product_name,
        brand: parsed.brand ?? suggestion.brand,
        vendor: parsed.vendor ?? suggestion.vendor,
        price: parsed.price ?? suggestion.price,
        purchase_date: parsed.purchase_date ?? suggestion.purchase_date,
      };
      setSuggestions((prev) => prev.map((item, itemIndex) => (itemIndex === index ? parsedSuggestion : item)));
      setIsPreviewOpen(true);
      if (parsed.status !== "parsed") {
        setParsingMessage(parsed.message || "Could not parse attachment. Enter values manually.");
      }
    } catch (requestError: unknown) {
      setIsPreviewOpen(true);
      setParsingMessage("Could not parse attachment. Enter values manually.");
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
    const selectedSuggestion = suggestions[selectedSuggestionIndex];
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

      const reminderCount = Number(createdAsset.auto_reminders_created || 0);
      if (reminderCount > 0) {
        setMessage(`Asset saved successfully with ${reminderCount} reminder${reminderCount === 1 ? "" : "s"}.`);
      } else {
        setMessage("Asset saved successfully");
      }

      const currentIndex = suggestions.findIndex((item) => item.id === selectedSuggestion.id);
      const remainingSuggestions = suggestions.filter((item) => item.id !== selectedSuggestion.id);
      setSuggestions(remainingSuggestions);

      if (remainingSuggestions.length === 0) {
        setIsPreviewOpen(false);
        setSelectedSuggestionIndex(0);
      } else {
        const nextIndex = Math.min(Math.max(currentIndex, 0), remainingSuggestions.length - 1);
        setSelectedSuggestionIndex(nextIndex);
      }

      setParsingMessage("");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save asset");
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <Box className="grid">
      <Box className="col-12" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h4">Asset Suggestions</Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={refreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
          onClick={() => { void handleRefresh(); }}
          disabled={refreshing || loading}
        >
          Refresh
        </Button>
      </Box>
      {loading ? (
        <Box className="col-12" sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}
      <Box className="col-12">
      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          <div className="grid">
            {suggestions.map((suggestion, index) => (
              <div key={suggestion.id} className="col-12 md:col-6 lg:col-4">
                <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                  {(() => {
                    const statusLabel = suggestion.already_added ? "Already Added" : "New";
                    return (
                  <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                    <Typography variant="body2"><strong>Product Name:</strong></Typography>
                    <Typography variant="body2" title={suggestion.product_name} sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", mt: "-4px !important" }}>{suggestion.product_name}</Typography>
                    <Typography variant="body2"><strong>Vendor:</strong> {suggestion.vendor || "-"}</Typography>
                    <Typography variant="body2"><strong>Price:</strong> {suggestion.price ?? "-"}</Typography>
                    <Typography variant="body2"><strong>Purchase Date:</strong> {suggestion.purchase_date ? new Date(suggestion.purchase_date).toLocaleDateString() : "-"}</Typography>
                    <Typography variant="body2"><strong>Attachment:</strong> {suggestion.attachment_filename || "-"}</Typography>
                    <Typography variant="body2"><strong>Quantity:</strong> {suggestion.quantity}</Typography>
                    <Typography variant="body2"><strong>Source:</strong> {suggestion.source}</Typography>
                    <Typography variant="body2"><strong>Status:</strong> {statusLabel}</Typography>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => handleConfirm(suggestion, index)}
                      disabled={suggestion.already_added || parsingSuggestionId === suggestion.id}
                    >
                      {parsingSuggestionId === suggestion.id ? "Adding..." : "Add"}
                    </Button>
                  </Stack>
                    );
                  })()}
                </Paper>
              </div>
            ))}
          </div>
        </Stack>
      </Paper>
      </Box>

      <AssetPreviewModal
        open={isPreviewOpen}
        parsingMessage={parsingMessage}
        saveLoading={saveLoading}
        suggestions={suggestions}
        currentIndex={selectedSuggestionIndex}
        setCurrentIndex={setSelectedSuggestionIndex}
        onClose={() => {
          if (saveLoading) {
            return;
          }
          setIsPreviewOpen(false);
          setParsingMessage("");
        }}
        onSave={handleSaveAsset}
      />
    </Box>
  );
};

export default AssetSuggestions;
