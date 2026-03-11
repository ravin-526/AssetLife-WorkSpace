import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
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
import { AssetSuggestion, createAsset, getAssetSuggestions, parseSuggestionAttachment, rejectSuggestion } from "../services/gmail.ts";

const AssetSuggestions = () => {
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AssetSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsingSuggestionId, setParsingSuggestionId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [parsingMessage, setParsingMessage] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadSuggestions = async () => {
    const response = await getAssetSuggestions();
    setSuggestions(response);
  };

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
  }, []);

  const handleConfirm = async (suggestion: AssetSuggestion) => {
    try {
      setParsingSuggestionId(suggestion.id);
      setParsingMessage("");
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
        setParsingMessage(parsed.message || "Could not parse attachment. Enter values manually.");
      }
    } catch (requestError: unknown) {
      setSelectedSuggestion(suggestion);
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

      setMessage("Asset saved successfully");
      setSuggestions((prev) => prev.filter((item) => item.id !== selectedSuggestion.id));
      setSelectedSuggestion(null);
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
      setMessage("Suggestion discarded.");
      await loadSuggestions();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to discard suggestion");
    }
  };

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>Asset Suggestions</Typography>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}
      <Paper sx={{ p: { xs: 2, md: 3 }, overflowX: "auto" }}>
        <Stack spacing={2}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Product Name</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Purchase Date</TableCell>
                <TableCell>Attachment</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {suggestions.map((suggestion) => (
                <TableRow key={suggestion.id}>
                  <TableCell>{suggestion.product_name}</TableCell>
                  <TableCell>{suggestion.vendor || "-"}</TableCell>
                  <TableCell>{suggestion.price ?? "-"}</TableCell>
                  <TableCell>{suggestion.purchase_date ? new Date(suggestion.purchase_date).toLocaleDateString() : "-"}</TableCell>
                  <TableCell>{suggestion.attachment_filename || "-"}</TableCell>
                  <TableCell>{suggestion.quantity}</TableCell>
                  <TableCell>{suggestion.source}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" onClick={() => handleConfirm(suggestion)}>Confirm</Button>
                      <Button size="small" variant="outlined" onClick={() => handleConfirm(suggestion)}>
                        {parsingSuggestionId === suggestion.id ? "Parsing..." : "Save Asset"}
                      </Button>
                      <Button size="small" color="error" variant="text" onClick={() => handleDiscard(suggestion.id)}>Discard</Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
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

export default AssetSuggestions;
