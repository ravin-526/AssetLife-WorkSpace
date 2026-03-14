import api from "./api.ts";

export type ReminderStatus = "active" | "completed" | "snoozed";
export type ReminderType = "warranty" | "service" | "custom";

export type Reminder = {
  id: string;
  title: string;
  asset_id: string;
  asset_name?: string;
  reminder_date: string;
  reminder_type: ReminderType;
  status: ReminderStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

export type ReminderPayload = {
  title: string;
  asset_id: string;
  reminder_date: string;
  reminder_type: ReminderType;
  status?: ReminderStatus;
  notes?: string;
};

type ReminderApiResponse = {
  id?: string;
  _id?: string;
  title?: string;
  reminder_title?: string;
  asset_id?: string;
  asset_name?: string;
  assetName?: string;
  reminder_date?: string;
  reminderDate?: string;
  reminder_type?: string;
  reminderType?: string;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
};

const toReminderType = (value: string | undefined): ReminderType => {
  const lowered = String(value || "").toLowerCase();
  if (lowered.includes("warranty")) {
    return "warranty";
  }
  if (lowered.includes("service")) {
    return "service";
  }
  return "custom";
};

const toReminderStatus = (value: string | undefined): ReminderStatus => {
  const lowered = String(value || "").toLowerCase();
  if (lowered === "completed") {
    return "completed";
  }
  if (lowered === "snoozed") {
    return "snoozed";
  }
  return "active";
};

const normalizeReminder = (item: ReminderApiResponse): Reminder => {
  return {
    id: String(item.id || item._id || ""),
    title: String(item.title || item.reminder_title || ""),
    asset_id: String(item.asset_id || ""),
    asset_name: item.asset_name || item.assetName || undefined,
    reminder_date: String(item.reminder_date || item.reminderDate || ""),
    reminder_type: toReminderType(item.reminder_type || item.reminderType),
    status: toReminderStatus(item.status),
    notes: item.notes,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
};

export const getReminders = async (): Promise<Reminder[]> => {
  const response = await api.get<ReminderApiResponse[] | { data?: ReminderApiResponse[] }>("/api/reminders");
  console.log("Reminders API response:", response.data);

  const raw = Array.isArray(response.data)
    ? response.data
    : Array.isArray(response.data?.data)
      ? response.data.data
      : [];

  return raw.map(normalizeReminder);
};

export const createReminder = async (payload: ReminderPayload): Promise<Reminder> => {
  const response = await api.post<ReminderApiResponse>("/api/reminders", payload);
  return normalizeReminder(response.data);
};

export const updateReminder = async (reminderId: string, payload: ReminderPayload): Promise<Reminder> => {
  const response = await api.put<ReminderApiResponse>(`/api/reminders/${reminderId}`, payload);
  return normalizeReminder(response.data);
};

export const deleteReminder = async (reminderId: string): Promise<{ status: string; id?: string }> => {
  const response = await api.delete<{ status: string; id?: string }>(`/api/reminders/${reminderId}`);
  return response.data;
};
