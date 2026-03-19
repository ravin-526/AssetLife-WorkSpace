import { useEffect, useMemo, useRef, useState } from "react";
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
  Divider,
  GlobalStyles,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TablePagination,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useNavigate } from "react-router-dom";

import AssetPreviewModal from "../components/modules/AssetPreviewModal.tsx";
import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import {
  Asset,
  AssetLifecyclePayload,
  AssetSuggestion,
  UploadedAssetDocument,
  connectMailbox,
  createAsset,
  deleteAsset,
  deleteAssetDocument,
  disconnectMailbox,
  fetchAssetDocumentBlob,
  getAssetById,
  getAssetCategories,
  getAssetDocuments,
  getAssetSuggestions,
  getAssets,
  getMailboxStatus,
  parseSuggestionAttachment,
  resetUserTestData,
  syncMailboxEmails,
  updateAsset,
  uploadAssetDocuments,
} from "../services/gmail.ts";

const Assets = () => {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [suggestions, setSuggestions] = useState<AssetSuggestion[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<AssetSuggestion | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [parsingSuggestionId, setParsingSuggestionId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [mailboxConnected, setMailboxConnected] = useState(false);
  const [mailboxEmail, setMailboxEmail] = useState("");
  const [scanDays, setScanDays] = useState(10);
  const [useCustomScanRange, setUseCustomScanRange] = useState(false);
  const [scanFromDate, setScanFromDate] = useState("");
  const [scanToDate, setScanToDate] = useState("");
  const [subjectKeywordsInput, setSubjectKeywordsInput] = useState("invoice, receipt");
  const [senderEmailsInput, setSenderEmailsInput] = useState("");
  const [parsingMessage, setParsingMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [warrantyFilter, setWarrantyFilter] = useState("");
  const [purchaseDateFilter, setPurchaseDateFilter] = useState("");
  const [purchaseDateFrom, setPurchaseDateFrom] = useState("");
  const [purchaseDateTo, setPurchaseDateTo] = useState("");
  const [insuranceDateFilter, setInsuranceDateFilter] = useState("");
  const [serviceDateFilter, setServiceDateFilter] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const [exporting, setExporting] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "card">("grid");
  const [viewAssetDialogOpen, setViewAssetDialogOpen] = useState(false);
  const [selectedAssetDetails, setSelectedAssetDetails] = useState<Asset | null>(null);
  const [assetDetailsLoading, setAssetDetailsLoading] = useState(false);
  const [assetDocuments, setAssetDocuments] = useState<UploadedAssetDocument[]>([]);
  const [assetDocumentsLoading, setAssetDocumentsLoading] = useState(false);
  const [assetDocumentActionLoading, setAssetDocumentActionLoading] = useState<Record<string, boolean>>({});
  const [assetPreviewEditOpen, setAssetPreviewEditOpen] = useState(false);
  const [assetPreviewEditSuggestion, setAssetPreviewEditSuggestion] = useState<AssetSuggestion | null>(null);
  const [assetPreviewEditDocuments, setAssetPreviewEditDocuments] = useState<UploadedAssetDocument[]>([]);
  const [assetPreviewEditDocumentsLoading, setAssetPreviewEditDocumentsLoading] = useState(false);
  const [assetPreviewEditSaveLoading, setAssetPreviewEditSaveLoading] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const assetDetailsPrintRef = useRef<HTMLDivElement | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    brand: "",
    vendor: "",
    price: "",
    purchase_date: "",
    category: "",
    subcategory: "",
    customCategory: "",
    customSubcategory: "",
  });
  const [assetCategories, setAssetCategories] = useState<{ category: string; subcategories: string[] }[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingAsset, setDeletingAsset] = useState<Asset | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [emailPromptOpen, setEmailPromptOpen] = useState(false);
  const [mailboxEmailInput, setMailboxEmailInput] = useState("");
  const [mailboxEmailInputError, setMailboxEmailInputError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useAutoDismissMessage(message, setMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 5000 });

  const setActionLoading = (action: string, isLoading: boolean) => {
    setLoadingActions((prev) => ({ ...prev, [action]: isLoading }));
  };

  const isActionLoading = (action: string) => Boolean(loadingActions[action]);

  const isAnyPopupLoading =
    Boolean(parsingSuggestionId) ||
    saveLoading ||
    isActionLoading("connectMailbox") ||
    isActionLoading("disconnectMailbox") ||
    isActionLoading("syncMailbox") ||
    isActionLoading("loadSuggestions");

  const loadAssets = async () => {
    const response = await getAssets();
    setAssets(response);
  };

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
    setMailboxEmail(status.email_address ?? "");
  };

  const loadAssetCategories = async () => {
    const response = await getAssetCategories();
    setAssetCategories(response);
  };

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        setError("");
        await Promise.all([loadAssets(), loadSuggestions(), loadMailboxStatus(), loadAssetCategories()]);
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : "Failed to fetch assets");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wizard = params.get("wizard");

    if (wizard === "gmail") {
      navigate("/assets/add?method=email_sync", { replace: true });
    }
  }, [navigate]);

  const parseCsvInput = (value: string): string[] => {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  };

  const isValidEmail = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

  const parseUnknownObject = (value: unknown): Record<string, unknown> | null => {
    if (!value) {
      return null;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
        return null;
      } catch {
        return null;
      }
    }

    if (typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  };

  const buildSuggestionFromAsset = (asset: Asset): AssetSuggestion => {
    const warrantyDetails = parseUnknownObject((asset as Asset & { warranty?: unknown }).warranty);
    const insuranceDetails = parseUnknownObject((asset as Asset & { insurance?: unknown }).insurance);
    const serviceDetails = parseUnknownObject((asset as Asset & { service?: unknown }).service);

    return {
      id: asset.id,
      product_name: asset.name || "",
      brand: asset.brand || undefined,
      vendor: asset.vendor || undefined,
      price: asset.price ?? undefined,
      purchase_date: asset.purchase_date || undefined,
      quantity: 1,
      source: asset.source || "manual",
      status: "pending",
      asset_status: String((asset as Asset & { status?: string }).status || "active"),
      email_message_id: asset.source_email_id || asset.id,
      already_added: false,
      category: asset.category || undefined,
      subcategory: asset.subcategory || undefined,
      serial_number: asset.serial_number || undefined,
      model_number: asset.model_number || undefined,
      invoice_number: asset.invoice_number || undefined,
      description: asset.description || undefined,
      notes: asset.notes || undefined,
      location: asset.location || undefined,
      assigned_user: asset.assigned_user || undefined,
      warranty_details: warrantyDetails,
      insurance_details: insuranceDetails,
      service_details: serviceDetails,
      created_at: asset.created_at,
    };
  };

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
      setMessage("Mailbox disconnected successfully.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to disconnect mailbox");
    } finally {
      setActionLoading("disconnectMailbox", false);
    }
  };

  const handleRunMailboxSync = async () => {
    setActionLoading("syncMailbox", true);
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
      await Promise.all([loadSuggestions(), loadAssets()]);
      setMessage(
        `Sync completed. Scanned ${response.scanned} emails and created ${response.created_suggestions} temporary suggestions.`
      );
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to sync mailbox");
    } finally {
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
        category: payload.category ?? "Other",
        subcategory: payload.subcategory ?? "Custom Asset",
        vendor: payload.vendor ?? selectedSuggestion.vendor,
        purchase_date: payload.purchase_date ?? selectedSuggestion.purchase_date,
        price: payload.price ?? selectedSuggestion.price,
        status: payload.status,
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

      setSuggestions((prev) => prev.filter((item) => item.id !== selectedSuggestion.id));
      setSelectedSuggestion(null);
      setParsingMessage("");
      await loadAssets();
      const reminderCount = Number(createdAsset.auto_reminders_created || 0);
      if (reminderCount > 0) {
        setMessage(`Suggestion added. Asset saved successfully with ${reminderCount} reminder${reminderCount === 1 ? "" : "s"}.`);
      } else {
        setMessage("Suggestion added. Asset saved successfully.");
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save asset");
    } finally {
      setSaveLoading(false);
    }
  };

  const handleOpenAssetDetails = async (assetId: string) => {
    try {
      setError("");
      setAssetDetailsLoading(true);
      setAssetDocumentsLoading(true);
      setViewAssetDialogOpen(true);

      const [assetDetails, documents] = await Promise.all([
        getAssetById(assetId),
        getAssetDocuments(assetId),
      ]);

      setSelectedAssetDetails(assetDetails);
      setAssetDocuments(documents);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load asset details");
      setViewAssetDialogOpen(false);
    } finally {
      setAssetDetailsLoading(false);
      setAssetDocumentsLoading(false);
    }
  };

  const withAssetDocumentActionLoading = (key: string, isLoading: boolean) => {
    setAssetDocumentActionLoading((prev) => ({ ...prev, [key]: isLoading }));
  };

  const isAssetDocumentActionLoading = (key: string) => Boolean(assetDocumentActionLoading[key]);

  const handleViewAssetDocument = async (document: UploadedAssetDocument, assetIdOverride?: string) => {
    const assetId = assetIdOverride || selectedAssetDetails?.id;
    if (!assetId) {
      return;
    }

    const actionKey = `view-${document.document_id}`;
    try {
      withAssetDocumentActionLoading(actionKey, true);
      setError("");
      const blob = await fetchAssetDocumentBlob(assetId, document.document_id);
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to open document");
    } finally {
      withAssetDocumentActionLoading(actionKey, false);
    }
  };

  const handleDownloadAssetDocument = async (document: UploadedAssetDocument, assetIdOverride?: string) => {
    const assetId = assetIdOverride || selectedAssetDetails?.id;
    if (!assetId) {
      return;
    }

    const actionKey = `download-${document.document_id}`;
    try {
      withAssetDocumentActionLoading(actionKey, true);
      setError("");
      const blob = await fetchAssetDocumentBlob(assetId, document.document_id);
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = document.file_name || "document";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to download document");
    } finally {
      withAssetDocumentActionLoading(actionKey, false);
    }
  };

  const handleOpenEdit = async (asset: Asset) => {
    try {
      setActionLoading("openAssetPreviewEdit", true);
      setError("");
      setAssetPreviewEditDocumentsLoading(true);

      const [assetDetails, documents] = await Promise.all([
        getAssetById(asset.id),
        getAssetDocuments(asset.id),
      ]);

      setEditingAsset(assetDetails);
      setEditingAssetId(assetDetails.id);
      setAssetPreviewEditSuggestion(buildSuggestionFromAsset(assetDetails));
      setAssetPreviewEditDocuments(documents);
      setAssetPreviewEditOpen(true);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to open asset editor");
    } finally {
      setAssetPreviewEditDocumentsLoading(false);
      setActionLoading("openAssetPreviewEdit", false);
    }
  };

  const handleCloseAssetDetailsDialog = () => {
    setViewAssetDialogOpen(false);
    setSelectedAssetDetails(null);
    setAssetDocuments([]);
  };

  const handleCloseAssetPreviewEditDialog = () => {
    setAssetPreviewEditOpen(false);
    setAssetPreviewEditSuggestion(null);
    setAssetPreviewEditDocuments([]);
    setAssetPreviewEditDocumentsLoading(false);
    setEditingAsset(null);
    setEditingAssetId(null);
  };

  const handleSaveAssetPreviewEdit = async (payload: {
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
    if (!editingAssetId) {
      return;
    }

    try {
      setAssetPreviewEditSaveLoading(true);
      setError("");

      await updateAsset(editingAssetId, {
        name: payload.product_name?.trim() || undefined,
        brand: payload.brand?.trim() || undefined,
        vendor: payload.vendor?.trim() || undefined,
        price: payload.price,
        status: payload.status?.trim() || undefined,
        purchase_date: payload.purchase_date || undefined,
        category: payload.category?.trim() || undefined,
        subcategory: payload.subcategory?.trim() || undefined,
        serial_number: payload.serial_number?.trim() || undefined,
        model_number: payload.model_number?.trim() || undefined,
        invoice_number: payload.invoice_number?.trim() || undefined,
        description: payload.description?.trim() || undefined,
        notes: payload.notes?.trim() || undefined,
        location: payload.location?.trim() || undefined,
        assigned_user: payload.assigned_user?.trim() || undefined,
        lifecycle_info: payload.lifecycle_info,
      });

      if (payload.supporting_documents?.length) {
        await uploadAssetDocuments(editingAssetId, payload.supporting_documents);
      }

      await loadAssets();
      setMessage("Asset updated successfully.");
      handleCloseAssetPreviewEditDialog();
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update asset");
    } finally {
      setAssetPreviewEditSaveLoading(false);
    }
  };

  const handleDeleteAssetPreviewDocument = async (documentId: string) => {
    if (!editingAssetId) {
      return;
    }

    try {
      await deleteAssetDocument(editingAssetId, documentId);
      setAssetPreviewEditDocuments((prev) => prev.filter((item) => item.document_id !== documentId));
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete document");
      throw requestError;
    }
  };

  const handleEditFromAssetDetails = () => {
    if (!selectedAssetDetails) {
      return;
    }

    handleCloseAssetDetailsDialog();
    void handleOpenEdit(selectedAssetDetails);
  };

  const handlePrintAssetDetails = () => {
    if (!selectedAssetDetails || !assetDetailsPrintRef.current || assetDetailsLoading || assetDocumentsLoading) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  };

  const getAssetStatusLabel = (asset: Asset) => {
    const value = String((asset as Asset & { status?: string }).status || "").trim();
    if (!value) {
      return "Active";
    }
    return value
      .replaceAll("_", " ")
      .split(" ")
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join(" ");
  };

  const getStatusChipColor = (label: string): "success" | "warning" | "default" | "error" => {
    const normalized = label.toLowerCase();
    if (normalized === "active") {
      return "success";
    }
    if (normalized === "in warranty") {
      return "success";
    }
    if (normalized === "in repair") {
      return "warning";
    }
    if (normalized === "expiring soon" || normalized === "due soon") {
      return "warning";
    }
    if (normalized === "disposed") {
      return "error";
    }
    if (normalized === "lost" || normalized === "damaged" || normalized === "expired" || normalized === "overdue") {
      return "error";
    }
    return "default";
  };

  const getAssetComputedStatusLabel = (asset: Asset) => {
    const explicitStatus = getAssetStatusLabel(asset);
    if (explicitStatus.toLowerCase() !== "active") {
      return explicitStatus;
    }

    const warrantyMeta = getWarrantyPresentation(asset).metaText.toLowerCase();
    if (warrantyMeta === "expired") {
      return "Expired";
    }
    if (warrantyMeta === "expiring soon") {
      return "Expiring Soon";
    }
    if (warrantyMeta === "valid") {
      return "In Warranty";
    }
    return "Active";
  };

  const getWarrantyExpiryDate = (asset: Asset): Date | null => {
    // Try to get warranty data safely
    const warrantyData = (asset as Asset & { warranty?: unknown }).warranty;
    
    if (!warrantyData) {
      return null;
    }

    let warrantyObj: Record<string, unknown> | null = null;
    
    // If warranty is a string, try to parse as JSON
    if (typeof warrantyData === "string") {
      try {
        warrantyObj = JSON.parse(warrantyData);
      } catch {
        return null;
      }
    } else if (typeof warrantyData === "object" && warrantyData !== null) {
      warrantyObj = warrantyData as Record<string, unknown>;
    }

    if (!warrantyObj) {
      return null;
    }

    // Check if warranty is available
    const available = warrantyObj.available === true || warrantyObj.available === "true";
    if (!available) {
      return null;
    }

    // Try to get end_date or endDate
    const endDateValue = (warrantyObj.end_date ?? warrantyObj.endDate) as string | undefined;
    if (!endDateValue) {
      return null;
    }

    const parsed = new Date(endDateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getInsuranceExpiryDate = (asset: Asset): Date | null => {
    // Try to get insurance data safely
    const insuranceData = (asset as Asset & { insurance?: unknown }).insurance;
    
    if (!insuranceData) {
      return null;
    }

    let insuranceObj: Record<string, unknown> | null = null;
    
    // If insurance is a string, try to parse as JSON
    if (typeof insuranceData === "string") {
      try {
        insuranceObj = JSON.parse(insuranceData);
      } catch {
        return null;
      }
    } else if (typeof insuranceData === "object" && insuranceData !== null) {
      insuranceObj = insuranceData as Record<string, unknown>;
    }

    if (!insuranceObj) {
      return null;
    }

    // Check if insurance is available
    const available = insuranceObj.available === true || insuranceObj.available === "true";
    if (!available) {
      return null;
    }

    // Try to get end_date, endDate, expiry_date, or expiryDate
    const endDateValue = (insuranceObj.end_date ?? insuranceObj.endDate ?? insuranceObj.expiry_date ?? insuranceObj.expiryDate) as string | undefined;
    if (!endDateValue) {
      return null;
    }

    const parsed = new Date(endDateValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const getServiceNextDate = (asset: Asset): Date | null => {
    // Try to get service data safely
    const serviceData = (asset as Asset & { service?: unknown }).service;
    
    if (!serviceData) {
      return null;
    }

    let serviceObj: Record<string, unknown> | null = null;
    
    // If service is a string, try to parse as JSON
    if (typeof serviceData === "string") {
      try {
        serviceObj = JSON.parse(serviceData);
      } catch {
        return null;
      }
    } else if (typeof serviceData === "object" && serviceData !== null) {
      serviceObj = serviceData as Record<string, unknown>;
    }

    if (!serviceObj) {
      return null;
    }

    // Check if service is available/required
    const available = serviceObj.available === true || serviceObj.available === "true" || 
                      serviceObj.required === true || serviceObj.required === "true";
    if (!available) {
      return null;
    }

    // Try to get next_service_date or nextServiceDate
    const nextServiceDateValue = (serviceObj.next_service_date ?? serviceObj.nextServiceDate) as string | undefined;
    if (nextServiceDateValue) {
      const parsed = new Date(nextServiceDateValue);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    // Fallback for legacy records: compute from frequency / custom_interval_days
    let intervalDays = Number(serviceObj.custom_interval_days) || 0;
    if (intervalDays <= 0) {
      const frequency = String(serviceObj.frequency || "monthly");
      const freqMap: Record<string, number> = { monthly: 30, quarterly: 90, half_yearly: 180, yearly: 365 };
      intervalDays = freqMap[frequency] ?? 30;
    }
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);
    return nextDate;
  };


  const getWarrantyPresentation = (asset: Asset) => {
    const expiry = getWarrantyExpiryDate(asset);
    if (!expiry) {
      return {
        dateText: "-",
        metaText: "No warranty data",
        metaColor: "text.secondary" as const,
        tooltip: "Warranty information is unavailable",
      };
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expiryStart = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const diffDays = Math.ceil((expiryStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const elapsed = Math.abs(diffDays);
      return {
        dateText: expiry.toLocaleDateString(),
        metaText: "Expired",
        metaColor: "error.main" as const,
        tooltip: `Warranty expired ${elapsed} day${elapsed === 1 ? "" : "s"} ago`,
      };
    }

    if (diffDays <= 30) {
      return {
        dateText: expiry.toLocaleDateString(),
        metaText: "Expiring Soon",
        metaColor: "warning.main" as const,
        tooltip: `Warranty expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      };
    }

    return {
      dateText: expiry.toLocaleDateString(),
      metaText: "Valid",
      metaColor: "text.secondary" as const,
      tooltip: `Warranty expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
    };
  };

  const getInsurancePresentation = (asset: Asset) => {
    const expiry = getInsuranceExpiryDate(asset);
    if (!expiry) {
      return {
        dateText: "-",
        metaText: "No insurance data",
        metaColor: "text.secondary" as const,
        tooltip: "Insurance information is unavailable",
      };
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const expiryStart = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const diffDays = Math.ceil((expiryStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const elapsed = Math.abs(diffDays);
      return {
        dateText: expiry.toLocaleDateString(),
        metaText: "Expired",
        metaColor: "error.main" as const,
        tooltip: `Insurance expired ${elapsed} day${elapsed === 1 ? "" : "s"} ago`,
      };
    }

    if (diffDays <= 45) {
      return {
        dateText: expiry.toLocaleDateString(),
        metaText: "Expiring Soon",
        metaColor: "warning.main" as const,
        tooltip: `Insurance expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      };
    }

    return {
      dateText: expiry.toLocaleDateString(),
      metaText: "Valid",
      metaColor: "text.secondary" as const,
      tooltip: `Insurance expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
    };
  };

  const getServicePresentation = (asset: Asset) => {
    const nextDate = getServiceNextDate(asset);
    if (!nextDate) {
      return {
        dateText: "-",
        metaText: "No service data",
        metaColor: "text.secondary" as const,
        tooltip: "Service information is unavailable",
      };
    }

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const nextStart = new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate());
    const diffDays = Math.ceil((nextStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const elapsed = Math.abs(diffDays);
      return {
        dateText: nextDate.toLocaleDateString(),
        metaText: "Overdue",
        metaColor: "error.main" as const,
        tooltip: `Service is overdue by ${elapsed} day${elapsed === 1 ? "" : "s"}`,
      };
    }

    if (diffDays <= 30) {
      return {
        dateText: nextDate.toLocaleDateString(),
        metaText: "Due Soon",
        metaColor: "warning.main" as const,
        tooltip: `Service due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      };
    }

    return {
      dateText: nextDate.toLocaleDateString(),
      metaText: "Scheduled",
      metaColor: "text.secondary" as const,
      tooltip: `Service scheduled in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
    };
  };

  const handleSaveEdit = async () => {
    if (!editingAsset) {
      return;
    }

    try {
      setEditSaving(true);
      setError("");
      const selectedCategory = editForm.category.trim();
      const selectedSubcategory = editForm.subcategory.trim();
      const resolvedCategory = selectedCategory.toLowerCase() === "other"
        ? editForm.customCategory.trim()
        : selectedCategory;
      const resolvedSubcategory = selectedSubcategory.toLowerCase() === "other"
        ? editForm.customSubcategory.trim()
        : selectedSubcategory;

      if (selectedCategory.toLowerCase() === "other" && !resolvedCategory) {
        throw new Error("Please enter a custom category");
      }

      if (selectedSubcategory.toLowerCase() === "other" && !resolvedSubcategory) {
        throw new Error("Please enter a custom subcategory");
      }

      const payload = {
        name: editForm.name.trim() || undefined,
        brand: editForm.brand.trim() || undefined,
        vendor: editForm.vendor.trim() || undefined,
        price: editForm.price ? Number(editForm.price) : undefined,
        purchase_date: editForm.purchase_date || undefined,
        category: resolvedCategory || undefined,
        subcategory: resolvedSubcategory || undefined,
      };
      await updateAsset(editingAsset.id, payload);
      await loadAssets();
      setMessage("Asset updated successfully.");
      setEditDialogOpen(false);
      setEditingAsset(null);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update asset");
    } finally {
      setEditSaving(false);
    }
  };

  const handleOpenDelete = (asset: Asset) => {
    setDeletingAsset(asset);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingAsset) {
      return;
    }

    try {
      setDeleteLoading(true);
      setError("");
      await deleteAsset(deletingAsset.id);
      await loadAssets();
      setMessage("Asset deleted successfully.");
      setDeleteDialogOpen(false);
      setDeletingAsset(null);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete asset");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmResetTestData = async () => {
    setActionLoading("resetTestData", true);
    try {
      setError("");
      await resetUserTestData();
      setResetDialogOpen(false);
      setSelectedSuggestion(null);
      setParsingMessage("");
      await Promise.all([loadAssets(), loadSuggestions()]);
      setMessage("All assets and related testing data have been removed successfully.");
    } catch {
      setError("Failed to reset test data. Please try again.");
    } finally {
      setActionLoading("resetTestData", false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim().toLowerCase());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredAssets = useMemo(() => {
    // Normalize a Date to local-midnight so comparisons are day-accurate
    // regardless of whether the source was parsed as UTC or local time.
    const toMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    // Parse a YYYY-MM-DD string as local midnight (avoids UTC-offset day shift).
    const parseYMD = (s: string) => { const [y, mo, d] = s.split("-").map(Number); return new Date(y, mo - 1, d); };

    const todayMidnight = toMidnight(new Date());
    const soonThreshold = new Date(todayMidnight);
    soonThreshold.setDate(soonThreshold.getDate() + 30);
    const last7 = new Date(todayMidnight);
    last7.setDate(last7.getDate() - 7);
    const last30 = new Date(todayMidnight);
    last30.setDate(last30.getDate() - 30);
    const yearStart = new Date(todayMidnight.getFullYear(), 0, 1);
    const fromDate = purchaseDateFrom ? parseYMD(purchaseDateFrom) : null;
    const toDate = purchaseDateTo ? parseYMD(purchaseDateTo) : null;

    return assets.filter((asset) => {
      if (debouncedQuery) {
        const text = [asset.name, asset.brand, asset.vendor, asset.category, asset.subcategory]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        if (!text.includes(debouncedQuery)) return false;
      }

      if (statusFilter) {
        const computedStatus = getAssetComputedStatusLabel(asset).toLowerCase();
        if (computedStatus !== statusFilter.toLowerCase()) return false;
      }

      if (purchaseDateFilter) {
        const rawStr = asset.purchase_date ? String(asset.purchase_date).slice(0, 10) : null;
        const purchaseDate = rawStr ? parseYMD(rawStr) : null;
        if (purchaseDateFilter === "last7" && (!purchaseDate || purchaseDate < last7)) return false;
        if (purchaseDateFilter === "last30" && (!purchaseDate || purchaseDate < last30)) return false;
        if (purchaseDateFilter === "this_year" && (!purchaseDate || purchaseDate < yearStart)) return false;
        if (purchaseDateFilter === "custom") {
          if (fromDate || toDate) {
            if (!purchaseDate) return false;
            if (fromDate && purchaseDate < fromDate) return false;
            if (toDate && purchaseDate > toDate) return false;
          }
        }
      }

      if (warrantyFilter) {
        const wRaw = getWarrantyExpiryDate(asset);
        const wDate = wRaw ? toMidnight(wRaw) : null;
        if (warrantyFilter === "active" && (!wDate || wDate < todayMidnight)) return false;
        if (warrantyFilter === "expired" && (!wDate || wDate >= todayMidnight)) return false;
        if (warrantyFilter === "due_soon" && (!wDate || wDate < todayMidnight || wDate > soonThreshold)) return false;
      }

      if (insuranceDateFilter) {
        const insRaw = getInsuranceExpiryDate(asset);
        const insDate = insRaw ? toMidnight(insRaw) : null;
        if (insuranceDateFilter === "active" && (!insDate || insDate < todayMidnight)) return false;
        if (insuranceDateFilter === "expired" && (!insDate || insDate >= todayMidnight)) return false;
        if (insuranceDateFilter === "due_soon" && (!insDate || insDate < todayMidnight || insDate > soonThreshold)) return false;
      }

      if (serviceDateFilter) {
        const svcRaw = getServiceNextDate(asset);
        const svcDate = svcRaw ? toMidnight(svcRaw) : null;
        if (serviceDateFilter === "scheduled" && (!svcDate || svcDate <= soonThreshold)) return false;
        if (serviceDateFilter === "due_soon" && (!svcDate || svcDate < todayMidnight || svcDate > soonThreshold)) return false;
        if (serviceDateFilter === "overdue" && (!svcDate || svcDate >= todayMidnight)) return false;
      }

      return true;
    });
  }, [assets, debouncedQuery, statusFilter, warrantyFilter, purchaseDateFilter, purchaseDateFrom, purchaseDateTo, insuranceDateFilter, serviceDateFilter]);

  const editCategoryOptions = useMemo(() => {
    const options = assetCategories.map((item) => item.category);
    if (editForm.category && !options.includes(editForm.category)) {
      return [editForm.category, ...options];
    }
    return options;
  }, [assetCategories, editForm.category]);

  const editSubcategoryOptions = useMemo(() => {
    const matched = assetCategories.find((item) => item.category === editForm.category);
    const options = matched?.subcategories ?? [];
    if (editForm.subcategory && !options.includes(editForm.subcategory)) {
      return [editForm.subcategory, ...options];
    }
    return options;
  }, [assetCategories, editForm.category, editForm.subcategory]);

  const statusOptions = useMemo(() => {
    return Array.from(new Set(assets.map((asset) => getAssetComputedStatusLabel(asset).trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const paginatedAssets = filteredAssets.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const formatSuggestionPrice = (price?: number) => {
    if (price === null || price === undefined) {
      return "-";
    }

    // Guard against implausibly large values produced by parsing errors
    if (price > 100_000_000) {
      return "-";
    }

    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(price);
  };

  const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  };

  const parseLifecycleRecord = (value: unknown, label: string): Record<string, unknown> | null => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      try {
        const parsed = JSON.parse(trimmed);
        const parsedRecord = asRecord(parsed);
        if (!parsedRecord) {
          console.error(`Failed to parse ${label}: parsed value is not an object`);
          return null;
        }
        return parsedRecord;
      } catch (parseError) {
        console.error(`Failed to parse ${label}:`, parseError);
        return null;
      }
    }

    return asRecord(value);
  };

  const getRecordValue = (record: Record<string, unknown> | null, keys: string[]): unknown => {
    if (!record) {
      return undefined;
    }

    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(record, key) && record[key] !== undefined && record[key] !== null) {
        return record[key];
      }
    }

    return undefined;
  };

  const toBoolean = (value: unknown): boolean | null => {
    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "yes", "1"].includes(normalized)) {
        return true;
      }
      if (["false", "no", "0"].includes(normalized)) {
        return false;
      }
    }

    if (typeof value === "number") {
      if (value === 1) {
        return true;
      }
      if (value === 0) {
        return false;
      }
    }

    return null;
  };

  const formatBooleanValue = (value: unknown) => {
    const normalized = toBoolean(value);
    if (normalized === null) {
      return "-";
    }
    return normalized ? "Yes" : "No";
  };

  const formatDateValue = (value: unknown) => {
    if (!value) {
      return "-";
    }

    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const formatTextValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return "-";
    }

    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : "-";
    }

    const asString = String(value).trim();
    return asString ? asString : "-";
  };

  const lifecycleDetails = useMemo(() => {
    if (!selectedAssetDetails) {
      return null;
    }

    const warrantyRecord = parseLifecycleRecord(
      (selectedAssetDetails as Asset & { warranty?: unknown }).warranty,
      "asset.warranty"
    );
    const insuranceRecord = parseLifecycleRecord(
      (selectedAssetDetails as Asset & { insurance?: unknown }).insurance,
      "asset.insurance"
    );
    const serviceRecord = parseLifecycleRecord(
      (selectedAssetDetails as Asset & { service?: unknown }).service,
      "asset.service"
    );

    const warrantyRemindersRecord = parseLifecycleRecord(
      getRecordValue(warrantyRecord, ["reminders"]),
      "asset.warranty.reminders"
    );

    const warrantyAvailable = toBoolean(getRecordValue(warrantyRecord, ["available"]))
      ?? Boolean(warrantyRecord);
    const insuranceAvailable = toBoolean(getRecordValue(insuranceRecord, ["available"]))
      ?? Boolean(insuranceRecord);
    const serviceAvailable = toBoolean(getRecordValue(serviceRecord, ["available", "required"]))
      ?? Boolean(serviceRecord);

    return {
      warranty: {
        available: warrantyAvailable,
        provider: formatTextValue(getRecordValue(warrantyRecord, ["provider"])),
        type: formatTextValue(getRecordValue(warrantyRecord, ["type"])),
        startDate: formatDateValue(getRecordValue(warrantyRecord, ["start_date", "startDate"])),
        endDate: formatDateValue(getRecordValue(warrantyRecord, ["end_date", "endDate", "expiry_date", "expiryDate"])),
        notes: formatTextValue(getRecordValue(warrantyRecord, ["notes"])),
        reminder30: formatBooleanValue(getRecordValue(warrantyRemindersRecord, ["thirty_days_before", "d30"])),
        reminder7: formatBooleanValue(getRecordValue(warrantyRemindersRecord, ["seven_days_before", "d7"])),
        reminderOnExpiry: formatBooleanValue(getRecordValue(warrantyRemindersRecord, ["on_expiry", "onExpiry"])),
      },
      insurance: {
        available: insuranceAvailable,
        provider: formatTextValue(getRecordValue(insuranceRecord, ["provider"])),
        policyNumber: formatTextValue(getRecordValue(insuranceRecord, ["policy_number", "policyNumber"])),
        startDate: formatDateValue(getRecordValue(insuranceRecord, ["start_date", "startDate"])),
        endDate: formatDateValue(getRecordValue(insuranceRecord, ["end_date", "endDate", "expiry_date", "expiryDate"])),
        notes: formatTextValue(getRecordValue(insuranceRecord, ["notes", "coverage_notes", "coverageNotes"])),
      },
      service: {
        available: serviceAvailable,
        frequencyOrType: formatTextValue(getRecordValue(serviceRecord, ["frequency", "type"])),
        lastServiceDate: formatDateValue(getRecordValue(serviceRecord, ["last_service_date", "lastServiceDate"])),
        nextServiceDate: formatDateValue(getRecordValue(serviceRecord, ["next_service_date", "nextServiceDate"])),
        notes: formatTextValue(getRecordValue(serviceRecord, ["notes"])),
      },
    };
  }, [selectedAssetDetails]);

  const hasSourceInformation = useMemo(() => {
    if (!selectedAssetDetails) {
      return false;
    }

    const sourceValues = [
      selectedAssetDetails.source,
      selectedAssetDetails.source_email_id,
      selectedAssetDetails.source_email_sender,
      selectedAssetDetails.source_email_subject,
    ];

    return sourceValues.some((value) => String(value || "").trim().length > 0);
  }, [selectedAssetDetails]);

  const downloadTextFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const formatLifecycleExportValue = (dateText: string, metaText: string) => {
    if (dateText && dateText !== "-") {
      return `${dateText} (${metaText})`;
    }
    return metaText || "-";
  };

  const formatPurchaseExportValue = (value?: string | null) => {
    if (!value) {
      return "-";
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? "-" : parsed.toLocaleDateString();
  };

  const formatJoinedValue = (...values: Array<string | null | undefined>) => {
    const items = values.map((value) => String(value || "").trim()).filter(Boolean);
    return items.length ? items.join(" / ") : "-";
  };

  const handleExport = (format: "csv" | "excel") => {
    setExporting(true);
    const rows = filteredAssets.map((asset) => {
      const statusLabel = getAssetComputedStatusLabel(asset);
      const warranty = getWarrantyPresentation(asset);
      const insurance = getInsurancePresentation(asset);
      const service = getServicePresentation(asset);

      if (viewMode === "card") {
        return [
          asset.name || "-",
          formatJoinedValue(asset.category, asset.subcategory),
          formatJoinedValue(asset.brand, asset.vendor),
          formatPurchaseExportValue(asset.purchase_date),
          statusLabel,
          formatLifecycleExportValue(warranty.dateText, warranty.metaText),
          formatLifecycleExportValue(insurance.dateText, insurance.metaText),
          formatLifecycleExportValue(service.dateText, service.metaText),
        ];
      }

      return [
        statusLabel,
        asset.name || "-",
        asset.category || "-",
        asset.vendor || "-",
        formatPurchaseExportValue(asset.purchase_date),
        formatLifecycleExportValue(warranty.dateText, warranty.metaText),
        formatLifecycleExportValue(insurance.dateText, insurance.metaText),
        formatLifecycleExportValue(service.dateText, service.metaText),
      ];
    });
    const headers = viewMode === "card"
      ? [["Asset Name", "Category / Subcategory", "Brand / Vendor", "Purchase Date", "Status", "Warranty", "Insurance", "Service"]]
      : [["Status", "Asset Name", "Category", "Vendor", "Purchase Date", "Warranty Expiry", "Insurance Expiry", "Next Service Date"]];
    if (format === "csv") {
      const csv = [...headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
        .join("\n");
      downloadTextFile(csv, "assets-export.csv", "text/csv;charset=utf-8;");
    } else {
      const tsv = [...headers, ...rows]
        .map((row) => row.map((cell) => String(cell).replaceAll("\t", " ")).join("\t"))
        .join("\n");
      downloadTextFile(tsv, "assets-export.xls", "application/vnd.ms-excel;charset=utf-8;");
    }
    setExporting(false);
    setExportAnchorEl(null);
  };

  return (
    <Box
      className="grid"
      sx={{
        height: "calc(100vh - 112px)",
        overflow: "hidden",
        alignContent: "flex-start",
      }}
    >
      <GlobalStyles
        styles={{
          "@media print": {
            "body *": {
              visibility: "hidden",
            },
            "#asset-details-print-section, #asset-details-print-section *": {
              visibility: "visible",
            },
            "#asset-details-print-section": {
              position: "absolute",
              left: 0,
              top: 0,
              width: "100%",
              backgroundColor: "#fff",
              padding: "16px",
              margin: 0,
            },
            ".no-print": {
              display: "none !important",
            },
          },
        }}
      />
      <Box className="col-12">
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, gap: 1.5, flexWrap: "wrap" }}>
          <Typography variant="h4">Assets</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: { md: "auto" } }}>
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => setResetDialogOpen(true)}
              disabled={isActionLoading("resetTestData")}
            >
              {isActionLoading("resetTestData") ? "Resetting..." : "Reset Test Data"}
            </Button>
          </Box>
        </Box>
      </Box>

      <Box className="col-12" sx={{ minHeight: 0, display: "flex" }}>
        <Stack spacing={3} sx={{ minHeight: 0, flex: 1, overflow: "hidden" }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
            <Stack spacing={1.5}>
              {/* Main filter row */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                <TextField
                  size="small"
                  placeholder="Search assets…"
                  value={searchQuery}
                  onChange={(event) => { setSearchQuery(event.target.value); setPage(0); }}
                  sx={{ width: 220 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField size="small" select label="Status" value={statusFilter}
                  onChange={(event) => { setStatusFilter(event.target.value); setPage(0); }}
                  sx={{ minWidth: 140 }}
                >
                  <MenuItem value="">All statuses</MenuItem>
                  {statusOptions.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </TextField>
                <TextField size="small" select label="Purchase Date" value={purchaseDateFilter}
                  onChange={(event) => {
                    setPurchaseDateFilter(event.target.value);
                    setPurchaseDateFrom("");
                    setPurchaseDateTo("");
                    setPage(0);
                  }}
                  sx={{ minWidth: 145 }}
                >
                  <MenuItem value="">All time</MenuItem>
                  <MenuItem value="last7">Last 7 days</MenuItem>
                  <MenuItem value="last30">Last 30 days</MenuItem>
                  <MenuItem value="this_year">This year</MenuItem>
                  <MenuItem value="custom">Custom range…</MenuItem>
                </TextField>
                {purchaseDateFilter === "custom" ? (
                  <>
                    <TextField
                      size="small"
                      type="date"
                      label="From"
                      value={purchaseDateFrom}
                      onChange={(event) => { setPurchaseDateFrom(event.target.value); setPage(0); }}
                      sx={{ width: 160 }}
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      size="small"
                      type="date"
                      label="To"
                      value={purchaseDateTo}
                      onChange={(event) => { setPurchaseDateTo(event.target.value); setPage(0); }}
                      sx={{ width: 160 }}
                      InputLabelProps={{ shrink: true }}
                    />
                  </>
                ) : null}
                <TextField size="small" select label="Warranty" value={warrantyFilter}
                  onChange={(event) => { setWarrantyFilter(event.target.value); setPage(0); }}
                  sx={{ minWidth: 125 }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="due_soon">Due soon</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                </TextField>
                <TextField size="small" select label="Insurance" value={insuranceDateFilter}
                  onChange={(event) => { setInsuranceDateFilter(event.target.value); setPage(0); }}
                  sx={{ minWidth: 125 }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="due_soon">Due soon</MenuItem>
                  <MenuItem value="expired">Expired</MenuItem>
                </TextField>
                <TextField size="small" select label="Service" value={serviceDateFilter}
                  onChange={(event) => { setServiceDateFilter(event.target.value); setPage(0); }}
                  sx={{ minWidth: 125 }}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="scheduled">Scheduled</MenuItem>
                  <MenuItem value="due_soon">Due soon</MenuItem>
                  <MenuItem value="overdue">Overdue</MenuItem>
                </TextField>
                {(searchQuery || statusFilter || warrantyFilter || purchaseDateFilter || insuranceDateFilter || serviceDateFilter) ? (
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("");
                      setWarrantyFilter("");
                      setPurchaseDateFilter("");
                      setPurchaseDateFrom("");
                      setPurchaseDateTo("");
                      setInsuranceDateFilter("");
                      setServiceDateFilter("");
                      setPage(0);
                    }}
                    sx={{ whiteSpace: "nowrap", color: "text.secondary", borderColor: "divider" }}
                  >
                    Clear filters
                  </Button>
                ) : null}
              </Box>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}>
            <Stack spacing={1.5} sx={{ minHeight: 0, flex: 1 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                <Box>
                  <Typography variant="h6" sx={{ lineHeight: 1.3 }}>{viewMode === "grid" ? "Asset Grid" : "Asset Cards"}</Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total: <strong>{assets.length}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.disabled">|</Typography>
                    <Typography variant="body2" color={filteredAssets.length < assets.length ? "primary" : "text.secondary"}>
                      Filtered: <strong>{filteredAssets.length}</strong>
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Box sx={{ display: "flex", gap: 0.5, p: 0.5, border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper" }}>
                    <Button
                      size="small"
                      variant={viewMode === "grid" ? "contained" : "text"}
                      onClick={() => setViewMode("grid")}
                    >
                      Grid View
                    </Button>
                    <Button
                      size="small"
                      variant={viewMode === "card" ? "contained" : "text"}
                      onClick={() => setViewMode("card")}
                    >
                      Card View
                    </Button>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    endIcon={exporting ? <CircularProgress size={14} /> : <ArrowDropDownIcon />}
                    onClick={(event) => setExportAnchorEl(event.currentTarget)}
                    disabled={exporting}
                  >
                    Export
                  </Button>
                  <Menu
                    anchorEl={exportAnchorEl}
                    open={Boolean(exportAnchorEl)}
                    onClose={() => setExportAnchorEl(null)}
                  >
                    <MenuItem onClick={() => handleExport("csv")}>CSV</MenuItem>
                    <MenuItem onClick={() => handleExport("excel")}>Excel</MenuItem>
                  </Menu>
                </Box>
              </Box>

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : (
                <>
                  {viewMode === "grid" ? (
                    <Paper variant="outlined" sx={{ height: 500, overflowY: "auto", overflowX: "auto", minHeight: 0, position: "relative" }}>
                      <Box sx={{ minWidth: 1450 }}>
                        <Box
                          sx={{
                            display: "grid",
                            gridTemplateColumns: "110px 1.6fr 1.1fr 1.1fr 1.1fr 1.1fr 1.1fr 1.1fr 140px",
                            columnGap: 2,
                            py: 1.25,
                            bgcolor: "grey.100",
                            borderBottom: 1,
                            borderColor: "divider",
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                          }}
                        >
                          <Box
                            sx={{
                              pl: 2,
                              position: "sticky",
                              left: 0,
                              bgcolor: "grey.100",
                              zIndex: 1,
                              display: "flex",
                              alignItems: "center",
                              borderRight: 1,
                              borderColor: "divider",
                            }}
                          >
                            <Typography variant="subtitle2">Status</Typography>
                          </Box>
                          <Typography variant="subtitle2">Asset Name</Typography>
                          <Typography variant="subtitle2">Category</Typography>
                          <Typography variant="subtitle2">Vendor</Typography>
                          <Typography variant="subtitle2">Purchase Date</Typography>
                          <Typography variant="subtitle2">Warranty Expiry</Typography>
                          <Typography variant="subtitle2">Insurance Expiry</Typography>
                          <Typography variant="subtitle2">Next Service Date</Typography>
                          <Box
                            sx={{
                              pl: 1,
                              position: "sticky",
                              right: 0,
                              bgcolor: "grey.100",
                              zIndex: 1,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              borderLeft: 1,
                              borderColor: "divider",
                            }}
                          >
                            <Typography variant="subtitle2">Actions</Typography>
                          </Box>
                        </Box>

                        {paginatedAssets.map((asset) => (
                          (() => {
                            const statusLabel = getAssetComputedStatusLabel(asset);
                            const warranty = getWarrantyPresentation(asset);
                            const insurance = getInsurancePresentation(asset);
                            const service = getServicePresentation(asset);

                            return (
                          <Box
                            key={asset.id}
                            sx={{
                              display: "grid",
                              gridTemplateColumns: "110px 1.6fr 1.1fr 1.1fr 1.1fr 1.1fr 1.1fr 1.1fr 140px",
                              columnGap: 2,
                              alignItems: "stretch",
                              py: 1.1,
                              borderBottom: 1,
                              borderColor: "divider",
                            }}
                          >
                            <Box
                              sx={{
                                pl: 2,
                                position: "sticky",
                                left: 0,
                                bgcolor: "background.paper",
                                zIndex: 1,
                                display: "flex",
                                alignItems: "center",
                                borderRight: 1,
                                borderColor: "divider",
                              }}
                            >
                              <Chip size="small" label={statusLabel} color={getStatusChipColor(statusLabel)} variant="outlined" />
                            </Box>
                            <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>{asset.name || "-"}</Typography>
                            <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>{asset.category || "-"}</Typography>
                            <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>{asset.vendor || "-"}</Typography>
                            <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>{asset.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : "-"}</Typography>
                            <Tooltip title={warranty.tooltip}>
                              <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <Typography variant="body2">{warranty.dateText}</Typography>
                                <Typography variant="caption" sx={{ color: warranty.metaColor }}>
                                  {warranty.metaText}
                                </Typography>
                              </Box>
                            </Tooltip>
                            <Tooltip title={insurance.tooltip}>
                              <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <Typography variant="body2">{insurance.dateText}</Typography>
                                <Typography variant="caption" sx={{ color: insurance.metaColor }}>
                                  {insurance.metaText}
                                </Typography>
                              </Box>
                            </Tooltip>
                            <Tooltip title={service.tooltip}>
                              <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <Typography variant="body2">{service.dateText}</Typography>
                                <Typography variant="caption" sx={{ color: service.metaColor }}>
                                  {service.metaText}
                                </Typography>
                              </Box>
                            </Tooltip>
                            <Stack
                              direction="row"
                              spacing={0.5}
                              sx={{
                                pl: 1,
                                position: "sticky",
                                right: 0,
                                bgcolor: "background.paper",
                                zIndex: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-start",
                                borderLeft: 1,
                                borderColor: "divider",
                              }}
                            >
                              <Tooltip title="View">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      void handleOpenAssetDetails(asset.id);
                                    }}
                                  >
                                    <VisibilityOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => { void handleOpenEdit(asset); }}>
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => handleOpenDelete(asset)}>
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Box>
                            );
                          })()
                        ))}
                      </Box>
                    </Paper>
                  ) : (
                    <Box sx={{ overflowY: "auto", maxHeight: "calc(100vh - 360px)" }}>
                      <Box
                        sx={{
                          display: "grid",
                          gap: 1.5,
                          gridTemplateColumns: {
                            xs: "1fr",
                            md: "repeat(2, minmax(0, 1fr))",
                            xl: "repeat(3, minmax(0, 1fr))",
                          },
                        }}
                      >
                        {filteredAssets.map((asset) => {
                          const statusLabel = getAssetComputedStatusLabel(asset);
                          const warranty = getWarrantyPresentation(asset);
                          const insurance = getInsurancePresentation(asset);
                          const service = getServicePresentation(asset);

                          return (
                            <Paper key={asset.id} variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}>
                              {/* Header: name/category + action icons top-right */}
                              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 0.5 }}>
                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                  <Typography variant="body1" noWrap sx={{ fontWeight: 600, lineHeight: 1.3 }}>{asset.name || "-"}</Typography>
                                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                                    {formatJoinedValue(asset.category, asset.subcategory)}
                                  </Typography>
                                </Box>
                                <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }}>
                                  <Tooltip title="View">
                                    <span>
                                      <IconButton size="small" sx={{ p: 0.5 }} onClick={() => { void handleOpenAssetDetails(asset.id); }}>
                                        <VisibilityOutlinedIcon sx={{ fontSize: 15 }} />
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title="Edit">
                                    <IconButton size="small" sx={{ p: 0.5 }} onClick={() => { void handleOpenEdit(asset); }}>
                                      <EditOutlinedIcon sx={{ fontSize: 15 }} />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Delete">
                                    <IconButton size="small" color="error" sx={{ p: 0.5 }} onClick={() => handleOpenDelete(asset)}>
                                      <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                                    </IconButton>
                                  </Tooltip>
                                </Stack>
                              </Box>

                              {/* Brand/Vendor + Purchase Date */}
                              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                                <Box>
                                  <Typography variant="caption" color="text.disabled" sx={{ display: "block", lineHeight: 1.2 }}>Brand / Vendor</Typography>
                                  <Typography variant="caption">{formatJoinedValue(asset.brand, asset.vendor)}</Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" color="text.disabled" sx={{ display: "block", lineHeight: 1.2 }}>Purchase Date</Typography>
                                  <Typography variant="caption">{formatPurchaseExportValue(asset.purchase_date)}</Typography>
                                </Box>
                              </Box>

                              <Divider />

                              {/* Lifecycle — single row */}
                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
                                <Tooltip title={warranty.tooltip}>
                                  <Typography variant="caption" sx={{ cursor: "default" }}>
                                    <Box component="span" sx={{ color: "text.disabled" }}>Warranty: </Box>
                                    <Box component="span" sx={{ color: warranty.metaColor }}>{warranty.dateText !== "-" ? warranty.dateText : warranty.metaText}</Box>
                                  </Typography>
                                </Tooltip>
                                <Typography variant="caption" sx={{ color: "text.disabled" }}>·</Typography>
                                <Tooltip title={insurance.tooltip}>
                                  <Typography variant="caption" sx={{ cursor: "default" }}>
                                    <Box component="span" sx={{ color: "text.disabled" }}>Insurance: </Box>
                                    <Box component="span" sx={{ color: insurance.metaColor }}>{insurance.dateText !== "-" ? insurance.dateText : insurance.metaText}</Box>
                                  </Typography>
                                </Tooltip>
                                <Typography variant="caption" sx={{ color: "text.disabled" }}>·</Typography>
                                <Tooltip title={service.tooltip}>
                                  <Typography variant="caption" sx={{ cursor: "default" }}>
                                    <Box component="span" sx={{ color: "text.disabled" }}>Service: </Box>
                                    <Box component="span" sx={{ color: service.metaColor }}>{service.dateText !== "-" ? service.dateText : service.metaText}</Box>
                                  </Typography>
                                </Tooltip>
                              </Box>

                              {/* Status — bottom right */}
                              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                                <Chip size="small" label={statusLabel} color={getStatusChipColor(statusLabel)} variant="outlined" />
                              </Box>
                            </Paper>
                          );
                        })}
                      </Box>
                    </Box>
                  )}

                  {viewMode === "grid" ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        flexWrap: "wrap",
                        gap: 1,
                      }}
                    >
                      <Typography variant="body2" color="text.secondary" sx={{ pl: 2, pr: 1 }}>
                        {(() => {
                          const total = filteredAssets.length;
                          if (total === 0) {
                            return "Showing 0-0 of 0";
                          }
                          const start = page * rowsPerPage + 1;
                          const end = Math.min(total, page * rowsPerPage + rowsPerPage);
                          return `Showing ${start}-${end} of ${total}`;
                        })()}
                      </Typography>
                      <TablePagination
                        component="div"
                        count={filteredAssets.length}
                        page={page}
                        onPageChange={(_, nextPage) => setPage(nextPage)}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={(event) => {
                          setRowsPerPage(Number(event.target.value));
                          setPage(0);
                        }}
                        rowsPerPageOptions={[5, 10, 25, 50]}
                        labelDisplayedRows={() => ""}
                        sx={{
                          ml: 0,
                          ".MuiTablePagination-displayedRows": { display: "none" },
                          ".MuiTablePagination-toolbar": {
                            pl: 0,
                          },
                          ".MuiTablePagination-spacer": {
                            display: "none",
                          },
                        }}
                      />
                    </Box>
                  ) : null}
                </>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Box>

      <AssetPreviewModal
        open={assetPreviewEditOpen}
        suggestion={assetPreviewEditSuggestion}
        disableAttachmentAndEmailPreview
        saveLoading={assetPreviewEditSaveLoading}
        uploadedDocuments={assetPreviewEditDocuments}
        uploadedDocumentsLoading={assetPreviewEditDocumentsLoading}
        isDocumentActionLoading={isAssetDocumentActionLoading}
        onViewUploadedDocument={(document) => {
          void handleViewAssetDocument(document, editingAssetId || undefined);
        }}
        onDeleteUploadedDocument={(documentId) => {
          void handleDeleteAssetPreviewDocument(documentId);
        }}
        onClose={handleCloseAssetPreviewEditDialog}
        onSave={handleSaveAssetPreviewEdit}
      />

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Asset</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField label="Name" value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} fullWidth />
            <TextField label="Brand" value={editForm.brand} onChange={(e) => setEditForm((prev) => ({ ...prev, brand: e.target.value }))} fullWidth />
            <TextField
              select
              label="Category"
              value={editForm.category}
              onChange={(e) => {
                const nextCategory = e.target.value;
                setEditForm((prev) => ({
                  ...prev,
                  category: nextCategory,
                  subcategory: "",
                  customCategory: nextCategory.toLowerCase() === "other" ? prev.customCategory : "",
                  customSubcategory: "",
                }));
              }}
              fullWidth
            >
              {editCategoryOptions.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            {editForm.category === "Other" ? (
              <TextField
                label="Enter Category"
                value={editForm.customCategory}
                onChange={(e) => setEditForm((prev) => ({ ...prev, customCategory: e.target.value }))}
                fullWidth
              />
            ) : null}
            <TextField
              select
              label="SubCategory"
              value={editForm.subcategory}
              onChange={(e) => {
                const nextSubcategory = e.target.value;
                setEditForm((prev) => ({
                  ...prev,
                  subcategory: nextSubcategory,
                  customSubcategory: nextSubcategory.toLowerCase() === "other" ? prev.customSubcategory : "",
                }));
              }}
              fullWidth
              disabled={!editForm.category}
            >
              {editSubcategoryOptions.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            {editForm.subcategory === "Other" ? (
              <TextField
                label="Enter SubCategory"
                value={editForm.customSubcategory}
                onChange={(e) => setEditForm((prev) => ({ ...prev, customSubcategory: e.target.value }))}
                fullWidth
              />
            ) : null}
            <TextField label="Vendor" value={editForm.vendor} onChange={(e) => setEditForm((prev) => ({ ...prev, vendor: e.target.value }))} fullWidth />
            <TextField label="Price" type="number" value={editForm.price} onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))} fullWidth />
            <TextField label="Purchase Date" type="date" value={editForm.purchase_date} onChange={(e) => setEditForm((prev) => ({ ...prev, purchase_date: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} disabled={editSaving}>Cancel</Button>
          <Button variant="contained" onClick={() => void handleSaveEdit()} disabled={editSaving}>
            {editSaving ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete Asset</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this asset?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => void handleConfirmDelete()} disabled={deleteLoading}>
            {deleteLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={resetDialogOpen}
        onClose={() => {
          if (!isActionLoading("resetTestData")) {
            setResetDialogOpen(false);
          }
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Reset Test Data</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove all assets, suggestions, reminders, and uploaded documents? Your login
            session and account will not be affected.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setResetDialogOpen(false)}
            disabled={isActionLoading("resetTestData")}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              void handleConfirmResetTestData();
            }}
            disabled={isActionLoading("resetTestData")}
          >
            Confirm Reset
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={viewAssetDialogOpen}
        onClose={() => {
          if (!assetDetailsLoading && !assetDocumentsLoading) {
            handleCloseAssetDetailsDialog();
          }
        }}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                {selectedAssetDetails?.name || "Asset Details"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedAssetDetails
                  ? `${selectedAssetDetails.category || "-"} / ${selectedAssetDetails.subcategory || "-"}`
                  : "-"}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} className="no-print">
              <Tooltip title="Edit">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleEditFromAssetDetails}
                    disabled={!selectedAssetDetails || assetDetailsLoading || assetDocumentsLoading}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Print">
                <span>
                  <IconButton
                    size="small"
                    onClick={handlePrintAssetDetails}
                    disabled={!selectedAssetDetails || assetDetailsLoading || assetDocumentsLoading}
                  >
                    <PrintOutlinedIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Close">
                <span>
                  <IconButton
                    size="small"
                    onClick={handleCloseAssetDetailsDialog}
                    disabled={assetDetailsLoading || assetDocumentsLoading}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {assetDetailsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : selectedAssetDetails ? (
            <Stack spacing={2} sx={{ mt: 0.5 }} ref={assetDetailsPrintRef} id="asset-details-print-section">
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Basic Details</Typography>
                <div className="grid">
                  <div className="col-12 md:col-6"><Typography variant="body2"><strong>Brand:</strong> {selectedAssetDetails.brand || "-"}</Typography></div>
                  <div className="col-12 md:col-6"><Typography variant="body2"><strong>Vendor:</strong> {selectedAssetDetails.vendor || "-"}</Typography></div>
                  <div className="col-12 md:col-6"><Typography variant="body2"><strong>Purchase Date:</strong> {formatDateValue(selectedAssetDetails.purchase_date)}</Typography></div>
                  <div className="col-12 md:col-6"><Typography variant="body2"><strong>Price:</strong> {selectedAssetDetails.price !== null && selectedAssetDetails.price !== undefined ? formatSuggestionPrice(selectedAssetDetails.price) : "-"}</Typography></div>
                  <div className="col-12 md:col-6"><Typography variant="body2"><strong>Serial Number:</strong> {selectedAssetDetails.serial_number || "-"}</Typography></div>
                  <div className="col-12 md:col-6"><Typography variant="body2"><strong>Model Number:</strong> {selectedAssetDetails.model_number || "-"}</Typography></div>
                  <div className="col-12 md:col-6"><Typography variant="body2"><strong>Location:</strong> {selectedAssetDetails.location || "-"}</Typography></div>
                  <div className="col-12 md:col-6"><Typography variant="body2"><strong>Assigned User:</strong> {selectedAssetDetails.assigned_user || "-"}</Typography></div>
                </div>
              </Paper>

              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Description and Notes</Typography>
                <div className="grid">
                  <div className="col-12"><Typography variant="body2"><strong>Description:</strong> {selectedAssetDetails.description || "-"}</Typography></div>
                  <div className="col-12"><Typography variant="body2"><strong>Notes:</strong> {selectedAssetDetails.notes || "-"}</Typography></div>
                </div>
              </Paper>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Lifecycle Information</Typography>
                <Stack spacing={1.25}>
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Warranty</Typography>
                    <div className="grid">
                      <div className="col-12 md:col-6"><Typography variant="body2"><strong>Available:</strong> {lifecycleDetails?.warranty.available ? "Yes" : "No"}</Typography></div>
                      {lifecycleDetails?.warranty.available ? (
                        <>
                          <div className="col-12 md:col-6"><Typography variant="body2"><strong>Provider:</strong> {lifecycleDetails.warranty.provider}</Typography></div>
                          <div className="col-12 md:col-6"><Typography variant="body2"><strong>Type:</strong> {lifecycleDetails.warranty.type}</Typography></div>
                          <div className="col-12 md:col-6"><Typography variant="body2"><strong>Start Date:</strong> {lifecycleDetails.warranty.startDate}</Typography></div>
                          <div className="col-12 md:col-6"><Typography variant="body2"><strong>End Date:</strong> {lifecycleDetails.warranty.endDate}</Typography></div>
                          <div className="col-12 md:col-12"><Typography variant="body2"><strong>Notes:</strong> {lifecycleDetails.warranty.notes}</Typography></div>
                          <div className="col-12"><Typography variant="body2" sx={{ mt: 0.5 }}><strong>Reminder Settings</strong></Typography></div>
                          <div className="col-12 md:col-4"><Typography variant="body2"><strong>30 Days Before:</strong> {lifecycleDetails.warranty.reminder30}</Typography></div>
                          <div className="col-12 md:col-4"><Typography variant="body2"><strong>7 Days Before:</strong> {lifecycleDetails.warranty.reminder7}</Typography></div>
                          <div className="col-12 md:col-4"><Typography variant="body2"><strong>On Expiry:</strong> {lifecycleDetails.warranty.reminderOnExpiry}</Typography></div>
                        </>
                      ) : (
                        <div className="col-12"><Typography variant="body2" color="text.secondary">Not Available</Typography></div>
                      )}
                    </div>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Insurance</Typography>
                    <div className="grid">
                      <div className="col-12 md:col-6"><Typography variant="body2"><strong>Available:</strong> {lifecycleDetails?.insurance.available ? "Yes" : "No"}</Typography></div>
                      {lifecycleDetails?.insurance.available ? (
                        <>
                          <div className="col-12 md:col-6"><Typography variant="body2"><strong>Provider:</strong> {lifecycleDetails.insurance.provider}</Typography></div>
                          <div className="col-12 md:col-6"><Typography variant="body2"><strong>Policy Number:</strong> {lifecycleDetails.insurance.policyNumber}</Typography></div>
                          <div className="col-12 md:col-6"><Typography variant="body2"><strong>Start Date:</strong> {lifecycleDetails.insurance.startDate}</Typography></div>
                          <div className="col-12 md:col-6"><Typography variant="body2"><strong>End Date:</strong> {lifecycleDetails.insurance.endDate}</Typography></div>
                          <div className="col-12 md:col-12"><Typography variant="body2"><strong>Notes:</strong> {lifecycleDetails.insurance.notes}</Typography></div>
                        </>
                      ) : (
                        <div className="col-12"><Typography variant="body2" color="text.secondary">Not Available</Typography></div>
                      )}
                    </div>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Service</Typography>
                    <div className="grid">
                      <div className="col-12 md:col-6"><Typography variant="body2"><strong>Available:</strong> {lifecycleDetails?.service.available ? "Yes" : "No"}</Typography></div>
                      {lifecycleDetails?.service.available ? (
                        <>
                          <div className="col-12 md:col-6"><Typography variant="body2"><strong>Frequency / Type:</strong> {lifecycleDetails.service.frequencyOrType}</Typography></div>
                          <div className="col-12 md:col-6"><Typography variant="body2"><strong>Last Service Date:</strong> {lifecycleDetails.service.lastServiceDate}</Typography></div>
                          <div className="col-12 md:col-6"><Typography variant="body2"><strong>Next Service Date:</strong> {lifecycleDetails.service.nextServiceDate}</Typography></div>
                          <div className="col-12 md:col-12"><Typography variant="body2"><strong>Notes:</strong> {lifecycleDetails.service.notes}</Typography></div>
                        </>
                      ) : (
                        <div className="col-12"><Typography variant="body2" color="text.secondary">Not Available</Typography></div>
                      )}
                    </div>
                  </Paper>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Documents</Typography>
                {assetDocumentsLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                    <CircularProgress size={20} />
                  </Box>
                ) : assetDocuments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No documents available</Typography>
                ) : (
                  <Stack spacing={1}>
                    {assetDocuments.map((document) => (
                      <Box
                        key={document.document_id}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 1,
                          px: 1.25,
                          py: 1,
                        }}
                      >
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="body2" noWrap>
                            <strong>File:</strong> {document.file_name || "-"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Uploaded: {formatDateValue(document.uploaded_at)}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} className="no-print">
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              void handleViewAssetDocument(document);
                            }}
                            disabled={isAssetDocumentActionLoading(`view-${document.document_id}`)}
                          >
                            {isAssetDocumentActionLoading(`view-${document.document_id}`) ? "Opening..." : "View"}
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                              void handleDownloadAssetDocument(document);
                            }}
                            disabled={isAssetDocumentActionLoading(`download-${document.document_id}`)}
                          >
                            {isAssetDocumentActionLoading(`download-${document.document_id}`) ? "Downloading..." : "Download"}
                          </Button>
                        </Stack>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>

              {hasSourceInformation ? (
                <>
                  <Divider />
                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Source Information</Typography>
                    <div className="grid">
                      <div className="col-12 md:col-4"><Typography variant="body2"><strong>Source:</strong> {selectedAssetDetails.source || "-"}</Typography></div>
                      <div className="col-12 md:col-4"><Typography variant="body2"><strong>Email Sender:</strong> {selectedAssetDetails.source_email_sender || "-"}</Typography></div>
                      <div className="col-12 md:col-4"><Typography variant="body2"><strong>Email ID:</strong> {selectedAssetDetails.source_email_id || "-"}</Typography></div>
                      <div className="col-12 md:col-12"><Typography variant="body2"><strong>Email Subject:</strong> {selectedAssetDetails.source_email_subject || "-"}</Typography></div>
                    </div>
                  </Paper>
                </>
              ) : null}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              No asset details available
            </Typography>
          )}
        </DialogContent>
      </Dialog>

    </Box>
  );
};

export default Assets;
