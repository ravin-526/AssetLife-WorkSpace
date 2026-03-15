import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
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

type ScanSummary = {
  emailsScanned: number;
  invoiceEmails: number;
  assetsDetected: number;
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
  const [excelPage, setExcelPage] = useState(1);
  const excelPageSize = 8;
  const [manualAddAnotherPromptOpen, setManualAddAnotherPromptOpen] = useState(false);

  useAutoDismissMessage(message, setMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 4000 });

  const setActionLoading = (action: string, isLoading: boolean) => {
    setLoadingActions((prev) => ({ ...prev, [action]: isLoading }));
  };

  const buildManualSuggestion = (): AssetSuggestion => {
    const now = new Date().toISOString();
    const seed = `manual-${Date.now()}`;
    return {
      id: seed,
      product_name: "",
      quantity: 1,
      source: "manual",
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
    const method = params.get("method");
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
          return buildManualSuggestion();
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
    setExcelPage(1);
  }, [excelSearch, selectedMethod]);

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

      const response = await syncMailboxEmails(effectiveScanDays, 200, subjectKeywords, senderEmails);

      window.clearInterval(stepTimer);
      setActivityStepStates(SYNC_ACTIVITY_STEPS.map(() => "completed"));

      const emailsScanned = response.emails_scanned ?? response.scanned;
      const invoiceEmails = response.invoice_emails ?? response.purchase_emails_detected;
      const assetsDetected = response.assets_detected ?? response.created_suggestions;

      setScanSummary({ emailsScanned, invoiceEmails, assetsDetected });

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
    const isExcelSuggestion = sourceType === "excel";
    const isManualSuggestion = sourceType === "manual";

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
        source: isManualSuggestion ? "manual" : isExcelSuggestion ? "excel" : "gmail",
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

  const handlePrepareExcelSave = async (suggestion: AssetSuggestion) => {
    setError("");
    setParsingMessage("");
    setSelectedAssetId(null);
    setUploadedDocuments([]);
    setSelectedSuggestion(suggestion);
  };

  const handleExportExcelSuggestions = () => {
    const rows = (excelUploadResult?.suggestions || []).filter((item) => {
      const query = excelSearch.trim().toLowerCase();
      if (!query) {
        return true;
      }
      return [
        item.product_name,
        item.vendor,
        item.brand,
        item.category,
        item.subcategory,
        item.status,
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(query));
    });

    const header = ["Product Name", "Vendor", "Price", "Purchase Date", "Category", "Subcategory", "Status"];
    const data = rows.map((item) => [
      item.product_name || "",
      item.vendor || "",
      item.price ?? "",
      item.purchase_date || "",
      item.category || "",
      item.subcategory || "",
      item.already_added ? "Added" : item.status || "New",
    ]);

    const csv = [header, ...data]
      .map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    openBlobForDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), "excel_asset_preview.csv");
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
      setExcelPage(1);
      setSuggestions([]);
      setSelectedSuggestion(null);
      setMessage(`Excel parsed successfully. ${response.parsed_rows} row(s) ready.`);
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
      ]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [excelSearch, excelUploadResult?.suggestions]);

  const excelPageCount = Math.max(1, Math.ceil(filteredExcelSuggestions.length / excelPageSize));

  useEffect(() => {
    if (excelPage > excelPageCount) {
      setExcelPage(excelPageCount);
    }
  }, [excelPage, excelPageCount]);

  const pagedExcelSuggestions = useMemo(() => {
    const startIndex = (excelPage - 1) * excelPageSize;
    return filteredExcelSuggestions.slice(startIndex, startIndex + excelPageSize);
  }, [excelPage, filteredExcelSuggestions]);

  const standardControlHeight = 36;
  const standardFieldSx = {
    "& .MuiInputBase-root": {
      height: standardControlHeight,
    },
  };

  const handleStartManualEntry = () => {
    setError("");
    setMessage("");
    setSelectedAssetId(null);
    setUploadedDocuments([]);
    setParsingMessage("");
    setSelectedSuggestion(buildManualSuggestion());
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
    if (method === "manual_entry") {
      handleStartManualEntry();
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
                            <Button
                              variant="contained"
                              onClick={handleRunMailboxSync}
                              disabled={isActionLoading("syncMailbox") || !mailboxConnected || isActionLoading("loadSuggestions")}
                              sx={{ height: standardControlHeight, minWidth: 180 }}
                            >
                              Sync Mail
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
                        <Paper variant="outlined" sx={{ height: 420, overflowY: "auto", overflowX: "auto" }}>
                          <Box sx={{ minWidth: 920 }}>
                            <Box
                              sx={{
                                display: "grid",
                                gridTemplateColumns: "2fr 1.4fr 1fr 1.2fr 1.2fr 1.2fr",
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

                            {suggestions.map((suggestion) => {
                              const isSkipped = String(suggestion.status || "").toLowerCase() === "rejected";
                              const skipActionKey = `skip-${suggestion.id}`;
                              const skipLoading = isActionLoading(skipActionKey);

                              return (
                                <Box
                                  key={suggestion.id}
                                  sx={{
                                    display: "grid",
                                    gridTemplateColumns: "2fr 1.4fr 1fr 1.2fr 1.2fr 1.2fr",
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
                                  <Chip
                                    size="small"
                                    label={suggestion.already_added ? "Added" : isSkipped ? "Skipped" : "New"}
                                    color={suggestion.already_added ? "success" : isSkipped ? "default" : "primary"}
                                    variant={suggestion.already_added || isSkipped ? "filled" : "outlined"}
                                  />
                                  <Stack direction="row" spacing={1}>
                                    <Button
                                      variant="outlined"
                                      onClick={() => {
                                        void handlePrepareSave(suggestion);
                                      }}
                                      disabled={suggestion.already_added || isSkipped || parsingSuggestionId === suggestion.id}
                                      sx={{
                                        height: standardControlHeight,
                                        minWidth: 82,
                                        px: 1.25,
                                        fontSize: "0.875rem",
                                      }}
                                    >
                                      {suggestion.already_added ? "Added" : parsingSuggestionId === suggestion.id ? "Parsing..." : "Add"}
                                    </Button>
                                    <Button
                                      variant="text"
                                      color="warning"
                                      onClick={() => {
                                        void handleSkipSuggestion(suggestion);
                                      }}
                                      disabled={suggestion.already_added || isSkipped || skipLoading}
                                      sx={{
                                        height: standardControlHeight,
                                        minWidth: 72,
                                        px: 1,
                                        fontSize: "0.85rem",
                                      }}
                                    >
                                      {skipLoading ? "Skipping..." : "Skip"}
                                    </Button>
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
                          <Chip label={`Total Rows: ${excelUploadResult.total_rows}`} size="small" variant="outlined" />
                          <Chip label={`Parsed: ${excelUploadResult.parsed_rows}`} size="small" color="primary" variant="outlined" />
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
                          <Stack direction="row" spacing={1}>
                            <Button
                              variant="outlined"
                              onClick={handleExportExcelSuggestions}
                              disabled={!excelUploadResult.suggestions.length}
                              sx={{ height: standardControlHeight }}
                            >
                              Export CSV
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
                          <>
                            <Paper variant="outlined" sx={{ maxHeight: 420, overflowY: "auto", overflowX: "auto" }}>
                              <Box sx={{ minWidth: 980 }}>
                                <Box
                                  sx={{
                                    display: "grid",
                                    gridTemplateColumns: "2fr 1.4fr 1fr 1.2fr 1fr 1fr 1.1fr",
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
                                  <Typography variant="subtitle2">Category</Typography>
                                  <Typography variant="subtitle2">Status</Typography>
                                  <Typography variant="subtitle2">Action</Typography>
                                </Box>

                                {pagedExcelSuggestions.map((item) => {
                                  const blocked = item.already_added || String(item.status || "").toLowerCase() === "duplicate";
                                  return (
                                    <Box
                                      key={item.id}
                                      sx={{
                                        display: "grid",
                                        gridTemplateColumns: "2fr 1.4fr 1fr 1.2fr 1fr 1fr 1.1fr",
                                        columnGap: 2,
                                        alignItems: "center",
                                        px: 2,
                                        py: 1.1,
                                        borderBottom: 1,
                                        borderColor: "divider",
                                      }}
                                    >
                                      <Typography variant="body2">{item.product_name || "-"}</Typography>
                                      <Typography variant="body2">{item.vendor || "-"}</Typography>
                                      <Typography variant="body2">{formatSuggestionPrice(item.price)}</Typography>
                                      <Typography variant="body2">{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString() : "-"}</Typography>
                                      <Typography variant="body2">{item.category || "-"}</Typography>
                                      <Chip
                                        size="small"
                                        label={item.already_added ? "Added" : String(item.status || "").toLowerCase() === "duplicate" ? "Duplicate" : "New"}
                                        color={item.already_added ? "success" : String(item.status || "").toLowerCase() === "duplicate" ? "default" : "primary"}
                                        variant={item.already_added || String(item.status || "").toLowerCase() === "duplicate" ? "filled" : "outlined"}
                                      />
                                      <Button
                                        variant="outlined"
                                        onClick={() => {
                                          void handlePrepareExcelSave(item);
                                        }}
                                        disabled={blocked}
                                        sx={{ height: standardControlHeight, minWidth: 82, px: 1.25 }}
                                      >
                                        {item.already_added ? "Added" : blocked ? "Blocked" : "Add"}
                                      </Button>
                                    </Box>
                                  );
                                })}
                              </Box>
                            </Paper>

                            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                              <Pagination
                                page={excelPage}
                                count={excelPageCount}
                                onChange={(_, page) => setExcelPage(page)}
                                color="primary"
                                size="small"
                              />
                            </Box>
                          </>
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
          setSelectedAssetId(null);
          setUploadedDocuments([]);
          setReminderPromptOpen(false);
          setDeferNextSuggestionPrompt(false);
          setLastReminderCount(0);
          setNextSuggestionPromptOpen(false);
          setParsingMessage("");
        }}
        onSave={handleSaveAsset}
      />

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
