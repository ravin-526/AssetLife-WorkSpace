import api, { getAuthorizationHeader } from "./api.ts";

export type GmailStatusResponse = {
  connected: boolean;
  email_address?: string | null;
  last_sync_at?: string | null;
};

export type GmailConnectResponse = {
  auth_url: string;
  state: string;
};

export type MailboxConnectResponse = GmailConnectResponse;
export type MailboxStatusResponse = GmailStatusResponse;
export type MailboxSyncResponse = GmailSyncResponse;

export type GmailSyncResponse = {
  sync_status: string;
  scanned: number;
  emails_scanned?: number;
  purchase_emails_detected: number;
  invoice_emails?: number;
  attachments_detected: number;
  attachments_found?: number;
  attachments_downloaded: number;
  attachments_processed: number;
  created_suggestions: number;
  assets_detected?: number;
  skipped_duplicates: number;
  assets_added_by_user: number;
  suggestions?: AssetSuggestion[];
};

export type EmailScan = {
  id: string;
  sender: string;
  subject: string;
  email_date?: string;
  scan_status: "processing" | "completed" | "failed" | "skipped_duplicate" | "skipped_sender_filter" | "skipped_vendor" | "skipped_non_invoice";
  detected_items_count: number;
  source: string;
  error_message?: string;
  created_at: string;
};

export type AssetSuggestion = {
  id: string;
  product_name: string;
  brand?: string;
  vendor?: string;
  price?: number;
  purchase_date?: string;
  sender?: string;
  subject?: string;
  email_date?: string;
  quantity: number;
  source: string;
  status: string;
  warranty?: string;
  email_message_id: string;
  attachment_filename?: string;
  attachment_mime_type?: string;
  already_added: boolean;
  created_at: string;
};

export type SuggestionActionResponse = {
  suggestion_id: string;
  status: string;
  asset_id?: string;
};

export type SuggestionParseResponse = {
  suggestion_id: string;
  status: string;
  message: string;
  product_name?: string;
  brand?: string;
  vendor?: string;
  price?: number;
  purchase_date?: string;
  warranty?: string;
};

export type Asset = {
  id: string;
  name: string;
  asset_name?: string | null;
  vendor?: string | null;
  purchase_date?: string | null;
  price?: number | null;
  source: string;
  user_id: string;
  brand?: string | null;
  category?: string | null;
  subcategory?: string | null;
  serial_number?: string | null;
  model_number?: string | null;
  warranty?: Record<string, unknown> | null;
  insurance?: Record<string, unknown> | null;
  service?: Record<string, unknown> | null;
  source_email_id?: string | null;
  source_email_sender?: string | null;
  source_email_subject?: string | null;
  invoice_attachment_path?: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetLifecyclePayload = {
  warranty?: {
    available?: boolean;
    provider?: string;
    type?: string;
    start_date?: string;
    end_date?: string;
    notes?: string;
    reminders?: {
      thirty_days_before?: boolean;
      seven_days_before?: boolean;
      on_expiry?: boolean;
    };
  } | null;
  insurance?: {
    available?: boolean;
    provider?: string;
    policy_number?: string;
    start_date?: string;
    expiry_date?: string;
    premium_amount?: number;
    notes?: string;
    coverage_notes?: string;
    reminders?: {
      forty_five_days_before?: boolean;
      fifteen_days_before?: boolean;
    };
  } | null;
  service?: {
    required?: boolean;
    frequency?: string;
    custom_interval_days?: number;
    reminder_enabled?: boolean;
  } | null;
};

export type UploadedAssetDocument = {
  document_id: string;
  file_name: string;
  document_type: string;
  file_url: string;
  uploaded_at: string;
};

export type AssetCategoryOption = {
  category: string;
  subcategories: string[];
};

export type AssetUpdatePayload = {
  name?: string;
  brand?: string;
  vendor?: string;
  purchase_date?: string;
  price?: number;
};

export const getGmailStatus = async (): Promise<GmailStatusResponse> => {
  const response = await api.get<GmailStatusResponse>("/api/integrations/gmail/status");
  return response.data;
};

export const connectGmail = async (email?: string): Promise<GmailConnectResponse> => {
  const payload = email ? { email } : {};
  const response = await api.post<GmailConnectResponse>("/api/integrations/gmail/connect", payload);
  return response.data;
};

export const connectMailbox = async (email?: string): Promise<MailboxConnectResponse> => {
  return connectGmail(email);
};

export const completeGmailCallback = async (code: string, state: string): Promise<GmailStatusResponse> => {
  const response = await api.post<GmailStatusResponse>("/api/integrations/gmail/callback", { code, state });
  return response.data;
};

export const disconnectGmail = async (): Promise<{ disconnected: boolean }> => {
  const response = await api.post<{ disconnected: boolean }>("/api/integrations/gmail/disconnect");
  return response.data;
};

export const getMailboxStatus = async (): Promise<MailboxStatusResponse> => {
  return getGmailStatus();
};

export const disconnectMailbox = async (): Promise<{ disconnected: boolean }> => {
  return disconnectGmail();
};

export const syncEmails = async (
  days = 10,
  maxResults = 100,
  subjectKeywords: string[] = [],
  senderAddresses: string[] = []
): Promise<GmailSyncResponse> => {
  const response = await api.post<GmailSyncResponse>("/api/email/scan", {
    days,
    max_results: maxResults,
    subject_keywords: subjectKeywords,
    sender_addresses: senderAddresses,
  });
  return response.data;
};

export const syncMailboxEmails = async (
  days = 10,
  maxResults = 100,
  subjectKeywords: string[] = [],
  senderAddresses: string[] = []
): Promise<MailboxSyncResponse> => {
  return syncEmails(days, maxResults, subjectKeywords, senderAddresses);
};

export const getEmailScans = async (): Promise<EmailScan[]> => {
  const response = await api.get<EmailScan[]>("/api/emails");
  return response.data;
};

export const getAssetSuggestions = async (): Promise<AssetSuggestion[]> => {
  const response = await api.get<AssetSuggestion[]>("/api/assets/suggestions");
  return response.data;
};

export const confirmSuggestion = async (
  suggestionId: string,
  payload?: {
    product_name?: string;
    vendor?: string;
    price?: number;
    purchase_date?: string;
    warranty?: string;
    category?: string;
    location?: string;
  }
): Promise<SuggestionActionResponse> => {
  const response = await api.post<SuggestionActionResponse>(`/api/assets/suggestions/${suggestionId}/confirm`, payload ?? {});
  return response.data;
};

export const rejectSuggestion = async (suggestionId: string): Promise<SuggestionActionResponse> => {
  const response = await api.post<SuggestionActionResponse>(`/api/assets/suggestions/${suggestionId}/reject`);
  return response.data;
};

export const parseSuggestionAttachment = async (suggestionId: string): Promise<SuggestionParseResponse> => {
  const response = await api.post<SuggestionParseResponse>(`/api/assets/suggestions/${suggestionId}/parse`);
  return response.data;
};

export const createAsset = async (payload: {
  name: string;
  brand?: string;
  category: string;
  subcategory: string;
  vendor?: string;
  purchase_date?: string;
  price?: number;
  serial_number?: string;
  model_number?: string;
  lifecycle_info?: AssetLifecyclePayload;
  source?: string;
  suggestion_id?: string;
}): Promise<Asset> => {
  const response = await api.post<Asset>("/api/assets", payload);
  return response.data;
};

export const getAssetCategories = async (): Promise<AssetCategoryOption[]> => {
  const response = await api.get<AssetCategoryOption[]>("/api/categories");
  return response.data;
};

export const uploadAssetDocuments = async (assetId: string, files: File[]): Promise<{
  asset_id: string;
  uploaded: UploadedAssetDocument[];
}> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await api.post(`/api/assets/${assetId}/documents`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data as {
    asset_id: string;
    uploaded: UploadedAssetDocument[];
  };
};

export const getAssetDocuments = async (assetId: string): Promise<UploadedAssetDocument[]> => {
  const response = await api.get<UploadedAssetDocument[]>(`/api/assets/${assetId}/documents`);
  return response.data;
};

export const deleteAssetDocument = async (assetId: string, documentId: string): Promise<{ status: string; document_id: string }> => {
  const response = await api.delete<{ status: string; document_id: string }>(`/api/assets/${assetId}/documents/${documentId}`);
  return response.data;
};

export const getAssets = async (): Promise<Asset[]> => {
  const response = await api.get<Asset[]>("/api/assets");
  return response.data;
};

export const getAssetById = async (assetId: string): Promise<Asset> => {
  const response = await api.get<Asset>(`/api/assets/${assetId}`);
  return response.data;
};

export const updateAsset = async (assetId: string, payload: AssetUpdatePayload): Promise<Asset> => {
  const response = await api.put<Asset>(`/api/assets/${assetId}`, payload);
  return response.data;
};

export const deleteAsset = async (assetId: string): Promise<{ status: string; asset_id: string }> => {
  const response = await api.delete<{ status: string; asset_id: string }>(`/api/assets/${assetId}`);
  return response.data;
};

export const getAssetInvoiceUrl = (assetId: string): string => {
  const base = api.defaults.baseURL ?? "";
  return `${base}/api/assets/${assetId}/invoice`;
};

export const getSuggestionAttachmentUrl = (suggestionId: string): string => {
  const base = api.defaults.baseURL ?? "";
  return `${base}/api/assets/suggestions/${suggestionId}/attachment`;
};

const requireAuthHeader = (): { Authorization: string } => {
  const authHeader = getAuthorizationHeader();
  if (!authHeader.Authorization) {
    throw new Error("Authentication token is missing. Please login again.");
  }
  return { Authorization: authHeader.Authorization };
};

export const fetchAssetInvoiceBlob = async (assetId: string): Promise<Blob> => {
  const headers = requireAuthHeader();
  const response = await api.get(`/api/assets/${assetId}/invoice`, {
    headers,
    responseType: "blob",
  });
  return response.data as Blob;
};

export const fetchSuggestionAttachmentBlob = async (suggestionId: string): Promise<Blob> => {
  const headers = requireAuthHeader();
  const response = await api.get(`/api/assets/suggestions/${suggestionId}/attachment`, {
    headers,
    responseType: "blob",
  });
  return response.data as Blob;
};

export const fetchAssetDocumentBlob = async (assetId: string, documentId: string): Promise<Blob> => {
  const headers = requireAuthHeader();
  const response = await api.get(`/api/assets/${assetId}/documents/${documentId}/file`, {
    headers,
    responseType: "blob",
  });
  return response.data as Blob;
};
