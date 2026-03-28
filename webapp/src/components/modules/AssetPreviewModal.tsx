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
  Tab,
  Tabs,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import useAutoDismissMessage from "../../hooks/useAutoDismissMessage.ts";
import {
  AssetCategoryOption,
  AssetLifecyclePayload,
  SuggestionEmailDetails,
  AssetSuggestion,
  UploadedAssetDocument,
  fetchAssetDocumentBlob,
  fetchAssetInvoiceBlob,
  getSuggestionEmailDetails,
  getAssetCategories,
  fetchSuggestionAttachmentBlob,
} from "../../services/gmail.ts";

type UnifiedAttachment = {
  id: string;
  file_url: string;
  file_name: string;
  mime_type: string;
  kind: "invoice" | "document";
  document_id?: string;
  asset_id?: string;
};

type AssetPreviewModalProps = {
  open: boolean;
  suggestion?: AssetSuggestion | null;
  isSuggestionMode?: boolean;
  inlineMode?: boolean;
  showTitle?: boolean;
  collapseDocumentViewer?: boolean;
  disableAttachmentAndEmailPreview?: boolean;
  parsingMessage?: string;
  saveLoading?: boolean;
  uploadedDocuments?: UploadedAssetDocument[];
  uploadedDocumentsLoading?: boolean;
  isDocumentActionLoading?: (key: string) => boolean;
  onViewUploadedDocument?: (document: UploadedAssetDocument) => void;
  onDeleteUploadedDocument?: (documentId: string) => void;
  suggestions?: AssetSuggestion[];
  currentIndex?: number;
  setCurrentIndex?: Dispatch<SetStateAction<number>>;
  navigation?: {
    currentIndex: number;
    total: number;
    onPrevious: () => void;
    onNext: () => void;
  };
  onClose: () => void;
  onSave: (payload: {
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
  }) => Promise<void>;
};

const EMPTY_UPLOADED_DOCUMENTS: UploadedAssetDocument[] = [];

const AssetPreviewModal = ({
  open,
  suggestion: suggestionProp = null,
  isSuggestionMode = false,
  inlineMode = false,
  showTitle = true,
  collapseDocumentViewer = false,
  disableAttachmentAndEmailPreview = false,
  parsingMessage,
  saveLoading = false,
  uploadedDocuments = EMPTY_UPLOADED_DOCUMENTS,
  uploadedDocumentsLoading = false,
  isDocumentActionLoading,
  onViewUploadedDocument,
  onDeleteUploadedDocument,
  suggestions = [],
  currentIndex = 0,
  onClose,
  onSave,
}: AssetPreviewModalProps) => {
  const [attachments, setAttachments] = useState<UnifiedAttachment[]>([]);
  const [selectedAttachment, setSelectedAttachment] = useState<UnifiedAttachment | null>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentDownloadLoading, setAttachmentDownloadLoading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentMimeType, setAttachmentMimeType] = useState<string>("");
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string>("");
  const [attachmentRenderError, setAttachmentRenderError] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<"attachment" | "email">("attachment");
  const [emailDetails, setEmailDetails] = useState<SuggestionEmailDetails | null>(null);
  const [emailDetailsLoading, setEmailDetailsLoading] = useState(false);
  const [emailDetailsError, setEmailDetailsError] = useState("");
  const [displayedParsingMessage, setDisplayedParsingMessage] = useState("");
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
    custom_category: "",
    custom_subcategory: "",
    status: "Active",
  });

  // Defensive: ensure subcategory is always a string
  type FormType = typeof form;
  const setFormSafe = (updater: ((prev: FormType) => FormType) | FormType) => {
    setForm((prev) => {
      const next = typeof updater === "function" ? (updater as (prev: FormType) => FormType)(prev) : updater;
      let subcategory = next.subcategory;
      if (subcategory && typeof subcategory === "object") {
        // Try to extract _id or name, else fallback to empty string
        const subcatObj = subcategory as { _id?: string; name?: string };
        subcategory = subcatObj._id || subcatObj.name || "";
      }
      return { ...next, subcategory };
    });
  };
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

  // Normalized category/subcategory options for dropdowns

  // Use category string as _id and name for dropdown
  const normalizedCategoryOptions = useMemo(() => {
    return categories.map((item) => ({
      _id: item.category,
      name: item.category,
    }));
  }, [categories]);

  // Subcategories are always string[]
  const normalizedSubcategoryOptions = useMemo(() => {
    const selected = categories.find((item) => item.category === form.category);
    const options = (selected?.subcategories || []).map((sub) => ({ _id: sub, name: sub }));
    // If current value is not in options, add it for edit mode
    if (
      form.subcategory &&
      !options.some((opt) => opt._id === form.subcategory)
    ) {
      options.unshift({ _id: form.subcategory, name: form.subcategory });
    }
    return options;
  }, [categories, form.category, form.subcategory]);
  const [initialSnapshot, setInitialSnapshot] = useState("");

  useAutoDismissMessage(attachmentError, setAttachmentError, { delay: 5000 });
  useAutoDismissMessage(basicDetailsError, setBasicDetailsError, { delay: 5000 });
  useAutoDismissMessage(emailDetailsError, setEmailDetailsError, { delay: 5000 });
  useAutoDismissMessage(displayedParsingMessage, setDisplayedParsingMessage, { delay: 3000 });

  const suggestion = useMemo(() => {
    return suggestions?.[currentIndex] ?? suggestionProp ?? null;
  }, [currentIndex, suggestionProp, suggestions]);

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

  const isPreviewableAttachment = (fileName?: string, mimeType?: string): boolean => {
    const extension = (fileName || "").split(".").pop()?.toLowerCase();
    if (extension && ["pdf", "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(extension)) {
      return true;
    }
    return isPdfFile(mimeType) || isImageFile(mimeType);
  };

  const isValidPreviewBlob = (blob: Blob, resolvedMimeType?: string): boolean => {
    if (blob.size === 0) {
      return false;
    }
    const effectiveType = blob.type || resolvedMimeType || "";
    return effectiveType === "application/pdf" || effectiveType.startsWith("image/");
  };

  const standardControlHeight = 36;
  const standardFieldSx = {
    "& .MuiInputBase-root": {
      height: standardControlHeight,
    },
  };

  const sanitizeEmailHtml = (rawHtml: string): string => {
    if (typeof window === "undefined") {
      return rawHtml;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");
    doc.querySelectorAll("script, style, iframe, object, embed, form, link, meta").forEach((node) => node.remove());

    doc.querySelectorAll("*").forEach((element) => {
      for (const attribute of Array.from(element.attributes)) {
        const attrName = attribute.name.toLowerCase();
        const attrValue = attribute.value;
        if (attrName.startsWith("on")) {
          element.removeAttribute(attribute.name);
          continue;
        }
        if ((attrName === "href" || attrName === "src") && /^javascript:/i.test(attrValue.trim())) {
          element.removeAttribute(attribute.name);
        }
      }
    });

    return doc.body.innerHTML;
  };

  const formatAttachmentSize = (size?: number) => {
    if (!size || size <= 0) {
      return "";
    }
    if (size >= 1024 * 1024) {
      return `${(size / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (size >= 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${size} B`;
  };

  const deriveMimeTypeFromName = (fileName: string) => {
    const lower = fileName.toLowerCase();
    if (lower.endsWith(".pdf")) return "application/pdf";
    if (lower.endsWith(".png")) return "image/png";
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
    if (lower.endsWith(".gif")) return "image/gif";
    if (lower.endsWith(".webp")) return "image/webp";
    if (lower.endsWith(".bmp")) return "image/bmp";
    if (lower.endsWith(".svg")) return "image/svg+xml";
    return "application/octet-stream";
  };

  const getNoAttachmentMessage = () => {
    const source = String((suggestion as unknown as Record<string, unknown>)?.source || "").trim().toLowerCase();
    if (source === "excel_upload") return "No preview available for Excel upload";
    if (source === "manual") return "No documents available";
    if (source === "email_sync") return "Attachment not available";
    if (source === "invoice_upload") return "Invoice not available";
    return "No documents available";
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    setRightPanelTab("attachment");
    setEmailDetails(null);
    setEmailDetailsError("");
    setEmailDetailsLoading(false);
  }, [open, suggestion?.id]);

  useEffect(() => {
    if (disableAttachmentAndEmailPreview && rightPanelTab === "email") {
      setRightPanelTab("attachment");
    }
  }, [disableAttachmentAndEmailPreview, rightPanelTab]);

  useEffect(() => {
    setDisplayedParsingMessage(parsingMessage ?? "");
  }, [open, parsingMessage, suggestion?.id]);

  useEffect(() => {
    let active = true;

    const loadEmailDetails = async () => {
      if (disableAttachmentAndEmailPreview || !open || rightPanelTab !== "email" || !suggestion?.id) {
        return;
      }

      if (isSuggestionMode) {
        try {
          setEmailDetailsLoading(true);
          setEmailDetailsError("");

          const response = await getSuggestionEmailDetails(suggestion.id);
          if (!active) {
            return;
          }

          setEmailDetails({
            subject: response?.subject || suggestion.subject,
            sender: response?.sender || suggestion.sender,
            received_date: response?.received_date || suggestion.received_date || suggestion.email_date,
            email_body: response?.email_body || suggestion.email_body,
            email_body_html: response?.email_body_html || suggestion.email_body_html,
            attachments: Array.isArray(response?.attachments) ? response.attachments : [],
          });
        } catch (requestError: unknown) {
          if (!active) {
            return;
          }
          setEmailDetails({
            subject: suggestion.subject,
            sender: suggestion.sender,
            received_date: suggestion.received_date || suggestion.email_date,
            email_body: suggestion.email_body,
            email_body_html: suggestion.email_body_html,
            attachments: [],
          });
          setEmailDetailsError(requestError instanceof Error ? requestError.message : "Failed to load email details");
        } finally {
          if (active) {
            setEmailDetailsLoading(false);
          }
        }
        return;
      }

      const localDetails: SuggestionEmailDetails = {
        subject: suggestion.subject,
        sender: suggestion.sender,
        received_date: suggestion.received_date || suggestion.email_date,
        email_body: suggestion.email_body,
        email_body_html: suggestion.email_body_html,
        attachments: [],
      };

      if (localDetails.email_body || localDetails.email_body_html) {
        setEmailDetails(localDetails);
        setEmailDetailsError("");
        setEmailDetailsLoading(false);
        return;
      }

      try {
        setEmailDetailsLoading(true);
        setEmailDetailsError("");
        const response = await getSuggestionEmailDetails(suggestion.id);
        if (!active) {
          return;
        }
        setEmailDetails(response);
      } catch (requestError: unknown) {
        if (!active) {
          return;
        }
        setEmailDetails(localDetails);
        setEmailDetailsError(requestError instanceof Error ? requestError.message : "Failed to load email details");
      } finally {
        if (active) {
          setEmailDetailsLoading(false);
        }
      }
    };

    void loadEmailDetails();

    return () => {
      active = false;
    };
  }, [disableAttachmentAndEmailPreview, isSuggestionMode, open, rightPanelTab, suggestion]);

  useEffect(() => {
    setAttachmentError("");
    setBasicDetailsError("");
    setLocallyDeletedDocumentIds([]);
    if (!open) {
      return;
    }
    const record = (suggestion as unknown as Record<string, unknown>) || {};

    const initialForm = {
      product_name: suggestion?.product_name ?? "",
      brand: suggestion?.brand ?? "",
      vendor: suggestion?.vendor ?? "",
      price: suggestion?.price !== undefined && suggestion?.price !== null ? String(suggestion.price) : "",
      purchase_date: suggestion?.purchase_date ? suggestion.purchase_date.slice(0, 10) : "",
      category: getRecordValue(record, ["category", "asset_category"]) ?? "",
      subcategory: getRecordValue(record, ["subcategory", "sub_category", "asset_subcategory"]) ?? "",
      serial_number: getRecordValue(record, ["serial_number", "serialNo"]) ?? "",
      model_number: getRecordValue(record, ["model_number", "modelNo"]) ?? "",
      invoice_number: getRecordValue(record, ["invoice_number", "invoice_no"]) ?? "",
      location: getRecordValue(record, ["location"]) ?? "",
      assigned_user: getRecordValue(record, ["assigned_user", "assigned_to"]) ?? "",
      notes: getRecordValue(record, ["notes"]) ?? "",
      description: getRecordValue(record, ["description"]) ?? "",
      custom_category: "",
      custom_subcategory: "",
      status: (() => {
        const rawStatus = getRecordValue(record, ["status"]);
        if (rawStatus) return rawStatus;
        const isInactive = getBooleanRecordValue(record, ["is_inactive"]);
        return isInactive ? "Inactive" : "Active";
      })(),
    };
    setForm(initialForm);

    const warranty = getObjectRecordValue(record, ["warranty_details", "warranty"]);
    const warrantyReminders = warranty ? getObjectRecordValue(warranty, ["reminders"]) : undefined;
    const warrantyEnabledFromSuggestion = warranty
      ? (getBooleanRecordValue(warranty, ["available"]) ?? false)
      : false;
    const initialWarrantyDetails = {
      provider: warranty ? (getRecordValue(warranty, ["provider"]) ?? "") : "",
      type: warranty ? (getRecordValue(warranty, ["type"]) ?? "manufacturer") : "manufacturer",
      start_date: warranty ? (getRecordValue(warranty, ["start_date"]) ?? "") : "",
      end_date: warranty ? (getRecordValue(warranty, ["end_date"]) ?? "") : "",
      notes: warranty ? (getRecordValue(warranty, ["notes"]) ?? "") : "",
    };
    setWarrantyEnabled(warrantyEnabledFromSuggestion);
    setWarrantyDetails(initialWarrantyDetails);
    const initialWarrantyReminderPrefs = {
      d30: warrantyReminders ? (getBooleanRecordValue(warrantyReminders, ["thirty_days_before"]) ?? true) : true,
      d7: warrantyReminders ? (getBooleanRecordValue(warrantyReminders, ["seven_days_before"]) ?? true) : true,
      onExpiry: warrantyReminders ? (getBooleanRecordValue(warrantyReminders, ["on_expiry"]) ?? true) : true,
    };
    setWarrantyReminderPrefs(initialWarrantyReminderPrefs);

    const insurance = getObjectRecordValue(record, ["insurance_details", "insurance"]);
    const insuranceReminders = insurance ? getObjectRecordValue(insurance, ["reminders"]) : undefined;
    const insuranceEnabledFromSuggestion = insurance
      ? (getBooleanRecordValue(insurance, ["available"]) ?? false)
      : false;
    const initialInsuranceDetails = {
      provider: insurance ? (getRecordValue(insurance, ["provider"]) ?? "") : "",
      policy_number: insurance ? (getRecordValue(insurance, ["policy_number"]) ?? "") : "",
      start_date: insurance ? (getRecordValue(insurance, ["start_date"]) ?? "") : "",
      expiry_date: insurance ? (getRecordValue(insurance, ["expiry_date"]) ?? "") : "",
      premium_amount: insurance ? (getRecordValue(insurance, ["premium_amount"]) ?? "") : "",
      coverage_notes: insurance ? (getRecordValue(insurance, ["coverage_notes", "notes"]) ?? "") : "",
    };
    setInsuranceEnabled(insuranceEnabledFromSuggestion);
    setInsuranceDetails(initialInsuranceDetails);
    const initialInsuranceReminderPrefs = {
      d45: insuranceReminders ? (getBooleanRecordValue(insuranceReminders, ["forty_five_days_before"]) ?? true) : true,
      d15: insuranceReminders ? (getBooleanRecordValue(insuranceReminders, ["fifteen_days_before"]) ?? true) : true,
    };
    setInsuranceReminderPrefs(initialInsuranceReminderPrefs);

    const service = getObjectRecordValue(record, ["service_details", "service"]);
    const serviceEnabledFromSuggestion = service
      ? (getBooleanRecordValue(service, ["required"]) ?? false)
      : false;
    const initialServiceDetails = {
      frequency: service ? (getRecordValue(service, ["frequency"]) ?? "monthly") : "monthly",
      custom_interval_days: service ? (getRecordValue(service, ["custom_interval_days"]) ?? "") : "",
    };
    const initialServiceReminderEnabled = service ? (getBooleanRecordValue(service, ["reminder_enabled"]) ?? true) : true;
    setServiceEnabled(serviceEnabledFromSuggestion);
    setServiceDetails(initialServiceDetails);
    setServiceReminderEnabled(initialServiceReminderEnabled);
    setSupportingDocuments([]);

    setInitialSnapshot(
      JSON.stringify({
        form: initialForm,
        warrantyEnabled: warrantyEnabledFromSuggestion,
        warrantyDetails: initialWarrantyDetails,
        warrantyReminderPrefs: initialWarrantyReminderPrefs,
        insuranceEnabled: insuranceEnabledFromSuggestion,
        insuranceDetails: initialInsuranceDetails,
        insuranceReminderPrefs: initialInsuranceReminderPrefs,
        serviceEnabled: serviceEnabledFromSuggestion,
        serviceDetails: initialServiceDetails,
        serviceReminderEnabled: initialServiceReminderEnabled,
        selectedSupportingDocuments: [],
        locallyDeletedDocumentIds: [],
      })
    );
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
      if (!open || rightPanelTab !== "attachment") {
        setAttachmentLoading(false);
        setAttachmentUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev);
          }
          return null;
        });
        setAttachmentMimeType("");
        setAttachmentRenderError(false);
        return;
      }

      if (!selectedAttachment) {
        setAttachmentLoading(false);
        setAttachmentUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev);
          }
          return null;
        });
        setAttachmentMimeType("");
        setAttachmentRenderError(false);
        return;
      }

      try {
        setAttachmentLoading(true);
        setAttachmentError("");
        setAttachmentRenderError(false);

        let blob: Blob;
        if (selectedAttachment?.kind === "document" && selectedAttachment?.document_id && !isSuggestionMode) {
          const assetIdFromUrl = (selectedAttachment?.file_url || "").match(/\/api\/assets\/([^/]+)\/documents\//)?.[1] || selectedAttachment?.asset_id || suggestion?.id;
          if (!assetIdFromUrl) {
            throw new Error("Asset id is missing for document preview");
          }
          blob = await fetchAssetDocumentBlob(assetIdFromUrl, selectedAttachment.document_id);
        } else {
          if (isSuggestionMode && suggestion?.id) {
            blob = await fetchSuggestionAttachmentBlob(suggestion.id);
          } else {
            const assetId = selectedAttachment?.asset_id || suggestion?.id;
            if (!assetId) {
              throw new Error("Asset id is missing for invoice preview");
            }
            blob = await fetchAssetInvoiceBlob(assetId);
          }
        }

        if (!isMounted) {
          return;
        }

        const resolvedMimeType = blob.type || selectedAttachment?.mime_type || "";
        const canPreview = isPreviewableAttachment(selectedAttachment?.file_name || "Attachment", resolvedMimeType);
        const hasValidBlob = isValidPreviewBlob(blob, resolvedMimeType);
        if (!hasValidBlob || !canPreview) {
          setAttachmentUrl((prev) => {
            if (prev) {
              URL.revokeObjectURL(prev);
            }
            return null;
          });
          setAttachmentMimeType(resolvedMimeType);
          setAttachmentError(hasValidBlob ? "" : "Invalid or unsupported file.");
          setAttachmentRenderError(false);
          return;
        }

        const objectUrl = URL.createObjectURL(blob);
        setAttachmentUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev);
          }
          return objectUrl;
        });
        setAttachmentMimeType(resolvedMimeType);
      } catch (requestError: unknown) {
        if (!isMounted) {
          return;
        }
        setAttachmentError(requestError instanceof Error ? requestError.message : "Failed to load attachment preview");
        setAttachmentUrl((prev) => {
          if (prev) {
            URL.revokeObjectURL(prev);
          }
          return null;
        });
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
  }, [
    open,
    rightPanelTab,
    selectedAttachment,
    suggestion,
    isSuggestionMode,
  ]);

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
      return !type || type === "supporting" || type === "invoice";
    });
  }, [locallyDeletedDocumentIds, uploadedDocuments]);

  const computedAttachments = useMemo<UnifiedAttachment[]>(() => {
    const result: UnifiedAttachment[] = [];
    const sourceRecord = suggestionRecord || {};
    const invoicePath = getRecordValue(sourceRecord, ["invoice_path", "invoice_attachment_path"]);
    const invoiceFileName = getRecordValue(sourceRecord, ["attachment_filename", "invoice_filename"])
      || (invoicePath ? invoicePath.split("/").pop() : undefined)
      || (isSuggestionMode ? "Suggestion Attachment" : "Invoice");
    const invoiceMimeType = getRecordValue(sourceRecord, ["attachment_mime_type", "mime_type"])
      || deriveMimeTypeFromName(invoiceFileName);

    const hasInvoiceMeta = Boolean(invoicePath || suggestion?.attachment_filename || suggestion?.attachment_mime_type);
    const shouldIncludeInvoice = isSuggestionMode ? Boolean(suggestion?.id) : hasInvoiceMeta;

    if (shouldIncludeInvoice) {
      result.push({
        id: `invoice-${suggestion?.id || "unknown"}`,
        file_url: "",
        file_name: invoiceFileName,
        mime_type: invoiceMimeType,
        kind: "invoice",
        asset_id: suggestion?.id,
      });
    }

    if (!isSuggestionMode) {
      visibleUploadedDocuments.forEach((document) => {
        const type = String(document.document_type || "").toLowerCase();
        if (type === "invoice") {
          return;
        }
        result.push({
          id: `document-${document.document_id}`,
          file_url: document.file_url,
          file_name: document.file_name,
          mime_type: deriveMimeTypeFromName(document.file_name || ""),
          kind: "document",
          document_id: document.document_id,
          asset_id: suggestion?.id,
        });
      });
    }

    return result;
  }, [isSuggestionMode, suggestion?.attachment_filename, suggestion?.attachment_mime_type, suggestion?.id, suggestionRecord, visibleUploadedDocuments]);

  useEffect(() => {
    setAttachments(computedAttachments);
  }, [computedAttachments]);

  useEffect(() => {
    if (!attachments.length) {
      setSelectedAttachmentId("");
      setSelectedAttachment(null);
      return;
    }

    setSelectedAttachmentId((prev) => {
      if (prev && attachments.some((item) => item.id === prev)) {
        return prev;
      }
      return attachments[0].id;
    });
  }, [attachments]);

  useEffect(() => {
    if (attachments.length > 0 && !selectedAttachment) {
      setSelectedAttachment(attachments[0]);
      return;
    }

    if (selectedAttachment && !attachments.some((item) => item.id === selectedAttachment.id)) {
      setSelectedAttachment(attachments[0] || null);
    }
  }, [attachments, selectedAttachment]);

  useEffect(() => {
    if (!attachments.length || !selectedAttachmentId) {
      return;
    }
    const nextSelectedAttachment = attachments.find((item) => item.id === selectedAttachmentId) || null;
    if (nextSelectedAttachment && selectedAttachment?.id !== nextSelectedAttachment.id) {
      setSelectedAttachment(nextSelectedAttachment);
    }
  }, [attachments, selectedAttachment?.id, selectedAttachmentId]);

  const previewFile = useMemo(() => {
    if (attachmentUrl) {
      return {
        name: selectedAttachment?.file_name || "Attachment",
        url: attachmentUrl,
        isImage: isImageFile(attachmentMimeType) || isImageFile(selectedAttachment?.file_name),
        isPdf: isPdfFile(attachmentMimeType) || isPdfFile(selectedAttachment?.file_name),
      };
    }

    return null;
  }, [attachmentMimeType, attachmentUrl, selectedAttachment?.file_name]);

  const sanitizedEmailHtml = useMemo(() => {
    if (!emailDetails?.email_body_html) {
      return "";
    }
    return sanitizeEmailHtml(emailDetails.email_body_html);
  }, [emailDetails?.email_body_html]);

  const emailAttachmentList = useMemo(() => {
    if (emailDetails?.attachments?.length) {
      return emailDetails.attachments;
    }
    if (suggestion?.attachment_filename) {
      return [{ file_name: suggestion.attachment_filename, mime_type: suggestion.attachment_mime_type }];
    }
    if (suggestion?.invoice_attachment_path) {
      return [{ file_name: suggestion.invoice_attachment_path.split("/").pop() || "Attachment", mime_type: suggestion.attachment_mime_type }];
    }
    return [];
  }, [emailDetails?.attachments, suggestion?.attachment_filename, suggestion?.attachment_mime_type, suggestion?.invoice_attachment_path]);

  const renderAttachmentFallback = (message?: string) => (
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
      <Stack spacing={1.5} alignItems="center" sx={{ textAlign: "center", maxWidth: 360 }}>
        <DescriptionOutlinedIcon color="action" fontSize="large" />
        <Typography variant="body1" fontWeight={600}>
          Preview is not available for this file.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {message || "You can download the file to view it."}
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadOutlinedIcon fontSize="small" />}
          onClick={() => {
            void handleDownloadAttachment();
          }}
          disabled={attachmentDownloadLoading}
        >
          {attachmentDownloadLoading ? "Downloading..." : "Download"}
        </Button>
      </Stack>
    </Box>
  );

  const handleDownloadAttachment = async () => {
    if (!selectedAttachment && !previewFile?.url) {
      return;
    }

    try {
      setAttachmentError("");
      setAttachmentDownloadLoading(true);

      if (selectedAttachment) {
        let blob: Blob;
        if (selectedAttachment?.kind === "document" && selectedAttachment?.document_id && !isSuggestionMode) {
          const assetIdFromUrl = (selectedAttachment?.file_url || "").match(/\/api\/assets\/([^/]+)\/documents\//)?.[1] || selectedAttachment?.asset_id || suggestion?.id;
          if (!assetIdFromUrl) {
            throw new Error("Asset id is missing for document download");
          }
          blob = await fetchAssetDocumentBlob(assetIdFromUrl, selectedAttachment.document_id);
        } else {
          if (isSuggestionMode && suggestion?.id) {
            blob = await fetchSuggestionAttachmentBlob(suggestion.id, true);
          } else {
            const assetId = selectedAttachment?.asset_id || suggestion?.id;
            if (!assetId) {
              throw new Error("Asset id is missing for invoice download");
            }
            blob = await fetchAssetInvoiceBlob(assetId);
          }
        }

        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = selectedAttachment?.file_name || previewFile?.name || "attachment";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
        return;
      }

      if (previewFile?.url) {
        const link = document.createElement("a");
        link.href = previewFile.url;
        link.download = previewFile.name || "attachment";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (requestError: unknown) {
      setAttachmentError(requestError instanceof Error ? requestError.message : "Failed to download attachment");
    } finally {
      setAttachmentDownloadLoading(false);
    }
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

  const hasUnsavedChanges = (): boolean => {
    if (!open) {
      return false;
    }

    const currentSnapshot = JSON.stringify({
      form,
      warrantyEnabled,
      warrantyDetails,
      warrantyReminderPrefs,
      insuranceEnabled,
      insuranceDetails,
      insuranceReminderPrefs,
      serviceEnabled,
      serviceDetails,
      serviceReminderEnabled,
      selectedSupportingDocuments: supportingDocuments.map((file) => ({
        name: file.name,
        size: file.size,
        lastModified: file.lastModified,
      })),
      locallyDeletedDocumentIds,
    });

    return Boolean(initialSnapshot) && currentSnapshot !== initialSnapshot;
  };

  const handleSave = async () => {
    const rawCategory = form.category.trim();
    const rawSubcategory = form.subcategory.trim();
    const finalCategory = rawCategory.toLowerCase() === "other" ? form.custom_category.trim() : rawCategory;
    const finalSubcategory = rawSubcategory.toLowerCase() === "other" ? form.custom_subcategory.trim() : rawSubcategory;

    if (!finalCategory) {
      setBasicDetailsError("Category is required");
      return;
    }
    if (!finalSubcategory) {
      setBasicDetailsError("SubCategory is required");
      return;
    }

    setBasicDetailsError("");
    await onSave({
      product_name: form.product_name || undefined,
      brand: form.brand || undefined,
      vendor: form.vendor || undefined,
      price: form.price ? Number(form.price) : undefined,
      status: form.status || "Active",
      purchase_date: form.purchase_date || undefined,
      category: finalCategory || undefined,
      subcategory: finalSubcategory || undefined,
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





  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      disablePortal={inlineMode}
      hideBackdrop={inlineMode}
      disableEnforceFocus={inlineMode}
      disableRestoreFocus={inlineMode}
      sx={inlineMode
        ? {
            position: "relative !important",
            inset: "auto",
            overflow: "visible",
            "& .MuiDialog-container": {
              display: "block",
              height: "auto",
              position: "relative",
            },
          }
        : undefined}
      PaperProps={{
        sx: {
          width: inlineMode ? "100%" : { xs: "100%", md: "80vw" },
          maxWidth: inlineMode ? "100%" : 1320,
          m: inlineMode ? 0 : undefined,
          boxShadow: inlineMode ? "none" : undefined,
          border: inlineMode ? 0 : undefined,
        },
      }}
    >
      {showTitle ? (
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          Asset Preview
          {suggestion && (() => {
            const currentStatus = String(form.status || "").trim() || "Active";
            const normalized = currentStatus.toLowerCase();
            const color = normalized === "active" ? "#2e7d32"
              : normalized === "inactive" ? "#757575"
              : normalized.includes("expiring") ? "#e65100"
              : normalized === "expired" ? "#c62828"
              : normalized.includes("warranty") ? "#1565c0"
              : normalized === "lost" || normalized === "damaged" ? "#c62828"
              : "#757575";
            return (
              <Typography
                component="span"
                sx={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  letterSpacing: 0.5,
                  textTransform: "uppercase",
                  px: 1,
                  py: 0.3,
                  borderRadius: 1,
                  border: `1px solid ${color}`,
                  color,
                  lineHeight: 1.5,
                }}
              >
                {currentStatus}
              </Typography>
            );
          })()}
        </DialogTitle>
      ) : null}
      <DialogContent sx={{ overflow: inlineMode ? "visible" : "hidden", height: inlineMode ? "auto" : { xs: "70vh", md: "72vh" } }}>
        <Box sx={{ mt: 1, minHeight: 0, height: "100%" }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: collapseDocumentViewer
                ? { xs: "1fr", md: "1fr" }
                : { xs: "1fr", md: "minmax(320px, 42%) minmax(0, 1fr)" },
              gap: 2,
              height: "100%",
              minHeight: 0,
            }}
          >
            <>
              <Box sx={{ minHeight: 0, flex: 1, overflowY: "auto", pr: 0.5 }}>
                <Stack spacing={2}>
                  {suggestion?.attachment_filename ? (
                    <Alert severity="info">
                      Attachment detected: {suggestion.attachment_filename}
                    </Alert>
                  ) : null}
                  {attachmentError ? <Alert severity="error">{attachmentError}</Alert> : null}
                  {displayedParsingMessage ? <Alert severity="warning">{displayedParsingMessage}</Alert> : null}
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
                              setForm((prev) => ({
                                ...prev,
                                category: selectedCategory,
                                subcategory: "",
                                custom_category: selectedCategory.toLowerCase() === "other" ? prev.custom_category : "",
                                custom_subcategory: "",
                              }));
                            }}
                            sx={standardFieldSx}
                            fullWidth
                          >
                            {normalizedCategoryOptions.map((item) => (
                              <MenuItem key={item._id} value={item._id}>{item.name}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        {form.category === "Other" ? (
                          <Grid item xs={12} md={6}>
                            <TextField
                              size="small"
                              label="Enter Category *"
                              value={form.custom_category}
                              onChange={(event) => {
                                setBasicDetailsError("");
                                setForm((prev) => ({ ...prev, custom_category: event.target.value }));
                              }}
                              sx={standardFieldSx}
                              fullWidth
                            />
                          </Grid>
                        ) : null}
                        <Grid item xs={12} md={6}>
                          <TextField
                            size="small"
                            select
                            label="SubCategory *"
                            value={typeof form.subcategory === "object"
                              ? ((form.subcategory as { _id?: string; name?: string })._id || (form.subcategory as { name?: string }).name || "")
                              : form.subcategory}
                            onChange={(event) => {
                              setBasicDetailsError("");
                              const selectedSubcategory = event.target.value;
                              setFormSafe((prev: FormType) => ({
                                ...prev,
                                subcategory: selectedSubcategory,
                                custom_subcategory: selectedSubcategory.toLowerCase() === "other" ? prev.custom_subcategory : "",
                              }));
                            }}
                            sx={standardFieldSx}
                            fullWidth
                            disabled={!form.category}
                          >
                            {normalizedSubcategoryOptions.map((item) => (
                              <MenuItem key={item._id} value={item._id}>{item.name}</MenuItem>
                            ))}
                          </TextField>
                        </Grid>
                        {form.subcategory === "Other" ? (
                          <Grid item xs={12} md={6}>
                            <TextField
                              size="small"
                              label="Enter SubCategory *"
                              value={form.custom_subcategory}
                              onChange={(event) => {
                                setBasicDetailsError("");
                                setForm((prev) => ({ ...prev, custom_subcategory: event.target.value }));
                              }}
                              sx={standardFieldSx}
                              fullWidth
                            />
                          </Grid>
                        ) : null}
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
                            select
                            label="Status"
                            value={form.status || "Active"}
                            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
                            sx={standardFieldSx}
                            fullWidth
                          >
                            {["Active", "Inactive", "Lost", "Damaged"].map((s) => (
                              <MenuItem key={s} value={s} sx={{ py: 0.75 }}>{s}</MenuItem>
                            ))}
                          </TextField>
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
                          {suggestion?.invoice_currency && suggestion.invoice_currency !== "INR" && suggestion.invoice_amount != null ? (
                            <Typography variant="caption" color="text.secondary" sx={{ pl: 0.25 }}>
                              {`Original: ${suggestion.invoice_currency} ${suggestion.invoice_amount.toLocaleString("en-US", { maximumFractionDigits: 2 })} — converted to INR`}
                            </Typography>
                          ) : null}
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
            </>

            {!collapseDocumentViewer ? (
            <Paper variant="outlined" sx={{ minHeight: 0, display: "flex", flexDirection: "column", p: 2 }}>
              <>
                <Tabs
                  value={rightPanelTab}
                  onChange={(_, nextValue: "attachment" | "email") => setRightPanelTab(nextValue)}
                  sx={{ mb: 1 }}
                >
                  <Tab value="attachment" label="Attachment" />
                  {!disableAttachmentAndEmailPreview ? <Tab value="email" label="Email" /> : null}
                </Tabs>

                {rightPanelTab === "attachment" ? (
                  <>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                      <Typography variant="subtitle1">Attachment Preview</Typography>
                    </Box>

                    {attachments.length > 1 ? (
                      <Tabs
                        value={selectedAttachment?.id || ""}
                        onChange={(_, nextValue: string) => setSelectedAttachmentId(nextValue)}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{ mb: 1, minHeight: 36 }}
                      >
                        {attachments.map((attachment) => (
                          <Tab
                            key={attachment.id}
                            value={attachment.id}
                            label={attachment.file_name}
                            sx={{
                              textTransform: "none",
                              minHeight: 36,
                              maxWidth: 220,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          />
                        ))}
                      </Tabs>
                    ) : null}

                    {attachmentLoading ? (
                      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CircularProgress size={20} />
                          <Typography variant="body2" color="text.secondary">Loading attachment preview...</Typography>
                        </Stack>
                      </Box>
                    ) : attachmentError || attachmentRenderError ? (
                      renderAttachmentFallback(attachmentError || "The file could not be rendered in the preview panel.")
                    ) : previewFile?.isImage && previewFile.url ? (
                      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1 }}>
                        <Box
                          component="img"
                          src={previewFile.url}
                          alt={previewFile.name}
                          onError={() => {
                            setAttachmentRenderError(true);
                          }}
                          sx={{ width: "100%", height: "100%", objectFit: "contain", display: "block", bgcolor: "background.default" }}
                        />
                      </Box>
                    ) : previewFile?.isPdf && previewFile.url ? (
                      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden", border: 1, borderColor: "divider", borderRadius: 1 }}>
                        <object
                          data={`${previewFile.url}#zoom=80&navpanes=0&view=FitH`}
                          type="application/pdf"
                          width="100%"
                          height="100%"
                          aria-label="Attachment PDF Preview"
                        >
                          {renderAttachmentFallback("The PDF preview could not be loaded in this browser.")}
                        </object>
                      </Box>
                    ) : attachments.length > 0 ? (
                      renderAttachmentFallback("Preview is not available for this file format.")
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
                        <Alert severity="info">{getNoAttachmentMessage()}</Alert>
                      </Box>
                    )}
                  </>
                ) : (
                  disableAttachmentAndEmailPreview ? (
                    <Box
                      sx={{
                        flex: 1,
                        minHeight: 0,
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                        display: "flex",
                        alignItems: "stretch",
                        justifyContent: "flex-start",
                        px: 2,
                        py: 1.5,
                        overflowY: "auto",
                      }}
                    >
                      <Alert severity="info">Email preview is disabled for this source.</Alert>
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
                      {emailDetailsLoading ? (
                        <Box sx={{ minHeight: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CircularProgress size={20} />
                            <Typography variant="body2" color="text.secondary">Loading email details...</Typography>
                          </Stack>
                        </Box>
                      ) : (
                        <Stack spacing={1.5}>
                          {emailDetailsError ? <Alert severity="warning">{emailDetailsError}</Alert> : null}

                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>Subject</Typography>
                            <Tooltip title={emailDetails?.subject || suggestion?.subject || "-"} arrow>
                              <Typography variant="body2" noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                {emailDetails?.subject || suggestion?.subject || "-"}
                              </Typography>
                            </Tooltip>
                          </Box>

                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>From</Typography>
                            <Tooltip title={emailDetails?.sender || suggestion?.sender || "-"} arrow>
                              <Typography variant="body2" noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                {emailDetails?.sender || suggestion?.sender || "-"}
                              </Typography>
                            </Tooltip>
                          </Box>

                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>Date</Typography>
                            <Typography variant="body2">
                              {emailDetails?.received_date || suggestion?.received_date || suggestion?.email_date
                                ? new Date(emailDetails?.received_date || suggestion?.received_date || suggestion?.email_date || "").toLocaleString()
                                : "-"}
                            </Typography>
                          </Box>

                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>Email Body</Typography>
                            <Box
                              sx={{
                                mt: 0.75,
                                p: 1.25,
                                border: 1,
                                borderColor: "divider",
                                borderRadius: 1,
                                maxHeight: 260,
                                overflowY: "auto",
                                bgcolor: "background.default",
                              }}
                            >
                              {sanitizedEmailHtml ? (
                                <Box sx={{ "& img": { maxWidth: "100%" }, fontSize: "0.875rem" }} dangerouslySetInnerHTML={{ __html: sanitizedEmailHtml }} />
                              ) : (
                                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                                  {emailDetails?.email_body || suggestion?.email_body || "No email body available."}
                                </Typography>
                              )}
                            </Box>
                          </Box>

                          <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>Attachments</Typography>
                            <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                              {emailAttachmentList.length ? (
                                emailAttachmentList.map((attachment) => (
                                  <Typography key={`${attachment.file_name}-${attachment.mime_type || "unknown"}`} variant="body2">
                                    {attachment.file_name}
                                    {attachment.mime_type ? ` (${attachment.mime_type})` : ""}
                                    {attachment.size ? ` - ${formatAttachmentSize(attachment.size)}` : ""}
                                  </Typography>
                                ))
                              ) : (
                                <Typography variant="body2" color="text.secondary">No attachments</Typography>
                              )}
                            </Stack>
                          </Box>
                        </Stack>
                      )}
                    </Box>
                  )
                )}
              </>
            </Paper>
            ) : null}
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
