import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  FormControlLabel,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import DownloadIcon from "@mui/icons-material/Download";
import { useLocation, useNavigate } from "react-router-dom";

import AssetPreviewModal from "../components/modules/AssetPreviewModal.tsx";
import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import {
  AssetLifecyclePayload,
  AssetSuggestion,
  ExcelUploadResponse,
  UploadedAssetDocument,
  clearTemporarySuggestions,
  connectMailbox,
  createAsset,
  downloadAssetExcelTemplate,
  deleteAssetDocument,
  disconnectMailbox,
  getAssetCategories,
  getAssetDocuments,
  getAssetSuggestions,
  getMailboxStatus,
  parseSuggestionAttachment,
  rejectSuggestion,
  syncMailboxEmails,
  uploadAssetExcelFile,
  uploadAssetDocuments,
} from "../services/gmail.ts";

type AddAssetMethod = "email_sync" | "invoice_upload" | "excel_upload" | "barcode_qr" | "manual_entry";
type ActivityStepState = "completed" | "in_progress" | "pending";

const MODE_TO_METHOD_MAP: Record<string, AddAssetMethod> = {
  email: "email_sync",
  invoice: "invoice_upload",
  excel: "excel_upload",
  qr: "barcode_qr",
  barcode: "barcode_qr",
  manual: "manual_entry",
};

type ScanSummary = {
  emailsScanned: number;
  invoiceEmails: number;
  assetsDetected: number;
  serviceReceiptsSkipped: number;
};

const SYNC_ACTIVITY_STEPS = [
  "Connecting to mailbox",
  "Authenticating mailbox credentials",
  "Searching for invoice related emails",
  "Fetching email attachments",
  "Processing attachments",
  "Extracting invoice details",
  "Identifying asset information",
  "Generating asset suggestions",
  "Finalizing results",
];

const EXCEL_TEMPLATE_PREVIEW_COLUMNS: Array<{ key: string; label: string }> = [
  { key: "product_name", label: "Asset Name *" },
  { key: "category", label: "Category *" },
  { key: "custom_category", label: "Category (Other)" },
  { key: "subcategory", label: "SubCategory *" },
  { key: "custom_subcategory", label: "Sub Category (Other)" },
  { key: "vendor", label: "Vendor" },
  { key: "purchase_date", label: "Purchase Date" },
  { key: "price", label: "Purchase Price" },
  { key: "serial_number", label: "Serial Number" },
  { key: "model_number", label: "Model Number" },
  { key: "invoice_number", label: "Invoice Number" },
  { key: "location", label: "Location" },
  { key: "assigned_user", label: "Assigned User" },
  { key: "description", label: "Description" },
  { key: "notes", label: "Notes" },
  { key: "warranty_available", label: "Warranty Available" },
  { key: "warranty_provider", label: "Warranty Provider" },
  { key: "warranty_type", label: "Warranty Type" },
  { key: "warranty_start_date", label: "Warranty Start Date" },
  { key: "warranty_end_date", label: "Warranty End Date" },
  { key: "warranty_notes", label: "Warranty Notes" },
  { key: "warranty_reminder_30_days", label: "Warranty Reminder 30 Days" },
  { key: "warranty_reminder_7_days", label: "Warranty Reminder 7 Days" },
  { key: "warranty_reminder_on_expiry", label: "Warranty Reminder On Expiry" },
  { key: "insurance_available", label: "Insurance Available" },
  { key: "insurance_provider", label: "Insurance Provider" },
  { key: "insurance_policy_number", label: "Policy Number" },
  { key: "insurance_start_date", label: "Insurance Start Date" },
  { key: "insurance_expiry_date", label: "Insurance Expiry Date" },
  { key: "insurance_premium_amount", label: "Insurance Premium Amount" },
  { key: "insurance_coverage_notes", label: "Insurance Notes" },
  { key: "insurance_reminder_45_days", label: "Insurance Reminder 45 Days" },
  { key: "insurance_reminder_15_days", label: "Insurance Reminder 15 Days" },
  { key: "service_required", label: "Service Required" },
  { key: "service_frequency", label: "Service Frequency" },
  { key: "service_custom_interval_days", label: "Service Interval (Days)" },
  { key: "service_reminder_enabled", label: "Enable Next Service Reminder" },
];

// Frozen column widths (always pinned on right)
const FROZEN_COLUMN_WIDTHS = {
  error: 220,
  status: 120,
  actions: 100,
};
const EXCEL_PREVIEW_SELECTOR_WIDTH = 76;

const EXCEL_DEFAULT_PREVIEW_COLUMNS: Array<{ key: string; label: string; width: string }> = [
  { key: "product_name", label: "Asset Name", width: "220px" },
  { key: "category", label: "Category", width: "160px" },
  { key: "subcategory", label: "Sub Category", width: "180px" },
  { key: "vendor", label: "Vendor", width: "180px" },
  { key: "purchase_date", label: "Purchase Date", width: "150px" },
];
const EXCEL_PREVIEW_GRID_TEMPLATE = `${EXCEL_PREVIEW_SELECTOR_WIDTH}px ${EXCEL_DEFAULT_PREVIEW_COLUMNS.map((column) => column.width).join(" ")} ${FROZEN_COLUMN_WIDTHS.error}px ${FROZEN_COLUMN_WIDTHS.status}px ${FROZEN_COLUMN_WIDTHS.actions}px`;
const EXCEL_PREVIEW_GRID_MIN_WIDTH = `calc(${EXCEL_PREVIEW_SELECTOR_WIDTH}px + ${EXCEL_DEFAULT_PREVIEW_COLUMNS.map((column) => column.width).join(" + ")} + ${FROZEN_COLUMN_WIDTHS.error}px + ${FROZEN_COLUMN_WIDTHS.status}px + ${FROZEN_COLUMN_WIDTHS.actions}px)`;

// Comprehensive column definitions with width info for all columns (ordered for proper layout)
const EXCEL_ALL_COLUMNS_WITH_WIDTH: Array<{ key: string; label: string; width: string }> = [
  { key: "product_name", label: "Asset Name", width: "220px" },
  { key: "category", label: "Category", width: "160px" },
  { key: "custom_category", label: "Category (Other)", width: "160px" },
  { key: "subcategory", label: "Sub Category", width: "180px" },
  { key: "custom_subcategory", label: "Sub Category (Other)", width: "180px" },
  { key: "vendor", label: "Vendor", width: "180px" },
  { key: "purchase_date", label: "Purchase Date", width: "150px" },
  { key: "price", label: "Purchase Price", width: "140px" },
  { key: "serial_number", label: "Serial Number", width: "160px" },
  { key: "model_number", label: "Model Number", width: "160px" },
  { key: "invoice_number", label: "Invoice Number", width: "160px" },
  { key: "location", label: "Location", width: "160px" },
  { key: "assigned_user", label: "Assigned User", width: "160px" },
  { key: "description", label: "Description", width: "200px" },
  { key: "notes", label: "Notes", width: "200px" },
  { key: "warranty_available", label: "Warranty Available", width: "150px" },
  { key: "warranty_provider", label: "Warranty Provider", width: "160px" },
  { key: "warranty_type", label: "Warranty Type", width: "140px" },
  { key: "warranty_start_date", label: "Warranty Start Date", width: "150px" },
  { key: "warranty_end_date", label: "Warranty End Date", width: "150px" },
  { key: "warranty_notes", label: "Warranty Notes", width: "200px" },
  { key: "warranty_reminder_30_days", label: "Warranty Reminder 30 Days", width: "160px" },
  { key: "warranty_reminder_7_days", label: "Warranty Reminder 7 Days", width: "150px" },
  { key: "warranty_reminder_on_expiry", label: "Warranty Reminder On Expiry", width: "160px" },
  { key: "insurance_available", label: "Insurance Available", width: "150px" },
  { key: "insurance_provider", label: "Insurance Provider", width: "160px" },
  { key: "insurance_policy_number", label: "Policy Number", width: "160px" },
  { key: "insurance_start_date", label: "Insurance Start Date", width: "150px" },
  { key: "insurance_expiry_date", label: "Insurance Expiry Date", width: "150px" },
  { key: "insurance_premium_amount", label: "Insurance Premium Amount", width: "150px" },
  { key: "insurance_coverage_notes", label: "Insurance Notes", width: "200px" },
  { key: "insurance_reminder_45_days", label: "Insurance Reminder 45 Days", width: "160px" },
  { key: "insurance_reminder_15_days", label: "Insurance Reminder 15 Days", width: "160px" },
  { key: "service_required", label: "Service Required", width: "140px" },
  { key: "service_frequency", label: "Service Frequency", width: "150px" },
  { key: "service_custom_interval_days", label: "Service Interval (Days)", width: "150px" },
  { key: "service_reminder_enabled", label: "Enable Next Service Reminder", width: "160px" },
];

const AddAsset = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AssetSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [parsingSuggestionId, setParsingSuggestionId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [mailboxConnected, setMailboxConnected] = useState(false);
  const [mailboxType, setMailboxType] = useState("mailbox");
  const [mailboxEmail, setMailboxEmail] = useState("");
  const [scanDays, setScanDays] = useState(10);
  const [useCustomScanRange, setUseCustomScanRange] = useState(false);
  const [scanFromDate, setScanFromDate] = useState("");
  const [scanToDate, setScanToDate] = useState("");
  const [excludeServiceReceipts, setExcludeServiceReceipts] = useState(true);
  const [subjectKeywordsInput, setSubjectKeywordsInput] = useState("invoice, receipt");
  const [senderEmailsInput, setSenderEmailsInput] = useState("");
  const [mailboxEmailInput, setMailboxEmailInput] = useState("");
  const [mailboxEmailInputError, setMailboxEmailInputError] = useState("");
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [parsingMessage, setParsingMessage] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedAssetDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsActionLoading, setDocumentsActionLoading] = useState<Record<string, boolean>>({});
  const [nextSuggestionPromptOpen, setNextSuggestionPromptOpen] = useState(false);
  const [nextSuggestionLoading, setNextSuggestionLoading] = useState(false);
  const [reminderPromptOpen, setReminderPromptOpen] = useState(false);
  const [deferNextSuggestionPrompt, setDeferNextSuggestionPrompt] = useState(false);
  const [lastReminderCount, setLastReminderCount] = useState(0);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [activityStepStates, setActivityStepStates] = useState<ActivityStepState[]>(
    SYNC_ACTIVITY_STEPS.map(() => "pending")
  );
  const [processingDots, setProcessingDots] = useState(1);
  const [scanSummary, setScanSummary] = useState<ScanSummary | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedMethod, setSelectedMethod] = useState<AddAssetMethod>("email_sync");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelUploadResult, setExcelUploadResult] = useState<ExcelUploadResponse | null>(null);
  const [excelUploadLoading, setExcelUploadLoading] = useState(false);
  const [excelTemplateLoading, setExcelTemplateLoading] = useState(false);
  const [excelSearch, setExcelSearch] = useState("");
  const [selectedExcelRowIds, setSelectedExcelRowIds] = useState<string[]>([]);
  const [excelBulkAddLoading, setExcelBulkAddLoading] = useState(false);
  const [excelRowEditId, setExcelRowEditId] = useState<string | null>(null);
  const [excelRowAddLoading, setExcelRowAddLoading] = useState<Record<string, boolean>>({});
  const [excelCategoryMap, setExcelCategoryMap] = useState<Record<string, Set<string>>>({});
  const [addAllConfirmOpen, setAddAllConfirmOpen] = useState(false);
  const [manualAddAnotherPromptOpen, setManualAddAnotherPromptOpen] = useState(false);

  useAutoDismissMessage(message, setMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 5000 });

  const setActionLoading = (action: string, isLoading: boolean) => {
    setLoadingActions((prev) => ({ ...prev, [action]: isLoading }));
  };

  const setExcelRowAddItemLoading = (rowId: string, isLoading: boolean) => {
    setExcelRowAddLoading((prev) => ({ ...prev, [rowId]: isLoading }));
  };

  const isExcelRowAddItemLoading = (rowId: string) => Boolean(excelRowAddLoading[rowId]);

  const getCreationSourceForMethod = (method: AddAssetMethod): "manual" | "invoice_upload" | "qr_scan" => {
    if (method === "invoice_upload") {
      return "invoice_upload";
    }
    if (method === "barcode_qr") {
      return "qr_scan";
    }
    return "manual";
  };

  const buildManualSuggestion = (method: AddAssetMethod = "manual_entry"): AssetSuggestion => {
    const now = new Date().toISOString();
    const seed = `manual-${Date.now()}`;
    return {
      id: seed,
      product_name: "",
      quantity: 1,
      source: getCreationSourceForMethod(method),
      status: "new",
      email_message_id: seed,
      already_added: false,
      created_at: now,
      category: "",
      subcategory: "",
      vendor: "",
      brand: "",
      notes: "",
      description: "",
      location: "",
      assigned_user: "",
    };
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
    setMailboxType((status.mailbox_type || "mailbox").toLowerCase());
    setMailboxEmail(status.email_address ?? "");
  };

  const loadExcelCategoryMap = async () => {
    try {
      const categories = await getAssetCategories();
      const nextMap: Record<string, Set<string>> = {};
      categories.forEach((item) => {
        const category = String(item.category || "").trim();
        if (!category) {
          return;
        }
        nextMap[category.toLowerCase()] = new Set(
          (item.subcategories || [])
            .map((value) => String(value || "").trim().toLowerCase())
            .filter(Boolean)
        );
      });
      setExcelCategoryMap(nextMap);
    } catch {
      setExcelCategoryMap({});
    }
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
    void loadExcelCategoryMap();
  }, []);

  useEffect(() => {
    if (!isActionLoading("syncMailbox")) {
      setProcessingDots(1);
      return;
    }

    const timer = window.setInterval(() => {
      setProcessingDots((prev) => (prev >= 3 ? 1 : prev + 1));
    }, 450);

    return () => {
      window.clearInterval(timer);
    };
  }, [loadingActions]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = String(params.get("mode") || "").trim().toLowerCase();
    const methodParam = String(params.get("method") || "").trim();
    const method = MODE_TO_METHOD_MAP[mode] || methodParam;
    const validMethod = method === "email_sync"
      || method === "invoice_upload"
      || method === "excel_upload"
      || method === "barcode_qr"
      || method === "manual_entry";

    if (validMethod && method) {
      setSelectedMethod(method);
      if (method === "manual_entry") {
        setSelectedSuggestion((prev) => {
          if (String(prev?.source || "").toLowerCase() === "manual") {
            return prev;
          }
          return buildManualSuggestion(method);
        });
      } else if (String(selectedSuggestion?.source || "").toLowerCase() === "manual") {
        setSelectedSuggestion(null);
        setSelectedAssetId(null);
        setUploadedDocuments([]);
      }
    }

    const status = params.get("status");
    const callbackMessage = params.get("message");
    if (status === "connected") {
      setMessage("Mailbox connected successfully. You can run mailbox sync now.");
    }
    if (status === "error") {
      setError(callbackMessage || "Failed to connect mailbox.");
    }

    if (status || callbackMessage) {
      params.delete("status");
      params.delete("message");
      const search = params.toString();
      navigate(`${location.pathname}${search ? `?${search}` : ""}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate, selectedSuggestion?.source]);

  useEffect(() => {
    if (selectedMethod !== "excel_upload") {
      return;
    }
    setSelectedExcelRowIds([]);
  }, [selectedMethod]);

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
    setShowActivityPanel(true);
    setScanSummary(null);

    const updateActivityState = (activeIndex: number) => {
      setActivityStepStates(
        SYNC_ACTIVITY_STEPS.map((_, index) => {
          if (index < activeIndex) {
            return "completed";
          }
          if (index === activeIndex) {
            return "in_progress";
          }
          return "pending";
        })
      );
    };

    let activeStepIndex = 0;
    updateActivityState(activeStepIndex);

    const stepTimer = window.setInterval(() => {
      activeStepIndex = Math.min(activeStepIndex + 1, SYNC_ACTIVITY_STEPS.length - 1);
      updateActivityState(activeStepIndex);
    }, 900);

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

      const response = await syncMailboxEmails(effectiveScanDays, 200, subjectKeywords, senderEmails, excludeServiceReceipts);
      if (process.env.NODE_ENV !== "production") {
        console.log("Email Scan Full Response:", response);
        console.log("Parsed Suggestions:", response?.suggestions);
      }

      window.clearInterval(stepTimer);
      setActivityStepStates(SYNC_ACTIVITY_STEPS.map(() => "completed"));

      const emailsScanned = response.emails_scanned ?? response.scanned;
      const invoiceEmails = response.invoice_emails ?? response.purchase_emails_detected;
      const assetsDetected = response.assets_detected ?? response.created_suggestions;
      const serviceReceiptsSkipped = response.service_receipts_skipped ?? 0;

      setScanSummary({ emailsScanned, invoiceEmails, assetsDetected, serviceReceiptsSkipped });

      if (response.suggestions) {
        setSuggestions(response.suggestions);
      } else {
        await loadSuggestions();
      }

      setMessage("");
    } catch (requestError: unknown) {
      window.clearInterval(stepTimer);
      setShowActivityPanel(false);
      setActivityStepStates(SYNC_ACTIVITY_STEPS.map(() => "pending"));
      setError(requestError instanceof Error ? requestError.message : "Failed to sync mailbox");
    } finally {
      window.clearInterval(stepTimer);
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
      setSelectedAssetId(null);
      setUploadedDocuments([]);
      setParsingSuggestionId(suggestion.id);
      console.log("Selected asset data:", suggestion);
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

  const withDocumentActionLoading = (key: string, isLoading: boolean) => {
    setDocumentsActionLoading((prev) => ({ ...prev, [key]: isLoading }));
  };

  const isDocumentActionLoading = (key: string) => Boolean(documentsActionLoading[key]);

  const loadUploadedDocuments = async (assetId: string) => {
    setDocumentsLoading(true);
    try {
      const docs = await getAssetDocuments(assetId);
      setUploadedDocuments(docs);
    } finally {
      setDocumentsLoading(false);
    }
  };

  const handleViewUploadedDocument = (document: UploadedAssetDocument) => {
    const actionKey = `view-${document.document_id}`;
    withDocumentActionLoading(actionKey, true);
    try {
      setError("");
      window.open(document.file_url, "_blank", "noopener,noreferrer");
    } finally {
      withDocumentActionLoading(actionKey, false);
    }
  };

  const handleDeleteUploadedDocument = async (documentId: string) => {
    if (!selectedAssetId) {
      setError("Asset not available for document deletion.");
      return;
    }

    const actionKey = `delete-${documentId}`;
    withDocumentActionLoading(actionKey, true);
    try {
      setError("");
      await deleteAssetDocument(selectedAssetId, documentId);
      setUploadedDocuments((prev) => prev.filter((item) => item.document_id !== documentId));
      setMessage("Uploaded document deleted successfully.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete uploaded document");
    } finally {
      withDocumentActionLoading(actionKey, false);
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

    const sourceType = String(selectedSuggestion.source || "").toLowerCase();
    const isExcelSuggestion = sourceType === "excel" || sourceType === "excel_upload";
    const isMethodDrivenManualFlow = selectedMethod === "manual_entry" || selectedMethod === "invoice_upload" || selectedMethod === "barcode_qr";
    const isManualSuggestion = sourceType === "manual" || sourceType === "manual_entry" || sourceType === "invoice_upload" || sourceType === "qr_scan" || isMethodDrivenManualFlow;

    const createSource = isExcelSuggestion
      ? "excel_upload"
      : selectedMethod === "invoice_upload"
        ? "invoice_upload"
        : selectedMethod === "barcode_qr"
          ? "qr_scan"
          : isManualSuggestion
            ? "manual"
            : "email_sync";

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
        source: createSource,
        suggestion_id: isManualSuggestion || isExcelSuggestion ? undefined : selectedSuggestion.id,
      });

      setSelectedAssetId(createdAsset.id);

      if (payload.supporting_documents && payload.supporting_documents.length > 0) {
        const uploadResponse = await uploadAssetDocuments(createdAsset.id, payload.supporting_documents);
        setUploadedDocuments(uploadResponse.uploaded);
      } else {
        await loadUploadedDocuments(createdAsset.id);
      }

      if (!isManualSuggestion) {
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
      }

      if (isExcelSuggestion) {
        setExcelUploadResult((prev) => {
          if (!prev) {
            return prev;
          }
          return {
            ...prev,
            suggestions: prev.suggestions.map((item) =>
              item.id === selectedSuggestion.id
                ? {
                    ...item,
                    already_added: true,
                    status: "added",
                    asset_id: createdAsset.id,
                  }
                : item
            ),
          };
        });
      }

      setMessage("Asset added successfully");
      const reminderCount = Number(createdAsset.auto_reminders_created || 0);
      if (isManualSuggestion) {
        setSelectedSuggestion(null);
        setSelectedAssetId(null);
        setUploadedDocuments([]);
        setManualAddAnotherPromptOpen(true);
        return;
      }

      if (isExcelSuggestion) {
        setSelectedSuggestion(null);
        setSelectedAssetId(null);
        setUploadedDocuments([]);
        if (reminderCount > 0) {
          setLastReminderCount(reminderCount);
          setReminderPromptOpen(true);
        }
        return;
      }

      if (reminderCount > 0) {
        setLastReminderCount(reminderCount);
        setNextSuggestionPromptOpen(false);
        setReminderPromptOpen(true);
        setDeferNextSuggestionPrompt(true);
      } else {
        setNextSuggestionPromptOpen(true);
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save asset");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleViewNextSuggestion = async () => {
    setNextSuggestionLoading(true);
    try {
      setError("");
      const latestSuggestions = await getAssetSuggestions();
      setSuggestions(latestSuggestions);
      const nextSuggestion = latestSuggestions.find((item) => !item.already_added && String(item.status || "").toLowerCase() !== "rejected");

      if (!nextSuggestion) {
        handleFinishAssetFlow();
        return;
      }

      setNextSuggestionPromptOpen(false);
      await handlePrepareSave(nextSuggestion);
      setMessage("Loaded next asset suggestion.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load next asset suggestion");
    } finally {
      setNextSuggestionLoading(false);
    }
  };

  const handleFinishAssetFlow = () => {
    const run = async () => {
      try {
        await clearTemporarySuggestions();
      } catch {
        // Keep UX non-blocking; user can continue even if cleanup fails.
      } finally {
        setNextSuggestionPromptOpen(false);
        setSelectedSuggestion(null);
        setSelectedAssetId(null);
        setUploadedDocuments([]);
        setReminderPromptOpen(false);
        setDeferNextSuggestionPrompt(false);
        setLastReminderCount(0);
        setParsingMessage("");
        navigate("/assets");
      }
    };
    void run();
  };

  const handleSkipSuggestion = async (suggestion: AssetSuggestion) => {
    try {
      setActionLoading(`skip-${suggestion.id}`, true);
      await rejectSuggestion(suggestion.id);
      setSuggestions((prev) =>
        prev.map((item) =>
          item.id === suggestion.id
            ? {
                ...item,
                status: "rejected",
              }
            : item
        )
      );
      setMessage("Suggestion skipped.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to skip suggestion");
    } finally {
      setActionLoading(`skip-${suggestion.id}`, false);
    }
  };

  const formatSuggestionPrice = (suggestion: { price?: number; invoice_currency?: string; invoice_amount?: number }) => {
    if (suggestion.price === null || suggestion.price === undefined) {
      return "-";
    }

    // Guard against implausibly large values produced by parsing errors
    if (suggestion.price > 100_000_000) {
      return "-";
    }

    const inrFormatted = new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(suggestion.price);

    if (
      suggestion.invoice_currency
      && suggestion.invoice_currency !== "INR"
      && suggestion.invoice_amount != null
    ) {
      return `${inrFormatted} (${suggestion.invoice_currency} ${suggestion.invoice_amount.toLocaleString("en-US", { maximumFractionDigits: 2 })})`;
    }

    return inrFormatted;
  };

  const openBlobForDownload = (blob: Blob, fileName: string) => {
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  const handleDownloadExcelTemplate = async () => {
    try {
      setExcelTemplateLoading(true);
      setError("");
      const blob = await downloadAssetExcelTemplate();
      openBlobForDownload(blob, "asset_upload_template.xlsx");
      setMessage("Excel template downloaded successfully.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to download template");
    } finally {
      setExcelTemplateLoading(false);
    }
  };

  const handleOpenExcelEdit = async (suggestion: AssetSuggestion) => {
    setError("");
    setParsingMessage("");
    setSelectedAssetId(null);
    setUploadedDocuments([]);
    setExcelRowEditId(suggestion.id);
    setSelectedSuggestion(suggestion);
  };

  const handleAddExcelRowDirect = async (suggestion: AssetSuggestion) => {
    if (!isExcelRowValid(suggestion)) {
      setError("Please fix errors before adding");
      return;
    }

    const rowId = suggestion.id;
    try {
      setExcelRowAddItemLoading(rowId, true);
      setError("");
      const createdAsset = await createAsset({
        name: suggestion.product_name,
        brand: suggestion.brand,
        category: suggestion.category || "Other",
        subcategory: suggestion.subcategory || "Custom Asset",
        vendor: suggestion.vendor,
        purchase_date: suggestion.purchase_date,
        price: suggestion.price,
        serial_number: suggestion.serial_number,
        model_number: suggestion.model_number,
        invoice_number: suggestion.invoice_number,
        description: suggestion.description,
        notes: suggestion.notes,
        location: suggestion.location,
        assigned_user: suggestion.assigned_user,
        lifecycle_info: getLifecyclePayloadFromExcelSuggestion(suggestion),
        source: "excel_upload",
      });

      setExcelUploadResult((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          suggestions: prev.suggestions.map((item) => (
            item.id === rowId
              ? {
                  ...item,
                  already_added: true,
                  status: "added",
                  asset_id: createdAsset.id,
                }
              : item
          )),
        };
      });

      setMessage("Asset added successfully");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to add asset");
    } finally {
      setExcelRowAddItemLoading(rowId, false);
    }
  };

  const handleExcelUpload = async () => {
    if (!excelFile) {
      return;
    }

    try {
      setExcelUploadLoading(true);
      setError("");
      setMessage("");
      const response = await uploadAssetExcelFile(excelFile);
      setExcelUploadResult(response);
      setSelectedExcelRowIds([]);
      setSuggestions([]);
      setSelectedSuggestion(null);

      const readyCount = response.valid ?? response.parsed_rows ?? 0;
      const invalidCount = response.invalid ?? 0;
      setMessage(`${readyCount} assets ready to add`);
      if (invalidCount > 0) {
        setError(`${invalidCount} rows have errors`);
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to upload Excel file");
    } finally {
      setExcelUploadLoading(false);
    }
  };

  const filteredExcelSuggestions = useMemo(() => {
    const query = excelSearch.trim().toLowerCase();
    const source = excelUploadResult?.suggestions || [];
    if (!query) {
      return source;
    }
    return source.filter((item) => {
      return [
        item.product_name,
        item.vendor,
        item.brand,
        item.category,
        item.subcategory,
        item.status,
        ...(item.validation_errors || []),
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [excelSearch, excelUploadResult?.suggestions]);

  const isExcelRowValid = (item: AssetSuggestion) => {
    return String(item.validation_status || "valid").toLowerCase() === "valid";
  };

  const getExcelRowErrors = (item: AssetSuggestion) => {
    return Array.isArray(item.validation_errors) ? item.validation_errors : [];
  };

  const isValidDateInput = (value: unknown): boolean => {
    const raw = String(value || "").trim();
    if (!raw) {
      return true;
    }
    const parsed = new Date(raw);
    return !Number.isNaN(parsed.getTime());
  };

  const validateExcelSuggestion = (item: AssetSuggestion): string[] => {
    const errors: string[] = [];
    const name = String(item.product_name || "").trim();
    const category = String(item.category || "").trim();
    const subcategory = String(item.subcategory || "").trim();
    const categoryKey = category.toLowerCase();

    if (!name) {
      errors.push("Asset Name is required");
    }

    if (!category) {
      errors.push("Category is required");
    } else if (Object.keys(excelCategoryMap).length > 0 && !excelCategoryMap[categoryKey]) {
      errors.push("Invalid category");
    }

    if (!subcategory) {
      errors.push("SubCategory is required");
    } else if (Object.keys(excelCategoryMap).length > 0) {
      const allowedSubcategories = excelCategoryMap[categoryKey];
      if (allowedSubcategories && !allowedSubcategories.has(subcategory.toLowerCase())) {
        errors.push("Invalid subcategory for selected category");
      }
    }

    if (!isValidDateInput(item.purchase_date)) {
      errors.push("Purchase Date must be a valid date");
    }

    if (item.price !== undefined && item.price !== null && Number.isNaN(Number(item.price))) {
      errors.push("Purchase Price must be numeric");
    }

    const warranty = getExcelNestedRecord(item.warranty_details);
    if (!isValidDateInput(warranty?.start_date)) {
      errors.push("Warranty Start Date must be a valid date");
    }
    if (!isValidDateInput(warranty?.end_date)) {
      errors.push("Warranty End Date must be a valid date");
    }

    return errors;
  };

  const getExcelRowStatusMeta = (item: AssetSuggestion) => {
    const status = String(item.status || "").toLowerCase();
    if (status === "rejected" || status === "skipped" || status === "invalid") {
      return { label: "Skipped", color: "warning.main" as const };
    }
    if (item.already_added || status === "added" || status === "duplicate" || status === "confirmed") {
      return { label: "Already Added", color: "success.main" as const };
    }
    return { label: "New", color: "primary.main" as const };
  };

  const isExcelRowBlocked = (item: AssetSuggestion) => {
    const status = String(item.status || "").toLowerCase();
    return !isExcelRowValid(item) || item.already_added || status === "added" || status === "duplicate" || status === "confirmed";
  };

  const selectableVisibleExcelRows = useMemo(
    () => filteredExcelSuggestions.filter((item) => !isExcelRowBlocked(item)),
    [filteredExcelSuggestions]
  );

  const allVisibleExcelRowsSelected = useMemo(
    () => selectableVisibleExcelRows.length > 0
      && selectableVisibleExcelRows.every((item) => selectedExcelRowIds.includes(item.id)),
    [selectableVisibleExcelRows, selectedExcelRowIds]
  );

  const someVisibleExcelRowsSelected = useMemo(
    () => selectableVisibleExcelRows.some((item) => selectedExcelRowIds.includes(item.id)),
    [selectableVisibleExcelRows, selectedExcelRowIds]
  );

  const toLifecycleDetailsFromPayload = (payload?: AssetLifecyclePayload): Pick<AssetSuggestion, "warranty_details" | "insurance_details" | "service_details"> => {
    return {
      warranty_details: payload?.warranty
        ? {
            ...payload.warranty,
            reminders: {
              thirty_days_before: payload.warranty.reminders?.thirty_days_before ?? true,
              seven_days_before: payload.warranty.reminders?.seven_days_before ?? true,
              on_expiry: payload.warranty.reminders?.on_expiry ?? true,
            },
          }
        : null,
      insurance_details: payload?.insurance
        ? {
            ...payload.insurance,
            reminders: {
              forty_five_days_before: payload.insurance.reminders?.forty_five_days_before ?? true,
              fifteen_days_before: payload.insurance.reminders?.fifteen_days_before ?? true,
            },
          }
        : null,
      service_details: payload?.service
        ? {
            ...payload.service,
          }
        : null,
    };
  };

  const getExcelNestedRecord = (value: unknown): Record<string, unknown> | null => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  };

  const getExcelBooleanText = (value: unknown): string => {
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (typeof value === "number") {
      return value !== 0 ? "Yes" : "No";
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["yes", "y", "true", "1", "on"].includes(normalized)) {
        return "Yes";
      }
      if (["no", "n", "false", "0", "off"].includes(normalized)) {
        return "No";
      }
    }
    return "";
  };

  const getExcelNumberValue = (value: unknown): number | undefined => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const numeric = Number(value.trim());
      if (!Number.isNaN(numeric)) {
        return numeric;
      }
    }
    return undefined;
  };

  const getExcelDateText = (value: unknown): string => {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return raw;
    }
    return date.toLocaleDateString();
  };

  const getExcelObjectDisplayValue = (value: Record<string, unknown>): string => {
    const preferredKeys = [
      "name",
      "label",
      "title",
      "value",
      "category",
      "subcategory",
      "provider",
      "policy_number",
      "type",
      "frequency",
      "notes",
      "description",
    ];

    for (const key of preferredKeys) {
      const candidate = value[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return candidate.trim();
      }
      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return String(candidate);
      }
      if (typeof candidate === "boolean") {
        return candidate ? "Yes" : "No";
      }
    }

    const readableEntries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== null && entryValue !== undefined)
      .map(([, entryValue]) => {
        if (typeof entryValue === "string") {
          return entryValue.trim();
        }
        if (typeof entryValue === "number" && Number.isFinite(entryValue)) {
          return String(entryValue);
        }
        if (typeof entryValue === "boolean") {
          return entryValue ? "Yes" : "No";
        }
        return "";
      })
      .filter(Boolean);

    return readableEntries.join(", ");
  };

  const getExcelDisplayText = (value: unknown): string => {
    if (value === null || value === undefined) {
      return "";
    }

    if (Array.isArray(value)) {
      return value
        .map((item) => getExcelDisplayText(item))
        .filter(Boolean)
        .join(", ");
    }

    if (typeof value === "object") {
      return getExcelObjectDisplayValue(value as Record<string, unknown>);
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : "";
    }

    const text = String(value).trim();
    if (!text || text === "{}" || text === "[]") {
      return "";
    }
    return text;
  };

  const getExcelCellValue = (item: AssetSuggestion, key: string): string => {
    const warranty = getExcelNestedRecord(item.warranty_details);
    const warrantyReminders = getExcelNestedRecord(warranty?.reminders);
    const insurance = getExcelNestedRecord(item.insurance_details);
    const insuranceReminders = getExcelNestedRecord(insurance?.reminders);
    const service = getExcelNestedRecord(item.service_details);

    switch (key) {
      case "custom_category":
      case "custom_subcategory":
        return "";
      case "warranty_available":
        return getExcelBooleanText(warranty?.available);
      case "warranty_provider":
        return getExcelDisplayText(warranty?.provider);
      case "warranty_type":
        return getExcelDisplayText(warranty?.type);
      case "warranty_start_date":
        return getExcelDateText(warranty?.start_date);
      case "warranty_end_date":
        return getExcelDateText(warranty?.end_date);
      case "warranty_notes":
        return getExcelDisplayText(warranty?.notes);
      case "warranty_reminder_30_days":
        return getExcelBooleanText(warrantyReminders?.thirty_days_before);
      case "warranty_reminder_7_days":
        return getExcelBooleanText(warrantyReminders?.seven_days_before);
      case "warranty_reminder_on_expiry":
        return getExcelBooleanText(warrantyReminders?.on_expiry);
      case "insurance_available":
        return getExcelBooleanText(insurance?.available);
      case "insurance_provider":
        return getExcelDisplayText(insurance?.provider);
      case "insurance_policy_number":
        return getExcelDisplayText(insurance?.policy_number);
      case "insurance_start_date":
        return getExcelDateText(insurance?.start_date);
      case "insurance_expiry_date":
        return getExcelDateText(insurance?.expiry_date);
      case "insurance_premium_amount": {
        const premium = getExcelNumberValue(insurance?.premium_amount);
        return premium === undefined ? "" : String(premium);
      }
      case "insurance_coverage_notes":
        return getExcelDisplayText(insurance?.coverage_notes || insurance?.notes);
      case "insurance_reminder_45_days":
        return getExcelBooleanText(insuranceReminders?.forty_five_days_before);
      case "insurance_reminder_15_days":
        return getExcelBooleanText(insuranceReminders?.fifteen_days_before);
      case "service_required":
        return getExcelBooleanText(service?.required);
      case "service_frequency":
        return getExcelDisplayText(service?.frequency);
      case "service_custom_interval_days": {
        const interval = getExcelNumberValue(service?.custom_interval_days);
        return interval === undefined ? "" : String(interval);
      }
      case "service_reminder_enabled":
        return getExcelBooleanText(service?.reminder_enabled);
      case "purchase_date":
        return getExcelDateText(item.purchase_date);
      case "price":
        return item.price === undefined || item.price === null ? "" : String(item.price);
      default:
        return getExcelDisplayText((item as unknown as Record<string, unknown>)[key]);
    }
  };

  const getLifecyclePayloadFromExcelSuggestion = (item: AssetSuggestion): AssetLifecyclePayload => {
    const warranty = getExcelNestedRecord(item.warranty_details);
    const warrantyReminders = getExcelNestedRecord(warranty?.reminders);
    const insurance = getExcelNestedRecord(item.insurance_details);
    const insuranceReminders = getExcelNestedRecord(insurance?.reminders);
    const service = getExcelNestedRecord(item.service_details);

    return {
      warranty: {
        available: getExcelBooleanText(warranty?.available) === "Yes",
        provider: String(warranty?.provider || "") || undefined,
        type: String(warranty?.type || "") || undefined,
        start_date: String(warranty?.start_date || "") || undefined,
        end_date: String(warranty?.end_date || "") || undefined,
        notes: String(warranty?.notes || "") || undefined,
        reminders: {
          thirty_days_before: getExcelBooleanText(warrantyReminders?.thirty_days_before) === "Yes",
          seven_days_before: getExcelBooleanText(warrantyReminders?.seven_days_before) === "Yes",
          on_expiry: getExcelBooleanText(warrantyReminders?.on_expiry) === "Yes",
        },
      },
      insurance: {
        available: getExcelBooleanText(insurance?.available) === "Yes",
        provider: String(insurance?.provider || "") || undefined,
        policy_number: String(insurance?.policy_number || "") || undefined,
        start_date: String(insurance?.start_date || "") || undefined,
        expiry_date: String(insurance?.expiry_date || "") || undefined,
        premium_amount: getExcelNumberValue(insurance?.premium_amount),
        coverage_notes: String(insurance?.coverage_notes || insurance?.notes || "") || undefined,
        reminders: {
          forty_five_days_before: getExcelBooleanText(insuranceReminders?.forty_five_days_before) === "Yes",
          fifteen_days_before: getExcelBooleanText(insuranceReminders?.fifteen_days_before) === "Yes",
        },
      },
      service: {
        required: getExcelBooleanText(service?.required) === "Yes",
        frequency: String(service?.frequency || "") || undefined,
        custom_interval_days: getExcelNumberValue(service?.custom_interval_days),
        reminder_enabled: getExcelBooleanText(service?.reminder_enabled) === "Yes",
      },
    };
  };

  const toggleExcelRowSelection = (rowId: string) => {
    setSelectedExcelRowIds((prev) => (
      prev.includes(rowId)
        ? prev.filter((id) => id !== rowId)
        : [...prev, rowId]
    ));
  };

  const handleAddAllExcelAssets = async () => {
    if (!excelUploadResult) {
      return;
    }

    const selectedRows = selectedExcelRowIds.length
      ? excelUploadResult.suggestions.filter((item) => selectedExcelRowIds.includes(item.id))
      : excelUploadResult.suggestions;

    const invalidRows = selectedRows.filter((item) => !isExcelRowValid(item));
    const addableRows = selectedRows.filter((item) => isExcelRowValid(item) && !isExcelRowBlocked(item));
    if (!addableRows.length) {
      setError("No valid rows available to add.");
      return;
    }

    try {
      setExcelBulkAddLoading(true);
      setError("");
      let addedCount = 0;
      const failedRows: Array<{ row: string; reason: string }> = [];
      const createdAssetBySuggestionId: Record<string, string> = {};

      for (const item of addableRows) {
        try {
          const created = await createAsset({
            name: item.product_name,
            brand: item.brand,
            category: item.category || "Other",
            subcategory: item.subcategory || "Custom Asset",
            vendor: item.vendor,
            purchase_date: item.purchase_date,
            price: item.price,
            serial_number: item.serial_number,
            model_number: item.model_number,
            invoice_number: item.invoice_number,
            description: item.description,
            notes: item.notes,
            location: item.location,
            assigned_user: item.assigned_user,
            lifecycle_info: getLifecyclePayloadFromExcelSuggestion(item),
            source: "excel_upload",
          });
          createdAssetBySuggestionId[item.id] = created.id;
          addedCount += 1;
        } catch (requestError: unknown) {
          failedRows.push({
            row: item.product_name || item.id,
            reason: requestError instanceof Error ? requestError.message : "Failed to add row",
          });
        }
      }

      setExcelUploadResult((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          suggestions: prev.suggestions.map((item) => {
            const createdAssetId = createdAssetBySuggestionId[item.id];
            if (!createdAssetId) {
              return item;
            }
            return {
              ...item,
              already_added: true,
              status: "added",
              asset_id: createdAssetId,
            };
          }),
        };
      });

      setSelectedExcelRowIds((prev) => prev.filter((id) => !Object.prototype.hasOwnProperty.call(createdAssetBySuggestionId, id)));

      if (addedCount > 0) {
        setMessage(`${addedCount} assets added successfully`);
      }
      if (invalidRows.length > 0) {
        setError(`${invalidRows.length} rows skipped due to errors`);
      }
      if (failedRows.length > 0) {
        const firstError = failedRows[0];
        setError(`${failedRows.length} row(s) failed. Example: ${firstError.row} - ${firstError.reason}`);
      }
      if (addedCount === 0 && failedRows.length > 0) {
        setError(`Failed to add assets. Example: ${failedRows[0].row} - ${failedRows[0].reason}`);
      }
    } finally {
      setExcelBulkAddLoading(false);
    }
  };

  const handleConfirmAddAllAssets = async () => {
    setAddAllConfirmOpen(false);
    await handleAddAllExcelAssets();
  };

  const handleExcelModalSave = async (payload: {
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
    const sourceType = String(selectedSuggestion?.source || "").toLowerCase();
    const isExcelEditMode = sourceType === "excel" && Boolean(excelRowEditId);

    if (!isExcelEditMode || !selectedSuggestion) {
      await handleSaveAsset(payload);
      return;
    }

    const updatedSuggestion: AssetSuggestion = {
      ...selectedSuggestion,
      product_name: payload.product_name ?? selectedSuggestion.product_name,
      brand: payload.brand ?? selectedSuggestion.brand,
      vendor: payload.vendor ?? selectedSuggestion.vendor,
      price: payload.price ?? selectedSuggestion.price,
      purchase_date: payload.purchase_date ?? selectedSuggestion.purchase_date,
      category: payload.category ?? selectedSuggestion.category,
      subcategory: payload.subcategory ?? selectedSuggestion.subcategory,
      serial_number: payload.serial_number ?? selectedSuggestion.serial_number,
      model_number: payload.model_number ?? selectedSuggestion.model_number,
      invoice_number: payload.invoice_number ?? selectedSuggestion.invoice_number,
      description: payload.description ?? selectedSuggestion.description,
      notes: payload.notes ?? selectedSuggestion.notes,
      location: payload.location ?? selectedSuggestion.location,
      assigned_user: payload.assigned_user ?? selectedSuggestion.assigned_user,
      ...toLifecycleDetailsFromPayload(payload.lifecycle_info),
    };

    const validationErrors = validateExcelSuggestion(updatedSuggestion);
    const isValid = validationErrors.length === 0;
    const normalizedSuggestion: AssetSuggestion = {
      ...updatedSuggestion,
      validation_status: isValid ? "valid" : "invalid",
      validation_errors: validationErrors,
      status: isValid ? "new" : "invalid",
    };

    setExcelUploadResult((prev) => {
      if (!prev) {
        return prev;
      }

      const nextSuggestions = prev.suggestions.map((item) => (
        item.id === selectedSuggestion.id ? normalizedSuggestion : item
      ));
      const valid = nextSuggestions.filter((item) => isExcelRowValid(item)).length;
      const invalid = nextSuggestions.length - valid;
      const data = nextSuggestions.map((item) => ({
        row: item.row_number || Number(String(item.id).replace("excel-row-", "")) || 0,
        status: (String(item.validation_status || "valid").toLowerCase() === "valid" ? "valid" : "invalid") as "valid" | "invalid",
        errors: getExcelRowErrors(item),
      }));

      return {
        ...prev,
        parsed_rows: valid,
        valid,
        invalid,
        data,
        suggestions: nextSuggestions,
      };
    });

    setSelectedSuggestion(null);
    setExcelRowEditId(null);
    setSelectedAssetId(null);
    setUploadedDocuments([]);
    setParsingMessage("");
    if (isValid) {
      setMessage("Row updated and ready to add");
    } else {
      setError("Please fix errors before adding");
    }
  };

  const standardControlHeight = 36;
  const standardFieldSx = {
    "& .MuiInputBase-root": {
      height: standardControlHeight,
    },
  };

  const handleStartManualEntry = (method: AddAssetMethod = selectedMethod) => {
    setError("");
    setMessage("");
    setSelectedAssetId(null);
    setUploadedDocuments([]);
    setParsingMessage("");
    setSelectedSuggestion(buildManualSuggestion(method));
  };

  const handleManualAddAnother = () => {
    setManualAddAnotherPromptOpen(false);
    handleStartManualEntry();
  };

  const handleManualFinish = () => {
    setManualAddAnotherPromptOpen(false);
    navigate("/assets");
  };

  const handleMethodChange = (method: AddAssetMethod) => {
    setSelectedMethod(method);

    const params = new URLSearchParams(location.search);
    params.set("method", method);
    const nextUrl = `${location.pathname}?${params.toString()}`;
    const currentUrl = `${location.pathname}${location.search || ""}`;
    if (nextUrl !== currentUrl) {
      navigate(nextUrl, { replace: true });
    }

    if (method === "manual_entry") {
      handleStartManualEntry(method);
      return;
    }

    if (String(selectedSuggestion?.source || "").toLowerCase() === "manual") {
      setSelectedSuggestion(null);
      setSelectedAssetId(null);
      setUploadedDocuments([]);
    }
  };

  const isManualSelectionActive = selectedMethod === "manual_entry"
    && String(selectedSuggestion?.source || "").toLowerCase() === "manual";

  return (
    <Box
      className="grid"
      sx={{
        height: "calc(100vh - 112px)",
        overflow: isManualSelectionActive ? "auto" : "hidden",
        alignContent: "flex-start",
      }}
    >
      <Box className="col-12">
        <Typography variant="h4">Add Asset</Typography>
      </Box>

      <Box className="col-12">
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Box
            sx={{
              display: "flex",
              alignItems: { xs: "stretch", md: "center" },
              justifyContent: "flex-start",
              gap: 1.5,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ width: { xs: "100%", md: 320 }, maxWidth: "100%" }}>
              <TextField
                select
                size="small"
                label="Add Asset Method"
                value={selectedMethod}
                onChange={(event) => handleMethodChange(event.target.value as AddAssetMethod)}
                sx={standardFieldSx}
                fullWidth
              >
                <MenuItem value="email_sync">Email Sync</MenuItem>
                <MenuItem value="invoice_upload">Invoice Upload</MenuItem>
                <MenuItem value="excel_upload">Excel Upload</MenuItem>
                <MenuItem value="barcode_qr">Barcode / QR Code Scan</MenuItem>
                <MenuItem value="manual_entry">Manual Entry</MenuItem>
              </TextField>
            </Box>

            <Fade in={selectedMethod === "email_sync"} timeout={180} mountOnEnter unmountOnExit>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: { xs: "space-between", md: "flex-end" },
                  gap: 1.25,
                  minWidth: { xs: "100%", md: "auto" },
                  ml: { xs: 0, md: "auto" },
                  flexWrap: "wrap",
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box
                    sx={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      bgcolor: mailboxConnected ? "success.main" : "error.main",
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="body2" fontWeight={500}>
                    {mailboxConnected ? `Connected to ${mailboxType}` : "Not Connected"}
                  </Typography>
                </Box>

                {mailboxConnected ? (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => {
                      void handleDisconnectMailbox();
                    }}
                    disabled={isActionLoading("connectMailbox") || isActionLoading("disconnectMailbox")}
                    sx={{ height: standardControlHeight }}
                  >
                    {isActionLoading("disconnectMailbox") ? "Disconnecting..." : "Disconnect"}
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    onClick={() => {
                      void handleConnectClick();
                    }}
                    disabled={isActionLoading("connectMailbox") || isActionLoading("disconnectMailbox")}
                    sx={{ height: standardControlHeight }}
                  >
                    {isActionLoading("connectMailbox") ? "Connecting..." : "Connect Mailbox"}
                  </Button>
                )}
              </Box>
            </Fade>
          </Box>
        </Paper>
      </Box>

      <Box className="col-12" sx={{ minHeight: 0, display: isManualSelectionActive ? "block" : "flex" }}>
        <Stack spacing={3} sx={{ minHeight: 0, flex: 1, overflow: isManualSelectionActive ? "visible" : "hidden" }}>
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
                            <FormControlLabel
                              control={
                                <Checkbox
                                  size="small"
                                  checked={excludeServiceReceipts}
                                  onChange={(event) => setExcludeServiceReceipts(event.target.checked)}
                                />
                              }
                              label="Exclude service and delivery receipts"
                              sx={{ ml: 0 }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ pl: 0.5 }}>
                              Keeps scans focused on tangible asset invoices (Uber, food, courier, etc. are skipped).
                            </Typography>
                            <Button
                              variant="outlined"
                              onClick={handleRunMailboxSync}
                              disabled={isActionLoading("syncMailbox") || !mailboxConnected || isActionLoading("loadSuggestions")}
                              sx={{ height: standardControlHeight, minWidth: 210 }}
                            >
                              Fetch assets from mailbox
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
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: { xs: "flex-start", md: "center" },
                          justifyContent: "space-between",
                          gap: 1.5,
                          flexWrap: "wrap",
                        }}
                      >
                        <Typography variant="h6">Asset Suggestions</Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                          {scanSummary ? (
                            <>
                              <Chip
                                icon={<MailOutlineIcon />}
                                label={`Emails Scanned: ${scanSummary.emailsScanned}`}
                                color="primary"
                                variant="outlined"
                                size="small"
                              />
                              <Chip
                                label={`Invoices Found: ${scanSummary.invoiceEmails}`}
                                variant="outlined"
                                size="small"
                              />
                              <Chip
                                label={`Assets Identified: ${scanSummary.assetsDetected}`}
                                variant="outlined"
                                size="small"
                              />
                              <Chip
                                label={`Service Receipts Skipped: ${scanSummary.serviceReceiptsSkipped}`}
                                variant="outlined"
                                size="small"
                              />
                            </>
                          ) : null}
                        </Stack>
                      </Box>
                      {isActionLoading("loadSuggestions") ? <CircularProgress size={20} /> : null}

                      {showActivityPanel && isActionLoading("syncMailbox") ? (
                        <Paper variant="outlined" sx={{ p: 2 }}>
                          <Stack spacing={1.25}>
                            <Typography variant="subtitle2">System Activity</Typography>
                            {SYNC_ACTIVITY_STEPS.map((step, index) => {
                              const state = activityStepStates[index] ?? "pending";
                              return (
                                <Box key={step} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                  {state === "completed" ? (
                                    <CheckCircleOutlineIcon fontSize="small" color="success" />
                                  ) : state === "in_progress" ? (
                                    <HourglassEmptyIcon fontSize="small" color="warning" />
                                  ) : (
                                    <RadioButtonUncheckedIcon fontSize="small" color="disabled" />
                                  )}
                                  <Typography
                                    variant="body2"
                                    color={state === "pending" ? "text.secondary" : "text.primary"}
                                    fontWeight={state === "in_progress" ? 600 : 400}
                                  >
                                    {step}
                                  </Typography>
                                </Box>
                              );
                            })}
                            <Typography variant="body2" color="text.secondary" sx={{ pt: 0.5 }}>
                              Processing your emails. This may take a few seconds.
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Processing emails {".".repeat(processingDots)}
                            </Typography>
                          </Stack>
                        </Paper>
                      ) : null}

                      {suggestions.length > 0 ? (
                        <Paper className="grid-container" variant="outlined" sx={{ height: 420, overflowY: "auto", overflowX: "auto" }}>
                          <Box sx={{ minWidth: 860 }}>
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns: "1.6fr 2.8fr 1.4fr 1fr 1.1fr",
                                columnGap: 2,
                                px: 2,
                                py: 1.25,
                                bgcolor: (theme) => theme.palette.mode === "dark" ? "#1f2937" : "grey.100",
                                borderBottom: 1,
                                borderColor: (theme) => theme.palette.mode === "dark" ? "#374151" : "divider",
                                position: "sticky",
                                top: 0,
                                zIndex: 1,
                              }}
                            >
                              <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Sender</Typography>
                              <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Subject</Typography>
                              <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Email Date</Typography>
                              <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Status</Typography>
                              <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Action</Typography>
                            </Box>

                            {suggestions.map((suggestion) => {
                              const isSkipped = String(suggestion.status || "").toLowerCase() === "rejected";
                              const skipActionKey = `skip-${suggestion.id}`;
                              const skipLoading = isActionLoading(skipActionKey);

                              return (
                                <Box
                                  key={suggestion.id}
                                  sx={{
                                    display: "grid",
                                    gridTemplateColumns: "1.6fr 2.8fr 1.4fr 1fr 1.1fr",
                                    columnGap: 2,
                                    alignItems: "center",
                                    px: 2,
                                    py: 1.1,
                                    borderBottom: 1,
                                    borderColor: "divider",
                                  }}
                                >
                                  <Tooltip title={suggestion.sender || "-"} arrow>
                                    <Typography variant="body2" noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {suggestion.sender || "-"}
                                    </Typography>
                                  </Tooltip>
                                  <Tooltip title={suggestion.subject || "-"} arrow>
                                    <Typography variant="body2" noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {suggestion.subject || "-"}
                                    </Typography>
                                  </Tooltip>
                                  <Tooltip title={(suggestion.received_date || suggestion.email_date || "-") as string} arrow>
                                    <Typography variant="body2" noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {suggestion.received_date || suggestion.email_date
                                        ? new Date(suggestion.received_date || suggestion.email_date || "").toLocaleString()
                                        : "-"}
                                    </Typography>
                                  </Tooltip>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: suggestion.already_added
                                        ? "success.main"
                                        : isSkipped
                                          ? "warning.main"
                                          : "primary.main",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {suggestion.already_added ? "Already Added" : isSkipped ? "Skipped" : "New"}
                                  </Typography>
                                  <Stack direction="row" spacing={0.5} alignItems="center">
                                    {!suggestion.already_added && !isSkipped ? (
                                      <>
                                        <Tooltip title="Add Asset" arrow>
                                          <span>
                                            <IconButton
                                              aria-label="Add Asset"
                                              color="primary"
                                              onClick={() => {
                                                void handlePrepareSave(suggestion);
                                              }}
                                              disabled={parsingSuggestionId === suggestion.id}
                                              size="small"
                                              sx={{
                                                p: 1,
                                                transition: "transform 0.2s ease, background-color 0.2s ease",
                                                "&:hover": {
                                                  transform: "scale(1.08)",
                                                },
                                              }}
                                            >
                                              {parsingSuggestionId === suggestion.id ? <CircularProgress size={18} /> : <AddIcon fontSize="small" />}
                                            </IconButton>
                                          </span>
                                        </Tooltip>
                                        <Tooltip title="Skip" arrow>
                                          <span>
                                            <IconButton
                                              aria-label="Skip"
                                              onClick={() => {
                                                void handleSkipSuggestion(suggestion);
                                              }}
                                              disabled={skipLoading}
                                              size="small"
                                              sx={{
                                                p: 1,
                                                color: "warning.main",
                                                transition: "transform 0.2s ease, background-color 0.2s ease",
                                                "&:hover": {
                                                  transform: "scale(1.08)",
                                                  bgcolor: "warning.light",
                                                },
                                              }}
                                            >
                                              {skipLoading ? <CircularProgress size={18} color="warning" /> : <CloseIcon fontSize="small" />}
                                            </IconButton>
                                          </span>
                                        </Tooltip>
                                      </>
                                    ) : (
                                      <Typography variant="body2" color="text.secondary">-</Typography>
                                    )}
                                  </Stack>
                                </Box>
                              );
                            })}
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
                <Stack spacing={2.5}>
                  <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                        <Typography variant="h6">Upload Excel File</Typography>
                        <Button
                          variant="outlined"
                          startIcon={<DownloadIcon />}
                          onClick={() => {
                            void handleDownloadExcelTemplate();
                          }}
                          disabled={excelTemplateLoading}
                          sx={{ height: standardControlHeight }}
                        >
                          {excelTemplateLoading ? "Preparing..." : "Download Template"}
                        </Button>
                      </Box>

                      <div className="grid align-items-end">
                        <div className="col-12 md:col-7 lg:col-6">
                          <Button
                            component="label"
                            variant="outlined"
                            sx={{ height: standardControlHeight, justifyContent: "flex-start", width: "100%" }}
                          >
                            {excelFile ? excelFile.name : "Choose .xlsx file"}
                            <input
                              type="file"
                              accept=".xlsx"
                              hidden
                              onChange={(event) => {
                                const file = event.target.files?.[0] ?? null;
                                setExcelFile(file);
                              }}
                            />
                          </Button>
                        </div>
                        <div className="col-12 md:col-5 lg:col-3">
                          <Button
                            variant="contained"
                            onClick={() => {
                              void handleExcelUpload();
                            }}
                            disabled={!excelFile || excelUploadLoading}
                            sx={{ height: standardControlHeight, minWidth: 120 }}
                            fullWidth
                          >
                            {excelUploadLoading ? "Uploading..." : "Upload and Parse"}
                          </Button>
                        </div>
                      </div>

                      <Typography variant="body2" color="text.secondary">
                        Template includes core fields and lifecycle columns for warranty, insurance, and service details.
                      </Typography>

                      {excelUploadResult ? (
                        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", rowGap: 1 }}>
                          <Chip label={`Total Rows: ${excelUploadResult.total ?? excelUploadResult.total_rows}`} size="small" variant="outlined" />
                          <Chip label={`Valid: ${excelUploadResult.valid ?? excelUploadResult.parsed_rows}`} size="small" color="primary" variant="outlined" />
                          <Chip label={`Invalid: ${excelUploadResult.invalid ?? 0}`} size="small" color={(excelUploadResult.invalid ?? 0) > 0 ? "warning" : "default"} variant="outlined" />
                          <Chip label={`Skipped: ${excelUploadResult.skipped_rows.length}`} size="small" variant="outlined" />
                        </Stack>
                      ) : null}

                      {excelUploadResult && excelUploadResult.skipped_rows.length > 0 ? (
                        <Alert severity="warning">
                          {excelUploadResult.skipped_rows.length} row(s) were skipped. Example: row {excelUploadResult.skipped_rows[0]?.row_number} - {excelUploadResult.skipped_rows[0]?.reason}
                        </Alert>
                      ) : null}
                    </Stack>
                  </Paper>

                  {excelUploadResult ? (
                    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, minHeight: 0, display: "flex", flexDirection: "column" }}>
                      <Stack spacing={1.5}>
                        <Box sx={{ display: "flex", alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between", gap: 1.25, flexWrap: "wrap" }}>
                          <Typography variant="h6">Excel Asset Preview</Typography>
                          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ flexWrap: "wrap", rowGap: 1 }}>
                            <Button
                              variant="contained"
                              onClick={() => {
                                setAddAllConfirmOpen(true);
                              }}
                              disabled={
                                selectedExcelRowIds.length === 0
                                || excelBulkAddLoading
                              }
                              sx={{ height: standardControlHeight }}
                            >
                              {excelBulkAddLoading ? "Adding..." : `Add Selected Assets (${selectedExcelRowIds.length})`}
                            </Button>
                          </Stack>
                        </Box>

                        <TextField
                          size="small"
                          label="Search rows"
                          value={excelSearch}
                          onChange={(event) => setExcelSearch(event.target.value)}
                          placeholder="Search by name, vendor, category, status"
                          sx={{ maxWidth: 420 }}
                        />

                        {filteredExcelSuggestions.length > 0 ? (
                          <Paper
                            className="grid-container"
                            variant="outlined"
                            sx={{
                              maxHeight: 480,
                              overflowX: "auto",
                              overflowY: "auto",
                              position: "relative",
                              borderRadius: 1,
                            }}
                          >
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns: EXCEL_PREVIEW_GRID_TEMPLATE,
                                columnGap: 0,
                                px: 2,
                                py: 1.25,
                                minWidth: EXCEL_PREVIEW_GRID_MIN_WIDTH,
                                bgcolor: (theme) => theme.palette.mode === "dark" ? "#1f2937" : "grey.100",
                                borderBottom: 1,
                                borderColor: (theme) => theme.palette.mode === "dark" ? "#374151" : "divider",
                                position: "sticky",
                                top: 0,
                                zIndex: 30,
                                alignItems: "center",
                              }}
                            >
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Checkbox
                                  size="small"
                                  checked={allVisibleExcelRowsSelected}
                                  indeterminate={!allVisibleExcelRowsSelected && someVisibleExcelRowsSelected}
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    setSelectedExcelRowIds((prev) => {
                                      const pool = new Set(prev);
                                      for (const row of selectableVisibleExcelRows) {
                                        if (checked) {
                                          pool.add(row.id);
                                        } else {
                                          pool.delete(row.id);
                                        }
                                      }
                                      return Array.from(pool);
                                    });
                                  }}
                                  disabled={!selectableVisibleExcelRows.length}
                                />
                              </Box>
                              {EXCEL_DEFAULT_PREVIEW_COLUMNS.map((column) => (
                                <Typography
                                  key={column.key}
                                  variant="subtitle2"
                                  noWrap
                                  sx={{
                                    px: 1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined,
                                    fontWeight: 600,
                                  }}
                                >
                                  {column.label}
                                </Typography>
                              ))}
                              <Typography
                                className="frozen-column"
                                variant="subtitle2"
                                sx={{
                                  position: "sticky",
                                  right: FROZEN_COLUMN_WIDTHS.status + FROZEN_COLUMN_WIDTHS.actions,
                                  zIndex: 5,
                                  bgcolor: (theme) => theme.palette.mode === "dark" ? "#1f2937" : "grey.100",
                                  px: 1,
                                  textAlign: "left",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined,
                                  fontWeight: 600,
                                  borderLeft: 1,
                                  borderColor: (theme) => theme.palette.mode === "dark" ? "#374151" : "divider",
                                }}
                              >
                                Error
                              </Typography>
                              <Typography
                                className="frozen-column"
                                variant="subtitle2"
                                sx={{
                                  position: "sticky",
                                  right: FROZEN_COLUMN_WIDTHS.actions,
                                  zIndex: 6,
                                  bgcolor: (theme) => theme.palette.mode === "dark" ? "#1f2937" : "grey.100",
                                  px: 1,
                                  textAlign: "left",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined,
                                  fontWeight: 600,
                                  borderLeft: 1,
                                  borderColor: (theme) => theme.palette.mode === "dark" ? "#374151" : "divider",
                                }}
                              >
                                Status
                              </Typography>
                              <Typography
                                className="frozen-column"
                                variant="subtitle2"
                                sx={{
                                  position: "sticky",
                                  right: 0,
                                  zIndex: 7,
                                  bgcolor: (theme) => theme.palette.mode === "dark" ? "#1f2937" : "grey.100",
                                  px: 1,
                                  textAlign: "left",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                  color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined,
                                  fontWeight: 600,
                                  borderLeft: 1,
                                  borderColor: (theme) => theme.palette.mode === "dark" ? "#374151" : "divider",
                                }}
                              >
                                Actions
                              </Typography>
                            </Box>

                              {filteredExcelSuggestions.map((item) => {
                                const statusMeta = getExcelRowStatusMeta(item);
                                const blocked = isExcelRowBlocked(item);
                                const isSelected = selectedExcelRowIds.includes(item.id);
                                const rowErrors = getExcelRowErrors(item);
                                const rowHasValidationError = !isExcelRowValid(item);
                                return (
                                  <Box
                                    className={rowHasValidationError ? "error-row" : undefined}
                                    key={item.id}
                                    sx={{
                                      display: "grid",
                                      gridTemplateColumns: EXCEL_PREVIEW_GRID_TEMPLATE,
                                      columnGap: 0,
                                      alignItems: "center",
                                      px: 2,
                                      py: 1.1,
                                      minWidth: EXCEL_PREVIEW_GRID_MIN_WIDTH,
                                      borderBottom: 1,
                                      borderColor: "divider",
                                      bgcolor: "transparent",
                                      "&.error-row .excel-cell-text": {
                                        color: "#ef4444",
                                        fontWeight: 500,
                                      },
                                    }}
                                  >
                                    <Checkbox
                                      size="small"
                                      checked={isSelected}
                                      onChange={() => {
                                        toggleExcelRowSelection(item.id);
                                      }}
                                      disabled={blocked}
                                    />
                                    {EXCEL_DEFAULT_PREVIEW_COLUMNS.map((column) => {
                                      const value = getExcelCellValue(item, column.key);
                                      return (
                                        <Tooltip key={`${item.id}-${column.key}`} title={value || "-"} arrow>
                                          <Typography className="excel-cell-text" variant="body2" noWrap sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", px: 1 }}>
                                            {value || "-"}
                                          </Typography>
                                        </Tooltip>
                                      );
                                    })}
                                    <Tooltip title={rowErrors.length ? rowErrors.join("; ") : "-"} arrow>
                                      <Typography
                                        className="excel-cell-text frozen-column"
                                        variant="body2"
                                        noWrap
                                        sx={{
                                          overflow: "hidden",
                                          textOverflow: "ellipsis",
                                          whiteSpace: "nowrap",
                                          color: rowErrors.length ? "error.main" : "text.secondary",
                                          fontWeight: rowErrors.length ? 500 : 400,
                                          position: "sticky",
                                          right: FROZEN_COLUMN_WIDTHS.status + FROZEN_COLUMN_WIDTHS.actions,
                                          zIndex: 5,
                                          bgcolor: "background.paper",
                                          px: 1,
                                          borderLeft: 1,
                                          borderColor: (theme) => theme.palette.mode === "dark" ? "#374151" : "divider",
                                        }}
                                      >
                                        {rowErrors.length ? rowErrors.join(", ") : "-"}
                                      </Typography>
                                    </Tooltip>
                                    <Typography
                                      className="excel-cell-text frozen-column"
                                      variant="body2"
                                      sx={{
                                        color: statusMeta.color,
                                        fontWeight: 600,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                        position: "sticky",
                                        right: FROZEN_COLUMN_WIDTHS.actions,
                                        zIndex: 6,
                                        bgcolor: "background.paper",
                                        px: 1,
                                        borderLeft: 1,
                                        borderColor: (theme) => theme.palette.mode === "dark" ? "#374151" : "divider",
                                      }}
                                    >
                                      {statusMeta.label}
                                    </Typography>
                                    <Stack
                                      className="frozen-column"
                                      direction="row"
                                      spacing={0.25}
                                      sx={{
                                        position: "sticky",
                                        right: 0,
                                        zIndex: 7,
                                        bgcolor: "background.paper",
                                        px: 1,
                                        borderLeft: 1,
                                        borderColor: (theme) => theme.palette.mode === "dark" ? "#374151" : "divider",
                                      }}
                                    >
                                      <Tooltip title="Open edit form" arrow>
                                        <span>
                                          <IconButton
                                            size="small"
                                            color="primary"
                                            onClick={() => {
                                              void handleOpenExcelEdit(item);
                                            }}
                                            disabled={item.already_added}
                                            sx={{
                                              p: 1,
                                              transition: "transform 0.2s ease",
                                              "&:hover": {
                                                transform: "scale(1.08)",
                                              },
                                            }}
                                          >
                                            <EditOutlinedIcon fontSize="small" />
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                      <Tooltip title="Add asset" arrow>
                                        <span>
                                          <IconButton
                                            size="small"
                                            color="primary"
                                            onClick={() => {
                                              void handleAddExcelRowDirect(item);
                                            }}
                                            disabled={item.already_added || isExcelRowAddItemLoading(item.id)}
                                            sx={{
                                              p: 1,
                                              transition: "transform 0.2s ease",
                                              "&:hover": {
                                                transform: "scale(1.08)",
                                              },
                                            }}
                                          >
                                            {isExcelRowAddItemLoading(item.id) ? <CircularProgress size={16} /> : <AddIcon fontSize="small" />}
                                          </IconButton>
                                        </span>
                                      </Tooltip>
                                    </Stack>
                                  </Box>
                                );
                              })}
                          </Paper>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No rows matched your search.
                          </Typography>
                        )}
                      </Stack>
                    </Paper>
                  ) : null}
                </Stack>
              ) : null}

              {selectedMethod === "invoice_upload" ? (
                <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack spacing={1.5}>
                    <Typography variant="h6">Invoice Upload</Typography>
                    <Alert severity="info">
                      Upload invoice flow is enabled via attachment parsing when saving mailbox suggestions. Direct standalone invoice upload support is prepared for the next step.
                    </Alert>
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

              {isManualSelectionActive ? (
                <AssetPreviewModal
                  open
                  inlineMode
                  showTitle={false}
                  suggestion={selectedSuggestion}
                  parsingMessage={parsingMessage}
                  saveLoading={saveLoading}
                  uploadedDocuments={uploadedDocuments}
                  uploadedDocumentsLoading={documentsLoading}
                  isDocumentActionLoading={isDocumentActionLoading}
                  onViewUploadedDocument={(document) => {
                    handleViewUploadedDocument(document);
                  }}
                  onDeleteUploadedDocument={(documentId) => {
                    void handleDeleteUploadedDocument(documentId);
                  }}
                  collapseDocumentViewer
                  onClose={() => {
                    if (saveLoading) {
                      return;
                    }
                    handleStartManualEntry();
                  }}
                  onSave={handleSaveAsset}
                />
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
        open={Boolean(selectedSuggestion) && String(selectedSuggestion?.source || "").toLowerCase() !== "manual"}
        suggestion={selectedSuggestion}
        isSuggestionMode={selectedMethod === "email_sync"}
        disableAttachmentAndEmailPreview={String(selectedSuggestion?.source || "").toLowerCase() === "excel"}
        parsingMessage={parsingMessage}
        saveLoading={saveLoading}
        uploadedDocuments={uploadedDocuments}
        uploadedDocumentsLoading={documentsLoading}
        isDocumentActionLoading={isDocumentActionLoading}
        onViewUploadedDocument={(document) => {
          handleViewUploadedDocument(document);
        }}
        onDeleteUploadedDocument={(documentId) => {
          void handleDeleteUploadedDocument(documentId);
        }}
        collapseDocumentViewer={String(selectedSuggestion?.source || "").toLowerCase() === "manual"}
        onClose={() => {
          if (saveLoading) {
            return;
          }
          setSelectedSuggestion(null);
          setExcelRowEditId(null);
          setSelectedAssetId(null);
          setUploadedDocuments([]);
          setReminderPromptOpen(false);
          setDeferNextSuggestionPrompt(false);
          setLastReminderCount(0);
          setNextSuggestionPromptOpen(false);
          setParsingMessage("");
        }}
        onSave={handleExcelModalSave}
      />

      <Dialog open={addAllConfirmOpen} onClose={() => setAddAllConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Confirm Bulk Add</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Are you sure you want to add the {selectedExcelRowIds.length} selected asset{selectedExcelRowIds.length === 1 ? "" : "s"}? Only valid rows will be added.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddAllConfirmOpen(false)} disabled={excelBulkAddLoading}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleConfirmAddAllAssets()} disabled={excelBulkAddLoading}>
            {excelBulkAddLoading ? "Adding..." : "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reminderPromptOpen} onClose={() => undefined} fullWidth maxWidth="xs">
        <DialogTitle>Set Reminder Alerts?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {lastReminderCount} reminder{lastReminderCount === 1 ? " has" : "s have"} been prepared for this asset lifecycle. Open reminders now to review or edit them?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setReminderPromptOpen(false);
              setLastReminderCount(0);
              if (deferNextSuggestionPrompt) {
                setNextSuggestionPromptOpen(true);
              }
              setDeferNextSuggestionPrompt(false);
            }}
          >
            Later
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              setReminderPromptOpen(false);
              setDeferNextSuggestionPrompt(false);
              setLastReminderCount(0);
              navigate("/reminders");
            }}
          >
            Open Reminders
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={nextSuggestionPromptOpen} onClose={() => undefined} fullWidth maxWidth="xs">
        <DialogTitle>Asset added successfully</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Would you like to view the next asset suggestion?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFinishAssetFlow} disabled={nextSuggestionLoading}>No</Button>
          <Button variant="contained" onClick={() => void handleViewNextSuggestion()} disabled={nextSuggestionLoading}>
            {nextSuggestionLoading ? "Loading..." : "Yes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={manualAddAnotherPromptOpen} onClose={() => undefined} fullWidth maxWidth="xs">
        <DialogTitle>Asset added successfully</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Do you want to add another asset?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleManualFinish}>No</Button>
          <Button variant="contained" onClick={handleManualAddAnother}>
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AddAsset;
