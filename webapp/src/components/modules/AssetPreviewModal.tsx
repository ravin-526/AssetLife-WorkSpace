import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
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
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
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

  const standardControlHeight = 36;
  const standardFieldSx = {
    "& .MuiInputBase-root": {
      height: standardControlHeight,
    },
  };

  useEffect(() => {
    setAttachmentError("");
    if (!open) {
      return;
    }
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
  }, [open, suggestion]);

  useEffect(() => {
    let isMounted = true;

    const loadAttachmentPreview = async () => {
      if (!open || !suggestion?.id || !suggestion?.attachment_filename) {
        if (attachmentUrl) {
          URL.revokeObjectURL(attachmentUrl);
        }
        setAttachmentUrl(null);
        return;
      }

      try {
        setAttachmentLoading(true);
        setAttachmentError("");
        const blob = await fetchSuggestionAttachmentBlob(suggestion.id);
        if (!isMounted) {
          return;
        }

        if (attachmentUrl) {
          URL.revokeObjectURL(attachmentUrl);
        }

        const objectUrl = URL.createObjectURL(blob);
        setAttachmentUrl(objectUrl);
      } catch (requestError: unknown) {
        if (!isMounted) {
          return;
        }
        setAttachmentError(requestError instanceof Error ? requestError.message : "Failed to load attachment preview");
        setAttachmentUrl(null);
      } finally {
        if (isMounted) {
          setAttachmentLoading(false);
        }
      }
    };

    void loadAttachmentPreview();

    return () => {
      isMounted = false;
    };
  }, [open, suggestion]);

  useEffect(() => {
    return () => {
      if (attachmentUrl) {
        URL.revokeObjectURL(attachmentUrl);
      }
    };
  }, [attachmentUrl]);

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

  const previewSrc = attachmentUrl ? `${attachmentUrl}#zoom=80&navpanes=0&view=FitH` : "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{
        sx: {
          width: { xs: "100%", md: "80vw" },
          maxWidth: 1320,
        },
      }}
    >
      <DialogTitle>Asset Preview</DialogTitle>
      <DialogContent sx={{ overflow: "hidden" }}>
        <Box sx={{ mt: 1, minHeight: { xs: 420, md: 560 } }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(320px, 42%) minmax(0, 1fr)" },
              gap: 2,
              height: "100%",
              minHeight: 0,
            }}
          >
            <Paper variant="outlined" sx={{ minHeight: 0, overflowY: "auto", p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Asset Details Form</Typography>
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
                          {attachmentLoading ? "Opening..." : "Open in New Tab"}
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
                  size="small"
                  label="Product Name"
                  value={form.product_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, product_name: event.target.value }))}
                  sx={standardFieldSx}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Brand"
                  value={form.brand}
                  onChange={(event) => setForm((prev) => ({ ...prev, brand: event.target.value }))}
                  sx={standardFieldSx}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Vendor"
                  value={form.vendor}
                  onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))}
                  sx={standardFieldSx}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Price"
                  type="number"
                  value={form.price}
                  onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                  sx={standardFieldSx}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Purchase Date"
                  type="date"
                  value={form.purchase_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, purchase_date: event.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  sx={standardFieldSx}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Warranty"
                  value={form.warranty}
                  onChange={(event) => setForm((prev) => ({ ...prev, warranty: event.target.value }))}
                  sx={standardFieldSx}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Category"
                  value={form.category}
                  onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                  sx={standardFieldSx}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Location"
                  value={form.location}
                  onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                  sx={standardFieldSx}
                  fullWidth
                />
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ minHeight: 0, display: "flex", flexDirection: "column", p: 2 }}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>Invoice PDF Viewer</Typography>
              {attachmentLoading ? (
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">Loading invoice preview...</Typography>
                  </Stack>
                </Box>
              ) : attachmentUrl ? (
                <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1 }}>
                  <iframe
                    src={previewSrc}
                    title="Invoice PDF Preview"
                    width="100%"
                    height="100%"
                    style={{ border: "none" }}
                  />
                </Box>
              ) : (
                <Box
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    px: 2,
                  }}
                >
                  <Alert severity="info">No invoice available for this asset.</Alert>
                </Box>
              )}
            </Paper>
          </Box>
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
