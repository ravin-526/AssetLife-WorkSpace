import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from "@mui/material";
import { useEffect, useState } from "react";

import { AssetSuggestion, fetchSuggestionAttachmentBlob } from "../../services/gmail.ts";

type AssetPreviewModalProps = {
  open: boolean;
  suggestion: AssetSuggestion | null;
  parsingMessage?: string;
  saveLoading?: boolean;
  onClose: () => void;
  onSave: (payload: {
    product_name?: string;
    brand?: string;
    vendor?: string;
    price?: number;
    purchase_date?: string;
    warranty?: string;
    category?: string;
    location?: string;
  }) => Promise<void>;
};

const AssetPreviewModal = ({ open, suggestion, parsingMessage, saveLoading = false, onClose, onSave }: AssetPreviewModalProps) => {
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [form, setForm] = useState({
    product_name: "",
    brand: "",
    vendor: "",
    price: "",
    purchase_date: "",
    warranty: "",
    category: "",
    location: "",
  });

  useEffect(() => {
    setAttachmentError("");
    setForm({
      product_name: suggestion?.product_name ?? "",
      brand: suggestion?.brand ?? "",
      vendor: suggestion?.vendor ?? "",
      price: suggestion?.price !== undefined && suggestion?.price !== null ? String(suggestion.price) : "",
      purchase_date: suggestion?.purchase_date ? suggestion.purchase_date.slice(0, 10) : "",
      warranty: suggestion?.warranty ?? "",
      category: "",
      location: "",
    });
  }, [suggestion]);

  const handlePreviewAttachment = async () => {
    if (!suggestion?.id) {
      return;
    }

    try {
      setAttachmentError("");
      setAttachmentLoading(true);
      const blob = await fetchSuggestionAttachmentBlob(suggestion.id);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (requestError: unknown) {
      setAttachmentError(requestError instanceof Error ? requestError.message : "Failed to open attachment");
    } finally {
      setAttachmentLoading(false);
    }
  };

  const handleSave = async () => {
    await onSave({
      product_name: form.product_name || undefined,
      brand: form.brand || undefined,
      vendor: form.vendor || undefined,
      price: form.price ? Number(form.price) : undefined,
      purchase_date: form.purchase_date || undefined,
      warranty: form.warranty || undefined,
      category: form.category || undefined,
      location: form.location || undefined,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Asset Preview</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Stack spacing={2}>
            {suggestion?.attachment_filename ? (
              <Alert
                severity="info"
                action={
                  suggestion?.id ? (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        void handlePreviewAttachment();
                      }}
                      disabled={attachmentLoading}
                    >
                      {attachmentLoading ? "Opening..." : "Preview Attachment"}
                    </Button>
                  ) : undefined
                }
              >
                Attachment detected: {suggestion.attachment_filename}
              </Alert>
            ) : null}
            {attachmentError ? <Alert severity="error">{attachmentError}</Alert> : null}
            {parsingMessage ? <Alert severity="warning">{parsingMessage}</Alert> : null}
            <TextField
              label="Product Name"
              value={form.product_name}
              onChange={(event) => setForm((prev) => ({ ...prev, product_name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Brand"
              value={form.brand}
              onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Vendor"
              value={form.vendor}
              onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Price"
              type="number"
              value={form.price}
              onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Purchase Date"
              type="date"
              value={form.purchase_date}
              onChange={(event) => setForm((prev) => ({ ...prev, purchase_date: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Warranty"
              value={form.warranty}
              onChange={(event) => setForm((prev) => ({ ...prev, warranty: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Category"
              value={form.category}
              onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Location"
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
              fullWidth
            />
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saveLoading}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saveLoading}>
          {saveLoading ? "Saving..." : "Save Asset"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssetPreviewModal;
