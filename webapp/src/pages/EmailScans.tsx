import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

import AssetPreviewModal from "../components/modules/AssetPreviewModal.tsx";
import {
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
      setMessage("Asset saved successfully.");
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
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Email Scans</Typography>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}

      <Paper sx={{ p: { xs: 2, md: 3 }, overflowX: "auto" }}>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Sender</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Scan Status</TableCell>
              <TableCell>Detected Items</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {scans.map((scan) => (
              <TableRow key={scan.id}>
                <TableCell>{scan.sender || "-"}</TableCell>
                <TableCell>{scan.subject || "-"}</TableCell>
                <TableCell>{scan.email_date ? new Date(scan.email_date).toLocaleDateString() : "-"}</TableCell>
                <TableCell>
                  <Chip
                    label={scan.scan_status}
                    color={statusColorMap[scan.scan_status] ?? "default"}
                    size="small"
                  />
                </TableCell>
                <TableCell>{scan.detected_items_count}</TableCell>
                <TableCell>{scan.error_message ? scan.error_message : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Paper sx={{ p: { xs: 2, md: 3 }, overflowX: "auto", mt: 2 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>Asset Suggestions</Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Sender</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Date</TableCell>
              <TableCell>Product</TableCell>
              <TableCell>Vendor</TableCell>
              <TableCell>Price</TableCell>
              <TableCell>Attachment</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {suggestions.map((suggestion) => (
              <TableRow key={suggestion.id}>
                <TableCell>{suggestion.sender || "-"}</TableCell>
                <TableCell>{suggestion.subject || "-"}</TableCell>
                <TableCell>{suggestion.email_date ? new Date(suggestion.email_date).toLocaleDateString() : "-"}</TableCell>
                <TableCell>{suggestion.product_name || "-"}</TableCell>
                <TableCell>{suggestion.vendor || "-"}</TableCell>
                <TableCell>{suggestion.price ?? "-"}</TableCell>
                <TableCell>{suggestion.attachment_filename || "-"}</TableCell>
                <TableCell>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

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
