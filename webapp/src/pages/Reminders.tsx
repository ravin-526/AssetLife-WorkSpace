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
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

import { Asset, getAssets } from "../services/gmail.ts";
import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import {
  Reminder,
  ReminderPayload,
  ReminderStatus,
  ReminderType,
  createReminder,
  deleteReminder,
  getReminders,
  updateReminder,
} from "../services/reminders.ts";

type ReminderForm = {
  title: string;
  asset_id: string;
  reminder_date: string;
  reminder_type: ReminderType;
  status: ReminderStatus;
  notes: string;
};

const initialFormState: ReminderForm = {
  title: "",
  asset_id: "",
  reminder_date: "",
  reminder_type: "warranty",
  status: "active",
  notes: "",
};

const Reminders = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useAutoDismissMessage(message, setMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 4000 });

  const [modalOpen, setModalOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [form, setForm] = useState<ReminderForm>(initialFormState);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingReminder, setDeletingReminder] = useState<Reminder | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      setError("");
      const [remindersResponse, assetsResponse] = await Promise.all([getReminders(), getAssets()]);
      setReminders(remindersResponse);
      setAssets(assetsResponse);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load reminders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const standardControlHeight = 36;

  const standardFieldSx = {
    "& .MuiInputBase-root": {
      height: standardControlHeight,
    },
  };

  const filteredReminders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return reminders;
    }

    return reminders.filter((reminder) => {
      return [
        reminder.title,
        reminder.asset_name,
        reminder.reminder_type,
        reminder.status,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [reminders, searchQuery]);

  const getAssetName = (assetId: string) => {
    const match = assets.find((asset) => asset.id === assetId);
    return match?.name ?? "-";
  };

  const formatType = (type: ReminderType) => {
    if (type === "warranty") {
      return "Warranty";
    }
    if (type === "service") {
      return "Service";
    }
    return "Custom";
  };

  const getStatusChipColor = (status: ReminderStatus): "success" | "warning" | "default" => {
    if (status === "active") {
      return "success";
    }
    if (status === "snoozed") {
      return "warning";
    }
    return "default";
  };

  const formatStatus = (status: ReminderStatus) => {
    if (status === "active") {
      return "Active";
    }
    if (status === "completed") {
      return "Completed";
    }
    return "Snoozed";
  };

  const openCreateModal = () => {
    setViewOnly(false);
    setEditingReminder(null);
    setForm(initialFormState);
    setModalOpen(true);
  };

  const openViewModal = (reminder: Reminder) => {
    setViewOnly(true);
    setEditingReminder(reminder);
    setForm({
      title: reminder.title,
      asset_id: reminder.asset_id,
      reminder_date: reminder.reminder_date ? String(reminder.reminder_date).slice(0, 10) : "",
      reminder_type: reminder.reminder_type,
      status: reminder.status,
      notes: reminder.notes ?? "",
    });
    setModalOpen(true);
  };

  const openEditModal = (reminder: Reminder) => {
    setViewOnly(false);
    setEditingReminder(reminder);
    setForm({
      title: reminder.title,
      asset_id: reminder.asset_id,
      reminder_date: reminder.reminder_date ? String(reminder.reminder_date).slice(0, 10) : "",
      reminder_type: reminder.reminder_type,
      status: reminder.status,
      notes: reminder.notes ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.asset_id || !form.reminder_date) {
      setError("Reminder Title, Asset, and Reminder Date are required.");
      return;
    }

    const payload: ReminderPayload = {
      title: form.title.trim(),
      asset_id: form.asset_id,
      reminder_date: form.reminder_date,
      reminder_type: form.reminder_type,
      status: form.status,
      notes: form.notes.trim() || undefined,
    };

    setSaving(true);
    try {
      setError("");
      if (editingReminder) {
        const updated = await updateReminder(editingReminder.id, payload);
        setReminders((prev) => prev.map((item) => (item.id === editingReminder.id ? updated : item)));
        setMessage("Reminder updated successfully.");
      } else {
        const created = await createReminder(payload);
        setReminders((prev) => [created, ...prev]);
        setMessage("Reminder created successfully.");
      }
      setModalOpen(false);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save reminder");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenDelete = (reminder: Reminder) => {
    setDeletingReminder(reminder);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deletingReminder) {
      return;
    }

    setDeleteLoading(true);
    try {
      setError("");
      await deleteReminder(deletingReminder.id);
      setReminders((prev) => prev.filter((item) => item.id !== deletingReminder.id));
      setMessage("Reminder deleted successfully.");
      setDeleteDialogOpen(false);
      setDeletingReminder(null);
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to delete reminder");
    } finally {
      setDeleteLoading(false);
    }
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
      <Box className="col-12">
        <div className="grid align-items-center">
          <div className="col-12 md:col-6">
            <Typography variant="h4">Reminders</Typography>
          </div>
          <div className="col-12 md:col-6 flex md:justify-content-end">
            <Stack direction="row" spacing={1} sx={{ width: { xs: "100%", md: "auto" } }}>
              <TextField
                size="small"
                placeholder="Search reminders"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                sx={{
                  ...standardFieldSx,
                  width: { xs: "100%", md: 260 },
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
              <Button variant="contained" onClick={openCreateModal} sx={{ minWidth: 150 }}>
                Create Reminder
              </Button>
            </Stack>
          </div>
        </div>
      </Box>

      <Box className="col-12" sx={{ minHeight: 0, display: "flex" }}>
        <Stack spacing={3} sx={{ minHeight: 0, flex: 1, overflow: "hidden" }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, minHeight: 0, display: "flex", flexDirection: "column", flex: 1 }}>
            <Stack spacing={1.5} sx={{ minHeight: 0, flex: 1 }}>
              <Typography variant="h6" sx={{ mb: 1 }}>
                Reminders Grid
              </Typography>

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : filteredReminders.length > 0 ? (
                <Paper variant="outlined" sx={{ height: 520, overflowY: "auto", overflowX: "auto", minHeight: 0 }}>
                  <Box sx={{ minWidth: 980 }}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "1.8fr 1.4fr 1.2fr 1.2fr 1fr 1.2fr",
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
                      <Typography variant="subtitle2">Reminder Title</Typography>
                      <Typography variant="subtitle2">Asset Name</Typography>
                      <Typography variant="subtitle2">Reminder Date</Typography>
                      <Typography variant="subtitle2">Reminder Type</Typography>
                      <Typography variant="subtitle2">Status</Typography>
                      <Typography variant="subtitle2">Actions</Typography>
                    </Box>

                    {filteredReminders.map((reminder) => (
                      <Box
                        key={reminder.id}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "1.8fr 1.4fr 1.2fr 1.2fr 1fr 1.2fr",
                          columnGap: 2,
                          alignItems: "center",
                          px: 2,
                          py: 1.1,
                          borderBottom: 1,
                          borderColor: "divider",
                        }}
                      >
                        <Typography variant="body2">{reminder.title}</Typography>
                        <Typography variant="body2">{reminder.asset_name || getAssetName(reminder.asset_id)}</Typography>
                        <Typography variant="body2">
                          {reminder.reminder_date ? new Date(reminder.reminder_date).toLocaleDateString() : "-"}
                        </Typography>
                        <Typography variant="body2">{formatType(reminder.reminder_type)}</Typography>
                        <Box>
                          <Chip
                            size="small"
                            label={formatStatus(reminder.status)}
                            color={getStatusChipColor(reminder.status)}
                            variant="filled"
                          />
                        </Box>
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="View">
                            <IconButton size="small" onClick={() => openViewModal(reminder)}>
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => openEditModal(reminder)}>
                              <EditOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => handleOpenDelete(reminder)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              ) : (
                <Typography variant="body2" color="text.secondary">No reminders found.</Typography>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Box>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{viewOnly ? "View Reminder" : editingReminder ? "Edit Reminder" : "Create Reminder"}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              size="small"
              label="Reminder Title"
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
              disabled={viewOnly}
              sx={standardFieldSx}
            />

            <TextField
              size="small"
              select
              label="Asset"
              value={form.asset_id}
              onChange={(event) => setForm((prev) => ({ ...prev, asset_id: event.target.value }))}
              fullWidth
              disabled={viewOnly}
              sx={standardFieldSx}
            >
              {assets.map((asset) => (
                <MenuItem key={asset.id} value={asset.id}>{asset.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              size="small"
              type="date"
              label="Reminder Date"
              InputLabelProps={{ shrink: true }}
              value={form.reminder_date}
              onChange={(event) => setForm((prev) => ({ ...prev, reminder_date: event.target.value }))}
              fullWidth
              disabled={viewOnly}
              sx={standardFieldSx}
            />

            <TextField
              size="small"
              select
              label="Reminder Type"
              value={form.reminder_type}
              onChange={(event) => setForm((prev) => ({ ...prev, reminder_type: event.target.value as ReminderType }))}
              fullWidth
              disabled={viewOnly}
              sx={standardFieldSx}
            >
              <MenuItem value="warranty">Warranty</MenuItem>
              <MenuItem value="service">Service</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </TextField>

            <TextField
              size="small"
              select
              label="Status"
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as ReminderStatus }))}
              fullWidth
              disabled={viewOnly}
              sx={standardFieldSx}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="snoozed">Snoozed</MenuItem>
            </TextField>

            <TextField
              size="small"
              label="Notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              multiline
              minRows={3}
              fullWidth
              disabled={viewOnly}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setModalOpen(false)} disabled={saving}>Cancel</Button>
          {!viewOnly ? (
            <Button variant="contained" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Delete Reminder</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this reminder?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleteLoading}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => void handleConfirmDelete()} disabled={deleteLoading}>
            {deleteLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Reminders;
