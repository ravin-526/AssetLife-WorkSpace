import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import { useEffect, useMemo, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import {
  AssetCategoryOption,
  AssetLifecyclePayload,
  AssetSuggestion,
  UploadedAssetDocument,
  getAssetCategories,
  fetchSuggestionAttachmentBlob,
} from "../../services/gmail.ts";

type AssetPreviewModalProps = {
  open: boolean;
  suggestion: AssetSuggestion | null;
  parsingMessage?: string;
  saveLoading?: boolean;
  uploadedDocuments?: UploadedAssetDocument[];
  uploadedDocumentsLoading?: boolean;
  isDocumentActionLoading?: (key: string) => boolean;
  onViewUploadedDocument?: (document: UploadedAssetDocument) => void;
  onDeleteUploadedDocument?: (documentId: string) => void;
  onClose: () => void;
  onSave: (payload: {
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
  }) => Promise<void>;
};

const AssetPreviewModal = ({
  open,
  suggestion,
  parsingMessage,
  saveLoading = false,
  uploadedDocuments = [],
  uploadedDocumentsLoading = false,
  isDocumentActionLoading,
  onViewUploadedDocument,
  onDeleteUploadedDocument,
  onClose,
  onSave,
}: AssetPreviewModalProps) => {
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentMimeType, setAttachmentMimeType] = useState<string>("");
  const [locallyDeletedDocumentIds, setLocallyDeletedDocumentIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    product_name: "",
    brand: "",
    vendor: "",
    price: "",
    purchase_date: "",
    category: "",
    subcategory: "",
    serial_number: "",
    model_number: "",
    invoice_number: "",
    location: "",
    assigned_user: "",
    notes: "",
    description: "",
  });
  const [warrantyEnabled, setWarrantyEnabled] = useState(false);
  const [warrantyDetails, setWarrantyDetails] = useState({
    provider: "",
    type: "manufacturer",
    start_date: "",
    end_date: "",
    notes: "",
  });
  const [warrantyReminderPrefs, setWarrantyReminderPrefs] = useState({
    d30: true,
    d7: true,
    onExpiry: true,
  });

  const [insuranceEnabled, setInsuranceEnabled] = useState(false);
  const [insuranceDetails, setInsuranceDetails] = useState({
    provider: "",
    policy_number: "",
    start_date: "",
    expiry_date: "",
    premium_amount: "",
    coverage_notes: "",
  });
  const [insuranceReminderPrefs, setInsuranceReminderPrefs] = useState({
    d45: true,
    d15: true,
  });

  const [serviceEnabled, setServiceEnabled] = useState(false);
  const [serviceDetails, setServiceDetails] = useState({
    frequency: "monthly",
    custom_interval_days: "",
  });
  const [serviceReminderEnabled, setServiceReminderEnabled] = useState(true);

  const [supportingDocuments, setSupportingDocuments] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [basicDetailsError, setBasicDetailsError] = useState("");
  const [categories, setCategories] = useState<AssetCategoryOption[]>([]);

  const getRecordValue = (record: Record<string, unknown>, keys: string[]): string | undefined => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
      if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
      }
    }
    return undefined;
  };

  const getBooleanRecordValue = (record: Record<string, unknown>, keys: string[]): boolean | undefined => {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "1", "yes", "y", "on"].includes(normalized)) {
          return true;
        }
        if (["false", "0", "no", "n", "off"].includes(normalized)) {
          return false;
        }
      }
      if (typeof value === "number") {
        return value !== 0;
      }
    }
    return undefined;
  };

  const getObjectRecordValue = (record: Record<string, unknown>, keys: string[]): Record<string, unknown> | undefined => {
    for (const key of keys) {
      const value = record[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
    }
    return undefined;
  };

  const isImageFile = (nameOrMime?: string): boolean => {
    if (!nameOrMime) {
      return false;
    }
    const value = nameOrMime.toLowerCase();
    return value.startsWith("image/")
      || value.endsWith(".png")
      || value.endsWith(".jpg")
      || value.endsWith(".jpeg")
      || value.endsWith(".gif")
      || value.endsWith(".webp")
      || value.endsWith(".bmp")
      || value.endsWith(".svg");
  };

  const isPdfFile = (nameOrMime?: string): boolean => {
    if (!nameOrMime) {
      return false;
    }
    const value = nameOrMime.toLowerCase();
    return value === "application/pdf" || value.endsWith(".pdf");
  };

  const standardControlHeight = 36;
  const standardFieldSx = {
    "& .MuiInputBase-root": {
      height: standardControlHeight,
    },
  };

  useEffect(() => {
    setAttachmentError("");
    setBasicDetailsError("");
    setLocallyDeletedDocumentIds([]);
    if (!open) {
      return;
    }
    setForm({
      product_name: suggestion?.product_name ?? "",
      brand: suggestion?.brand ?? "",
      vendor: suggestion?.vendor ?? "",
      price: suggestion?.price !== undefined && suggestion?.price !== null ? String(suggestion.price) : "",
      purchase_date: suggestion?.purchase_date ? suggestion.purchase_date.slice(0, 10) : "",
      category: getRecordValue((suggestion as unknown as Record<string, unknown>) || {}, ["category", "asset_category"]) ?? "",
      subcategory: getRecordValue((suggestion as unknown as Record<string, unknown>) || {}, ["subcategory", "sub_category", "asset_subcategory"]) ?? "",
      serial_number: getRecordValue((suggestion as unknown as Record<string, unknown>) || {}, ["serial_number", "serialNo"]) ?? "",
      model_number: getRecordValue((suggestion as unknown as Record<string, unknown>) || {}, ["model_number", "modelNo"]) ?? "",
      invoice_number: getRecordValue((suggestion as unknown as Record<string, unknown>) || {}, ["invoice_number", "invoice_no"]) ?? "",
      location: getRecordValue((suggestion as unknown as Record<string, unknown>) || {}, ["location"]) ?? "",
      assigned_user: getRecordValue((suggestion as unknown as Record<string, unknown>) || {}, ["assigned_user", "assigned_to"]) ?? "",
      notes: getRecordValue((suggestion as unknown as Record<string, unknown>) || {}, ["notes"]) ?? "",
      description: getRecordValue((suggestion as unknown as Record<string, unknown>) || {}, ["description"]) ?? "",
    });

    const record = (suggestion as unknown as Record<string, unknown>) || {};
    const warranty = getObjectRecordValue(record, ["warranty_details", "warranty"]);
    const warrantyReminders = warranty ? getObjectRecordValue(warranty, ["reminders"]) : undefined;
    const warrantyEnabledFromSuggestion = warranty
      ? (getBooleanRecordValue(warranty, ["available"]) ?? false)
      : false;
    setWarrantyEnabled(warrantyEnabledFromSuggestion);
    setWarrantyDetails({
      provider: warranty ? (getRecordValue(warranty, ["provider"]) ?? "") : "",
      type: warranty ? (getRecordValue(warranty, ["type"]) ?? "manufacturer") : "manufacturer",
      start_date: warranty ? (getRecordValue(warranty, ["start_date"]) ?? "") : "",
      end_date: warranty ? (getRecordValue(warranty, ["end_date"]) ?? "") : "",
      notes: warranty ? (getRecordValue(warranty, ["notes"]) ?? "") : "",
    });
    setWarrantyReminderPrefs({
      d30: warrantyReminders ? (getBooleanRecordValue(warrantyReminders, ["thirty_days_before"]) ?? true) : true,
      d7: warrantyReminders ? (getBooleanRecordValue(warrantyReminders, ["seven_days_before"]) ?? true) : true,
      onExpiry: warrantyReminders ? (getBooleanRecordValue(warrantyReminders, ["on_expiry"]) ?? true) : true,
    });

    const insurance = getObjectRecordValue(record, ["insurance_details", "insurance"]);
    const insuranceReminders = insurance ? getObjectRecordValue(insurance, ["reminders"]) : undefined;
    const insuranceEnabledFromSuggestion = insurance
      ? (getBooleanRecordValue(insurance, ["available"]) ?? false)
      : false;
    setInsuranceEnabled(insuranceEnabledFromSuggestion);
    setInsuranceDetails({
      provider: insurance ? (getRecordValue(insurance, ["provider"]) ?? "") : "",
      policy_number: insurance ? (getRecordValue(insurance, ["policy_number"]) ?? "") : "",
      start_date: insurance ? (getRecordValue(insurance, ["start_date"]) ?? "") : "",
      expiry_date: insurance ? (getRecordValue(insurance, ["expiry_date"]) ?? "") : "",
      premium_amount: insurance ? (getRecordValue(insurance, ["premium_amount"]) ?? "") : "",
      coverage_notes: insurance ? (getRecordValue(insurance, ["coverage_notes", "notes"]) ?? "") : "",
    });
    setInsuranceReminderPrefs({
      d45: insuranceReminders ? (getBooleanRecordValue(insuranceReminders, ["forty_five_days_before"]) ?? true) : true,
      d15: insuranceReminders ? (getBooleanRecordValue(insuranceReminders, ["fifteen_days_before"]) ?? true) : true,
    });

    const service = getObjectRecordValue(record, ["service_details", "service"]);
    const serviceEnabledFromSuggestion = service
      ? (getBooleanRecordValue(service, ["required"]) ?? false)
      : false;
    setServiceEnabled(serviceEnabledFromSuggestion);
    setServiceDetails({
      frequency: service ? (getRecordValue(service, ["frequency"]) ?? "monthly") : "monthly",
      custom_interval_days: service ? (getRecordValue(service, ["custom_interval_days"]) ?? "") : "",
    });
    setServiceReminderEnabled(service ? (getBooleanRecordValue(service, ["reminder_enabled"]) ?? true) : true);
    setSupportingDocuments([]);
  }, [open, suggestion]);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      if (!open) {
        return;
      }

      try {
        const response = await getAssetCategories();
        if (active) {
          setCategories(response);
        }
      } catch {
        if (active) {
          setCategories([]);
        }
      }
    };

    void loadCategories();

    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    let isMounted = true;

    const loadAttachmentPreview = async () => {
      if (!open || !suggestion?.id || !suggestion?.attachment_filename) {
        if (attachmentUrl) {
          URL.revokeObjectURL(attachmentUrl);
        }
        setAttachmentUrl(null);
        setAttachmentMimeType("");
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
        setAttachmentMimeType(blob.type || suggestion.attachment_mime_type || "");
      } catch (requestError: unknown) {
        if (!isMounted) {
          return;
        }
        setAttachmentError(requestError instanceof Error ? requestError.message : "Failed to load attachment preview");
        setAttachmentUrl(null);
        setAttachmentMimeType("");
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

  const suggestionRecord = useMemo(() => {
    return suggestion ? (suggestion as unknown as Record<string, unknown>) : null;
  }, [suggestion]);

  const fallbackDocument = useMemo(() => {
    if (!suggestionRecord) {
      return null;
    }

    const url = getRecordValue(suggestionRecord, [
      "file_url",
      "invoice_url",
      "attachment_url",
      "invoice_attachment_url",
      "file",
      "invoice_file",
    ]);

    const fileName = getRecordValue(suggestionRecord, [
      "file_name",
      "filename",
      "attachment_filename",
      "invoice_filename",
    ]);

    const mimeType = getRecordValue(suggestionRecord, [
      "file_mime_type",
      "mime_type",
      "attachment_mime_type",
    ]);

    const documentId = getRecordValue(suggestionRecord, ["document_id", "file_id", "attachment_id"]);

    if (!url && !fileName) {
      return null;
    }

    return {
      documentId,
      displayName: fileName || "Uploaded file",
      url: url || "",
      mimeType: mimeType || "",
      isImage: isImageFile(mimeType) || isImageFile(fileName) || isImageFile(url),
    };
  }, [suggestionRecord]);

  const visibleUploadedDocuments = useMemo(() => {
    if (!uploadedDocuments.length) {
      return [];
    }

    const hidden = new Set(locallyDeletedDocumentIds);
    return uploadedDocuments.filter((document) => {
      if (hidden.has(document.document_id)) {
        return false;
      }
      const type = String(document.document_type || "").toLowerCase();
      return !type || type === "supporting";
    });
  }, [locallyDeletedDocumentIds, uploadedDocuments]);

  const previewFile = useMemo(() => {
    if (attachmentUrl) {
      return {
        name: suggestion?.attachment_filename || "Attachment",
        url: attachmentUrl,
        isImage: isImageFile(attachmentMimeType) || isImageFile(suggestion?.attachment_filename),
        isPdf: isPdfFile(attachmentMimeType) || isPdfFile(suggestion?.attachment_filename),
      };
    }

    if (fallbackDocument?.url) {
      return {
        name: fallbackDocument.displayName,
        url: fallbackDocument.url,
        isImage: fallbackDocument.isImage,
        isPdf: isPdfFile(fallbackDocument.mimeType) || isPdfFile(fallbackDocument.displayName) || isPdfFile(fallbackDocument.url),
      };
    }

    return null;
  }, [attachmentMimeType, attachmentUrl, fallbackDocument, suggestion?.attachment_filename]);

  const handlePreviewAttachment = () => {
    if (!previewFile?.url) {
      return;
    }
    window.open(previewFile.url, "_blank", "noopener,noreferrer");
  };

  const handleDeleteDocument = async (document: UploadedAssetDocument) => {
    if (!onDeleteUploadedDocument) {
      return;
    }

    const confirmed = window.confirm(`Delete \"${document.file_name}\"?`);
    if (!confirmed) {
      return;
    }

    setAttachmentError("");
    setLocallyDeletedDocumentIds((prev) => (prev.includes(document.document_id) ? prev : [...prev, document.document_id]));

    try {
      await onDeleteUploadedDocument(document.document_id);
    } catch (requestError: unknown) {
      setLocallyDeletedDocumentIds((prev) => prev.filter((id) => id !== document.document_id));
      setAttachmentError(requestError instanceof Error ? requestError.message : "Failed to delete uploaded document");
    }
  };

  const handleSave = async () => {
    if (!form.category.trim()) {
      setBasicDetailsError("Category is required");
      return;
    }
    if (!form.subcategory.trim()) {
      setBasicDetailsError("SubCategory is required");
      return;
    }

    setBasicDetailsError("");
    await onSave({
      product_name: form.product_name || undefined,
      brand: form.brand || undefined,
      vendor: form.vendor || undefined,
      price: form.price ? Number(form.price) : undefined,
      purchase_date: form.purchase_date || undefined,
      category: form.category || undefined,
      subcategory: form.subcategory || undefined,
      serial_number: form.serial_number || undefined,
      model_number: form.model_number || undefined,
      invoice_number: form.invoice_number || undefined,
      description: form.description || undefined,
      notes: form.notes || undefined,
      location: form.location || undefined,
      assigned_user: form.assigned_user || undefined,
      lifecycle_info: {
        warranty: warrantyEnabled
          ? {
              available: true,
              ...warrantyDetails,
              reminders: {
                thirty_days_before: warrantyReminderPrefs.d30,
                seven_days_before: warrantyReminderPrefs.d7,
                on_expiry: warrantyReminderPrefs.onExpiry,
              },
            }
          : null,
        insurance: insuranceEnabled
          ? {
              available: true,
              ...insuranceDetails,
              premium_amount: insuranceDetails.premium_amount ? Number(insuranceDetails.premium_amount) : undefined,
              reminders: {
                forty_five_days_before: insuranceReminderPrefs.d45,
                fifteen_days_before: insuranceReminderPrefs.d15,
              },
            }
          : null,
        service: serviceEnabled
          ? {
              required: true,
              ...serviceDetails,
              custom_interval_days: serviceDetails.custom_interval_days ? Number(serviceDetails.custom_interval_days) : undefined,
              reminder_enabled: serviceReminderEnabled,
            }
          : null,
      },
      supporting_documents: supportingDocuments,
    });
    setSupportingDocuments([]);
  };

  const addFiles = (files: File[]) => {
    if (!files.length) {
      return;
    }

    const supported = files.filter((file) => {
      const lower = file.name.toLowerCase();
      const mime = file.type.toLowerCase();
      return (
        mime === "application/pdf"
        || mime.startsWith("image/")
        || mime === "application/msword"
        || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        || mime === "text/plain"
        || lower.endsWith(".pdf")
        || lower.endsWith(".png")
        || lower.endsWith(".jpg")
        || lower.endsWith(".jpeg")
        || lower.endsWith(".webp")
        || lower.endsWith(".gif")
        || lower.endsWith(".doc")
        || lower.endsWith(".docx")
        || lower.endsWith(".txt")
      );
    });

    setSupportingDocuments((prev) => {
      const merged = [...prev];
      supported.forEach((file) => {
        const exists = merged.some(
          (item) => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified
        );
        if (!exists) {
          merged.push(file);
        }
      });
      return merged;
    });
  };

  const removeSupportingDocument = (fileToRemove: File) => {
    setSupportingDocuments((prev) =>
      prev.filter(
        (item) =>
          !(
            item.name === fileToRemove.name
            && item.size === fileToRemove.size
            && item.lastModified === fileToRemove.lastModified
          )
      )
    );
  };

  const serviceIntervalDays = useMemo(() => {
    switch (serviceDetails.frequency) {
      case "monthly":
        return 30;
      case "quarterly":
        return 90;
      case "half_yearly":
        return 180;
      case "yearly":
        return 365;
      case "custom": {
        const value = Number(serviceDetails.custom_interval_days);
        return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
      }
      default:
        return 0;
    }
  }, [serviceDetails.custom_interval_days, serviceDetails.frequency]);

  const nextServiceDateText = useMemo(() => {
    if (!serviceEnabled || serviceIntervalDays <= 0) {
      return "";
    }

    const baseDate = form.purchase_date ? new Date(`${form.purchase_date}T00:00:00`) : new Date();
    if (Number.isNaN(baseDate.getTime())) {
      return "";
    }

    const next = new Date(baseDate);
    next.setDate(next.getDate() + serviceIntervalDays);
    return next.toLocaleDateString();
  }, [form.purchase_date, serviceEnabled, serviceIntervalDays]);

  const subcategoryOptions = useMemo(() => {
    const selected = categories.find((item) => item.category === form.category);
    const options = selected?.subcategories ?? [];
    if (form.subcategory && !options.includes(form.subcategory)) {
      return [form.subcategory, ...options];
    }
    return options;
  }, [categories, form.category, form.subcategory]);

  const categoryOptions = useMemo(() => {
    const options = categories.map((item) => item.category);
    if (form.category && !options.includes(form.category)) {
      return [form.category, ...options];
    }
    return options;
  }, [categories, form.category]);

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
      <DialogContent sx={{ overflow: "hidden", height: { xs: "70vh", md: "72vh" } }}>
        <Box sx={{ mt: 1, minHeight: 0, height: "100%" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "minmax(320px, 42%) minmax(0, 1fr)" },
              gap: 2,
              height: "100%",
              minHeight: 0,
            }}
          >
            <Paper variant="outlined" sx={{ minHeight: 0, display: "flex", flexDirection: "column", p: 2 }}>
              <Typography variant="subtitle1">Asset Information</Typography>
              <Divider sx={{ mt: 1.25, mb: 1.5 }} />

              <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", pr: 0.5 }}>
                <Stack spacing={2}>
                  {suggestion?.attachment_filename ? (
                    <Alert severity="info">
                      Attachment detected: {suggestion.attachment_filename}
                    </Alert>
                  ) : null}
                  {attachmentError ? <Alert severity="error">{attachmentError}</Alert> : null}
                  {parsingMessage ? <Alert severity="warning">{parsingMessage}</Alert> : null}
                  {basicDetailsError ? <Alert severity="error">{basicDetailsError}</Alert> : null}

                  <Accordion disableGutters defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">Asset Basic Details</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <TextField
                            size="small"
                            label="Asset Name"
                            value={form.product_name}
                            onChange={(event) => setForm((prev) => ({ ...prev, product_name: event.target.value }))}
                            sx={standardFieldSx}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            size="small"
                            select
                            label="Category *"
                            value={form.category}
                            onChange={(event) => {
                              const selectedCategory = event.target.value;
                              setBasicDetailsError("");
                              setForm((prev) => ({ ...prev, category: selectedCategory, subcategory: "" }));
                            }}
                            sx={standardFieldSx}
                            fullWidth
                          >
                            {categoryOptions.map((item) => (
                              <MenuItem key={item} value={item}>{item}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            size="small"
                            select
                            label="SubCategory *"
                            value={form.subcategory}
                            onChange={(event) => {
                              setBasicDetailsError("");
                              setForm((prev) => ({ ...prev, subcategory: event.target.value }));
                            }}
                            sx={standardFieldSx}
                            fullWidth
                            disabled={!form.category}
                          >
                            {subcategoryOptions.map((item) => (
                              <MenuItem key={item} value={item}>{item}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            size="small"
                            label="Vendor"
                            value={form.vendor}
                            onChange={(event) => setForm((prev) => ({ ...prev, vendor: event.target.value }))}
                            sx={standardFieldSx}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
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
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            size="small"
                            label="Price"
                            type="number"
                            value={form.price}
                            onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                            sx={standardFieldSx}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            size="small"
                            label="Serial Number"
                            value={form.serial_number}
                            onChange={(event) => setForm((prev) => ({ ...prev, serial_number: event.target.value }))}
                            sx={standardFieldSx}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            size="small"
                            label="Model Number"
                            value={form.model_number}
                            onChange={(event) => setForm((prev) => ({ ...prev, model_number: event.target.value }))}
                            sx={standardFieldSx}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            size="small"
                            label="Invoice Number"
                            value={form.invoice_number}
                            onChange={(event) => setForm((prev) => ({ ...prev, invoice_number: event.target.value }))}
                            sx={standardFieldSx}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            size="small"
                            label="Location"
                            value={form.location}
                            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                            sx={standardFieldSx}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <TextField
                            size="small"
                            label="Assigned User"
                            value={form.assigned_user}
                            onChange={(event) => setForm((prev) => ({ ...prev, assigned_user: event.target.value }))}
                            sx={standardFieldSx}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            size="small"
                            label="Description"
                            value={form.description}
                            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                            multiline
                            minRows={2}
                            fullWidth
                          />
                        </Grid>
                        <Grid item xs={12}>
                          <TextField
                            size="small"
                            label="Notes"
                            value={form.notes}
                            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                            multiline
                            minRows={2}
                            fullWidth
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">Warranty Details</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={<Switch checked={warrantyEnabled} onChange={(e) => setWarrantyEnabled(e.target.checked)} />}
                            label="Warranty Available"
                          />
                        </Grid>
                        {warrantyEnabled ? (
                          <>
                            <Grid item xs={12} md={6}>
                              <TextField size="small" label="Warranty Provider" value={warrantyDetails.provider} onChange={(e) => setWarrantyDetails((prev) => ({ ...prev, provider: e.target.value }))} sx={standardFieldSx} fullWidth />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField
                                size="small"
                                select
                                label="Warranty Type"
                                value={warrantyDetails.type}
                                onChange={(e) => setWarrantyDetails((prev) => ({ ...prev, type: e.target.value }))}
                                sx={standardFieldSx}
                                fullWidth
                              >
                                <MenuItem value="manufacturer">Manufacturer</MenuItem>
                                <MenuItem value="extended">Extended</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField size="small" type="date" label="Warranty Start Date" InputLabelProps={{ shrink: true }} value={warrantyDetails.start_date} onChange={(e) => setWarrantyDetails((prev) => ({ ...prev, start_date: e.target.value }))} sx={standardFieldSx} fullWidth />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField size="small" type="date" label="Warranty End Date" InputLabelProps={{ shrink: true }} value={warrantyDetails.end_date} onChange={(e) => setWarrantyDetails((prev) => ({ ...prev, end_date: e.target.value }))} sx={standardFieldSx} fullWidth />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField size="small" label="Notes" multiline minRows={2} value={warrantyDetails.notes} onChange={(e) => setWarrantyDetails((prev) => ({ ...prev, notes: e.target.value }))} fullWidth />
                            </Grid>
                            {warrantyDetails.end_date ? (
                              <Grid item xs={12}>
                                <Paper variant="outlined" sx={{ p: 1.25 }}>
                                  <Stack spacing={0.5}>
                                    <Typography variant="caption" color="text.secondary">Suggested reminders</Typography>
                                    <FormControlLabel control={<Checkbox checked={warrantyReminderPrefs.d30} onChange={(e) => setWarrantyReminderPrefs((prev) => ({ ...prev, d30: e.target.checked }))} />} label="30 days before expiry" />
                                    <FormControlLabel control={<Checkbox checked={warrantyReminderPrefs.d7} onChange={(e) => setWarrantyReminderPrefs((prev) => ({ ...prev, d7: e.target.checked }))} />} label="7 days before expiry" />
                                    <FormControlLabel control={<Checkbox checked={warrantyReminderPrefs.onExpiry} onChange={(e) => setWarrantyReminderPrefs((prev) => ({ ...prev, onExpiry: e.target.checked }))} />} label="On expiry" />
                                  </Stack>
                                </Paper>
                              </Grid>
                            ) : null}
                          </>
                        ) : null}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">Insurance Details</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={<Switch checked={insuranceEnabled} onChange={(e) => setInsuranceEnabled(e.target.checked)} />}
                            label="Insurance Available"
                          />
                        </Grid>
                        {insuranceEnabled ? (
                          <>
                            <Grid item xs={12} md={6}>
                              <TextField size="small" label="Insurance Provider" value={insuranceDetails.provider} onChange={(e) => setInsuranceDetails((prev) => ({ ...prev, provider: e.target.value }))} sx={standardFieldSx} fullWidth />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField size="small" label="Policy Number" value={insuranceDetails.policy_number} onChange={(e) => setInsuranceDetails((prev) => ({ ...prev, policy_number: e.target.value }))} sx={standardFieldSx} fullWidth />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField size="small" type="date" label="Insurance Start Date" InputLabelProps={{ shrink: true }} value={insuranceDetails.start_date} onChange={(e) => setInsuranceDetails((prev) => ({ ...prev, start_date: e.target.value }))} sx={standardFieldSx} fullWidth />
                            </Grid>
                            <Grid item xs={12} md={6}>
                              <TextField size="small" type="date" label="Insurance Expiry Date" InputLabelProps={{ shrink: true }} value={insuranceDetails.expiry_date} onChange={(e) => setInsuranceDetails((prev) => ({ ...prev, expiry_date: e.target.value }))} sx={standardFieldSx} fullWidth />
                            </Grid>
                            <Grid item xs={12}>
                              <TextField size="small" label="Notes" multiline minRows={2} value={insuranceDetails.coverage_notes} onChange={(e) => setInsuranceDetails((prev) => ({ ...prev, coverage_notes: e.target.value }))} fullWidth />
                            </Grid>
                            {insuranceDetails.expiry_date ? (
                              <Grid item xs={12}>
                                <Paper variant="outlined" sx={{ p: 1.25 }}>
                                  <Stack spacing={0.5}>
                                    <Typography variant="caption" color="text.secondary">Suggested reminders</Typography>
                                    <FormControlLabel control={<Checkbox checked={insuranceReminderPrefs.d45} onChange={(e) => setInsuranceReminderPrefs((prev) => ({ ...prev, d45: e.target.checked }))} />} label="45 days before expiry" />
                                    <FormControlLabel control={<Checkbox checked={insuranceReminderPrefs.d15} onChange={(e) => setInsuranceReminderPrefs((prev) => ({ ...prev, d15: e.target.checked }))} />} label="15 days before expiry" />
                                  </Stack>
                                </Paper>
                              </Grid>
                            ) : null}
                          </>
                        ) : null}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">Service / Maintenance</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <FormControlLabel
                            control={<Switch checked={serviceEnabled} onChange={(e) => setServiceEnabled(e.target.checked)} />}
                            label="Service Required"
                          />
                        </Grid>
                        {serviceEnabled ? (
                          <>
                            <Grid item xs={12} md={6}>
                              <TextField
                                size="small"
                                select
                                label="Service Frequency"
                                value={serviceDetails.frequency}
                                onChange={(e) => setServiceDetails((prev) => ({ ...prev, frequency: e.target.value }))}
                                sx={standardFieldSx}
                                fullWidth
                              >
                                <MenuItem value="monthly">Monthly</MenuItem>
                                <MenuItem value="quarterly">Quarterly</MenuItem>
                                <MenuItem value="half_yearly">Half Yearly</MenuItem>
                                <MenuItem value="yearly">Yearly</MenuItem>
                                <MenuItem value="custom">Custom</MenuItem>
                              </TextField>
                            </Grid>
                            <Grid item xs={12} md={6}>
                              {serviceDetails.frequency === "custom" ? (
                                <TextField size="small" type="number" label="Service Interval (days)" value={serviceDetails.custom_interval_days} onChange={(e) => setServiceDetails((prev) => ({ ...prev, custom_interval_days: e.target.value }))} sx={standardFieldSx} fullWidth />
                              ) : <Box />}
                            </Grid>
                            {nextServiceDateText ? (
                              <Grid item xs={12}>
                                <Paper variant="outlined" sx={{ p: 1.25 }}>
                                  <Stack spacing={0.5}>
                                    <Typography variant="caption" color="text.secondary">Suggested reminder</Typography>
                                    <Typography variant="body2">Next service reminder on {nextServiceDateText}</Typography>
                                    <FormControlLabel
                                      control={<Checkbox checked={serviceReminderEnabled} onChange={(e) => setServiceReminderEnabled(e.target.checked)} />}
                                      label="Enable next service reminder"
                                    />
                                  </Stack>
                                </Paper>
                              </Grid>
                            ) : null}
                          </>
                        ) : null}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>

                  <Accordion disableGutters>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">Supporting Documents</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={12}>
                          <Box
                            onDragOver={(e) => {
                              e.preventDefault();
                              setIsDragOver(true);
                            }}
                            onDragLeave={(e) => {
                              e.preventDefault();
                              setIsDragOver(false);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setIsDragOver(false);
                              addFiles(Array.from(e.dataTransfer.files || []));
                            }}
                            sx={{
                              border: 1,
                              borderColor: isDragOver ? "primary.main" : "divider",
                              borderStyle: "dashed",
                              borderRadius: 1,
                              p: 2,
                              textAlign: "center",
                            }}
                          >
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              Drag and drop files here (PDF, images, docs)
                            </Typography>
                            <Button component="label" variant="outlined" size="small">
                              Select Files
                              <input
                                type="file"
                                hidden
                                multiple
                                accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.txt"
                                onChange={(e) => addFiles(Array.from(e.target.files || []))}
                              />
                            </Button>
                          </Box>
                        </Grid>

                        <Grid item xs={12}>
                          {uploadedDocumentsLoading ? (
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                              <CircularProgress size={16} />
                              <Typography variant="caption" color="text.secondary">Loading uploaded documents...</Typography>
                            </Stack>
                          ) : null}

                          {visibleUploadedDocuments.length > 0 ? (
                            <Stack spacing={0.75} sx={{ mb: 1.5 }}>
                              <Typography variant="caption" color="text.secondary">Uploaded Documents</Typography>
                              {visibleUploadedDocuments.map((document) => {
                                const viewKey = `view-${document.document_id}`;
                                const deleteKey = `delete-${document.document_id}`;
                                const viewLoading = isDocumentActionLoading?.(viewKey) ?? false;
                                const deleteLoading = isDocumentActionLoading?.(deleteKey) ?? false;
                                return (
                                  <Box
                                    key={document.document_id}
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 1,
                                    }}
                                  >
                                    <Typography
                                      variant="body2"
                                      sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}
                                    >
                                      {document.file_name}
                                    </Typography>
                                    <Stack direction="row" spacing={1}>
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<OpenInNewIcon fontSize="small" />}
                                        onClick={() => onViewUploadedDocument?.(document)}
                                        disabled={viewLoading || deleteLoading}
                                      >
                                        {viewLoading ? "Opening..." : "View"}
                                      </Button>
                                      <Button
                                        size="small"
                                        color="error"
                                        startIcon={<DeleteOutlineIcon fontSize="small" />}
                                        onClick={() => {
                                          void handleDeleteDocument(document);
                                        }}
                                        disabled={deleteLoading || viewLoading}
                                      >
                                        {deleteLoading ? "Deleting..." : "Delete"}
                                      </Button>
                                    </Stack>
                                  </Box>
                                );
                              })}
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">No uploaded documents yet.</Typography>
                          )}

                          {supportingDocuments.length > 0 ? (
                            <Stack spacing={0.75} sx={{ mb: 1.5 }}>
                              <Typography variant="caption" color="text.secondary">Selected Files</Typography>
                              {supportingDocuments.map((file) => {
                                const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
                                return (
                                  <Box
                                    key={fileKey}
                                    sx={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 1,
                                    }}
                                  >
                                    <Typography
                                      variant="body2"
                                      sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}
                                    >
                                      {file.name}
                                    </Typography>
                                    <Button
                                      size="small"
                                      color="error"
                                      startIcon={<DeleteOutlineIcon fontSize="small" />}
                                      onClick={() => {
                                        removeSupportingDocument(file);
                                      }}
                                    >
                                      Remove
                                    </Button>
                                  </Box>
                                );
                              })}
                            </Stack>
                          ) : null}
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Stack>
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ minHeight: 0, display: "flex", flexDirection: "column", p: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="subtitle1">Invoice Preview</Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    handlePreviewAttachment();
                  }}
                  disabled={!previewFile?.url || attachmentLoading}
                >
                  {attachmentLoading ? "Opening..." : "Open in New Tab"}
                </Button>
              </Box>
              {attachmentLoading ? (
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={20} />
                    <Typography variant="body2" color="text.secondary">Loading invoice preview...</Typography>
                  </Stack>
                </Box>
              ) : previewFile?.isImage && previewFile.url ? (
                <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1 }}>
                  <Box
                    component="img"
                    src={previewFile.url}
                    alt={previewFile.name}
                    sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block", bgcolor: "background.default" }}
                  />
                </Box>
              ) : previewFile?.isPdf && previewFile.url ? (
                <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1 }}>
                  <iframe
                    src={`${previewFile.url}#zoom=80&navpanes=0&view=FitH`}
                    title="Invoice PDF Preview"
                    width="100%"
                    height="100%"
                    style={{ border: "none" }}
                  />
                </Box>
              ) : previewFile?.url ? (
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
                  <Stack spacing={1.25} alignItems="center">
                    <Alert severity="info">Preview not available for this file type.</Alert>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<OpenInNewIcon fontSize="small" />}
                      onClick={() => {
                        handlePreviewAttachment();
                      }}
                    >
                      View File
                    </Button>
                  </Stack>
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
                  <Alert severity="info">No file uploaded.</Alert>
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
