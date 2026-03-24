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
  TablePagination,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { useLocation } from "react-router-dom";

import { Asset, getAssets } from "../services/gmail.ts";
import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import {
  Reminder,
  ReminderPayload,
  ReminderScope,
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
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<"all" | ReminderScope>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | ReminderStatus>("all");
  const [reminderTypeFilter, setReminderTypeFilter] = useState<"all" | ReminderType>("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useAutoDismissMessage(message, setMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 5000 });

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

  useEffect(() => {
    const state = location.state as { openCreate?: boolean } | null;
    if (!state?.openCreate) {
      return;
    }

    openCreateModal();
    window.history.replaceState({}, document.title);
  }, [location.state]);

  const standardControlHeight = 36;

  const standardFieldSx = {
    "& .MuiInputBase-root": {
      height: standardControlHeight,
    },
  };

  const filteredReminders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return reminders.filter((reminder) => {
      if (scopeFilter !== "all" && reminder.type !== scopeFilter) {
        return false;
      }

      if (statusFilter !== "all" && reminder.status !== statusFilter) {
        return false;
      }

      if (reminderTypeFilter !== "all" && reminder.reminder_type !== reminderTypeFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        reminder.title,
        reminder.asset_name,
        reminder.type,
        reminder.reminder_type,
        reminder.status,
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .some((value) => value.includes(query));
    });
  }, [reminders, scopeFilter, statusFilter, reminderTypeFilter, searchQuery]);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, scopeFilter, statusFilter, reminderTypeFilter]);

  useEffect(() => {
    const maxPage = Math.max(0, Math.ceil(filteredReminders.length / rowsPerPage) - 1);
    if (page > maxPage) {
      setPage(maxPage);
    }
  }, [filteredReminders.length, page, rowsPerPage]);

  const paginatedReminders = useMemo(() => {
    const startIndex = page * rowsPerPage;
    return filteredReminders.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredReminders, page, rowsPerPage]);

  const getAssetName = (assetId?: string | null) => {
    if (!assetId) {
      return "No Asset";
    }
    const match = assets.find((asset) => asset.id === assetId);
    return match?.name ?? "No Asset";
  };

  const formatScope = (scope: ReminderScope) => {
    return scope === "asset" ? "Asset" : "Custom";
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

  const handleClearFilters = () => {
    setSearchQuery("");
    setScopeFilter("all");
    setStatusFilter("all");
    setReminderTypeFilter("all");
    setPage(0);
  };

  const hasActiveFilters = Boolean(searchQuery || scopeFilter !== "all" || statusFilter !== "all" || reminderTypeFilter !== "all");

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
      asset_id: reminder.asset_id || "",
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
      asset_id: reminder.asset_id || "",
      reminder_date: reminder.reminder_date ? String(reminder.reminder_date).slice(0, 10) : "",
      reminder_type: reminder.reminder_type,
      status: reminder.status,
      notes: reminder.notes ?? "",
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.reminder_date) {
      setError("Reminder Title and Reminder Date are required.");
      return;
    }

    const normalizedAssetId = String(form.asset_id || "").trim();
    const linkedAsset = normalizedAssetId ? assets.find((asset) => asset.id === normalizedAssetId) : null;
    const isAssetReminder = Boolean(normalizedAssetId);

    const payload: ReminderPayload = {
      title: form.title.trim(),
      asset_id: normalizedAssetId || undefined,
      asset_name: linkedAsset?.name,
      type: isAssetReminder ? "asset" : "custom",
      reminder_date: form.reminder_date,
      reminder_type: isAssetReminder ? form.reminder_type : "custom",
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
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", md: "center" }, gap: 1.5, flexWrap: "wrap" }}>
          <Typography variant="h4">Reminders</Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, ml: { md: "auto" } }}>
            <Button size="small" variant="contained" onClick={openCreateModal}>
              Add Reminder
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
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center" }}>
                <TextField
                  size="small"
                  placeholder="Search reminders…"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  sx={{ ...standardFieldSx, width: 220 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
                <TextField
                  size="small"
                  select
                  label="Status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as "all" | ReminderStatus)}
                  sx={{ ...standardFieldSx, minWidth: 145 }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                  <MenuItem value="snoozed">Snoozed</MenuItem>
                </TextField>
                <TextField
                  size="small"
                  select
                  label="Type"
                  value={scopeFilter}
                  onChange={(event) => setScopeFilter(event.target.value as "all" | ReminderScope)}
                  sx={{ ...standardFieldSx, minWidth: 145 }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="asset">Asset</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </TextField>
                <TextField
                  size="small"
                  select
                  label="Reminder Type"
                  value={reminderTypeFilter}
                  onChange={(event) => setReminderTypeFilter(event.target.value as "all" | ReminderType)}
                  sx={{ ...standardFieldSx, minWidth: 145 }}
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="warranty">Warranty</MenuItem>
                  <MenuItem value="service">Service</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </TextField>
                {hasActiveFilters ? (
                  <Button
                    size="small"
                    variant="outlined"
                    color="inherit"
                    onClick={handleClearFilters}
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
                  <Typography variant="h6" sx={{ lineHeight: 1.3 }}>Reminder Grid</Typography>
                  {hasActiveFilters ? (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                      Filters applied
                    </Typography>
                  ) : null}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total: <strong>{reminders.length}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.disabled">|</Typography>
                    <Typography variant="body2" color={filteredReminders.length < reminders.length ? "primary" : "text.secondary"}>
                      Filtered: <strong>{filteredReminders.length}</strong>
                    </Typography>
                  </Box>
                </Box>
              </Box>

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                  <CircularProgress size={28} />
                </Box>
              ) : filteredReminders.length > 0 ? (
                <>
                  <Paper variant="outlined" sx={{ height: 500, overflowY: "auto", overflowX: "auto", minHeight: 0, position: "relative" }}>
                  <Box sx={{ minWidth: 1120 }}>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "120px 1.8fr 1.1fr 1.4fr 1.2fr 1.2fr 140px",
                        columnGap: 2,
                        py: 1.25,
                        bgcolor: (theme) => theme.palette.mode === "dark" ? "#1f2937" : "grey.100",
                        borderBottom: 1,
                        borderColor: (theme) => theme.palette.mode === "dark" ? "#374151" : "divider",
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
                          bgcolor: (theme) => theme.palette.mode === "dark" ? "#1f2937" : "grey.100",
                          zIndex: 1,
                          display: "flex",
                          alignItems: "center",
                          borderRight: 1,
                          borderColor: "divider",
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Status</Typography>
                      </Box>
                      <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Reminder Title</Typography>
                      <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Type</Typography>
                      <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Asset Name</Typography>
                      <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Reminder Date</Typography>
                      <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Reminder Type</Typography>
                      <Box
                        sx={{
                          pl: 1,
                          position: "sticky",
                          right: 0,
                          bgcolor: (theme) => theme.palette.mode === "dark" ? "#1f2937" : "grey.100",
                          zIndex: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "flex-start",
                          borderLeft: 1,
                          borderColor: "divider",
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ color: (theme) => theme.palette.mode === "dark" ? "#e5e7eb" : undefined, fontWeight: 600 }}>Actions</Typography>
                      </Box>
                    </Box>

                    {paginatedReminders.map((reminder) => (
                      <Box
                        key={reminder.id}
                        sx={{
                          display: "grid",
                          gridTemplateColumns: "120px 1.8fr 1.1fr 1.4fr 1.2fr 1.2fr 140px",
                          columnGap: 2,
                          alignItems: "stretch",
                          py: 1.1,
                          borderBottom: 1,
                          borderColor: "divider",
                        }}
                      >
                        <Box>
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
                              height: "100%",
                            }}
                          >
                            <Chip
                              size="small"
                              label={formatStatus(reminder.status)}
                              color={getStatusChipColor(reminder.status)}
                              variant="outlined"
                            />
                          </Box>
                        </Box>
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>{reminder.title}</Typography>
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>{formatScope(reminder.type)}</Typography>
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>{reminder.asset_name || getAssetName(reminder.asset_id)}</Typography>
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>
                          {reminder.reminder_date ? new Date(reminder.reminder_date).toLocaleDateString() : "-"}
                        </Typography>
                        <Typography variant="body2" sx={{ display: "flex", alignItems: "center" }}>{formatType(reminder.reminder_type)}</Typography>
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
                              <IconButton size="small" onClick={() => openViewModal(reminder)}>
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
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
                      const total = filteredReminders.length;
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
                    count={filteredReminders.length}
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
                </>
              ) : (
                <Paper
                  variant="outlined"
                  sx={{
                    height: 500,
                    minHeight: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    px: 3,
                  }}
                >
                  <Stack spacing={1} sx={{ alignItems: "center", textAlign: "center" }}>
                    <SearchIcon sx={{ fontSize: 28, color: "text.disabled" }} />
                    <Typography variant="body1">No reminders found</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Adjust your filters or create a new reminder.
                    </Typography>
                  </Stack>
                </Paper>
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
              label="Link to Asset (Optional)"
              value={form.asset_id}
              onChange={(event) => setForm((prev) => ({ ...prev, asset_id: event.target.value }))}
              fullWidth
              disabled={viewOnly}
              sx={standardFieldSx}
            >
              <MenuItem value="">No asset selected</MenuItem>
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

            {form.asset_id ? (
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
            ) : null}

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
