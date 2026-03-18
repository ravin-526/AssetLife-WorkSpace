import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import api from "../services/api.ts";
import useAutoDismissMessage from "../hooks/useAutoDismissMessage.ts";
import useUserStore from "../store/userStore.ts";
import { POST_LOGIN_THEME } from "../styles/theme";

type ProfileData = {
  id: string;
  name: string;
  email: string;
  phone: string;
  organization: string;
  role: string;
};

const EMPTY_PROFILE: ProfileData = {
  id: "",
  name: "",
  email: "",
  phone: "",
  organization: "",
  role: "",
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type JwtPayload = {
  sub?: string;
  role?: string;
};

const parseJwtPayload = (token: string): JwtPayload | null => {
  try {
    const payload = token.split(".")[1];
    if (!payload) {
      return null;
    }

    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = window.atob(base64);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
};

const normalizeProfile = (value: ProfileData): ProfileData => ({
  ...value,
  name: value.name.trim(),
  email: value.email.trim().toLowerCase(),
  phone: value.phone.trim().replace(/\s+/g, ""),
  organization: value.organization.trim(),
  role: value.role.trim(),
});

const Profile = () => {
  const user = useUserStore((state) => state.user);
  const tokenFromStore = useUserStore((state) => state.token);
  const updateUser = useUserStore((state) => state.updateUser);

  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [draft, setDraft] = useState<ProfileData>(EMPTY_PROFILE);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileData, string>>>({});

  useAutoDismissMessage(message, setMessage, { delay: 3000 });
  useAutoDismissMessage(error, setError, { delay: 5000 });

  const storedToken = tokenFromStore ?? localStorage.getItem("jwt_token");
  const jwtPayload = useMemo(() => (storedToken ? parseJwtPayload(storedToken) : null), [storedToken]);
  const resolvedRole = (user?.role ?? jwtPayload?.role ?? "").toString().toLowerCase();
  const resolvedUserId = (user?.id ?? jwtPayload?.sub ?? "").toString();

  useEffect(() => {
    if (storedToken) {
      api.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
    } else {
      delete api.defaults.headers.common.Authorization;
    }
  }, [storedToken]);

  const hasChanges = useMemo(() => {
    return JSON.stringify(normalizeProfile(draft)) !== JSON.stringify(normalizeProfile(profile));
  }, [draft, profile]);

  const isIndividual = resolvedRole === "individual";

  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      setError("");
      setMessage("");

      if (!storedToken) {
        setError("Please login to view profile");
        setLoading(false);
        return;
      }

      try {
        if (isIndividual) {
          const response = await api.get<Partial<ProfileData>>("/individual/profile");
          const payload = response.data;
          const resolvedProfile: ProfileData = {
            id: String(payload.id ?? user?.id ?? ""),
            name: String(payload.name ?? user?.name ?? ""),
            email: String(payload.email ?? user?.email ?? ""),
            phone: String(payload.phone ?? user?.phone ?? ""),
            organization: String(payload.organization ?? ""),
            role: String(payload.role ?? user?.role ?? "individual"),
          };
          setProfile(resolvedProfile);
          setDraft(resolvedProfile);
          updateUser({
            id: resolvedProfile.id,
            name: resolvedProfile.name,
            email: resolvedProfile.email,
            phone: resolvedProfile.phone,
            role: resolvedProfile.role,
          });
        } else {
          const userId = resolvedUserId;
          if (!userId) {
            throw new Error("Please login to view profile");
          }

          const response = await api.get<{
            id: string;
            name: string;
            mobile: string;
            role: string;
          }>(`/users/${userId}`);

          const payload = response.data;
          const resolvedProfile: ProfileData = {
            id: String(payload.id ?? userId),
            name: String(payload.name ?? user?.name ?? ""),
            email: String(user?.email ?? ""),
            phone: String(payload.mobile ?? user?.phone ?? ""),
            organization: String((user?.organization as string | undefined) ?? ""),
            role: String(payload.role ?? user?.role ?? "user"),
          };

          setProfile(resolvedProfile);
          setDraft(resolvedProfile);
          updateUser({
            id: resolvedProfile.id,
            name: resolvedProfile.name,
            phone: resolvedProfile.phone,
            role: resolvedProfile.role,
          });
        }
      } catch (requestError: unknown) {
        setError(requestError instanceof Error ? requestError.message : "Failed to fetch profile");
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, [
    isIndividual,
    resolvedUserId,
    storedToken,
    updateUser,
    user?.email,
    user?.id,
    user?.name,
    user?.organization,
    user?.phone,
    user?.role,
  ]);

  const validate = () => {
    const nextErrors: Partial<Record<keyof ProfileData, string>> = {};

    if (!draft.name.trim()) {
      nextErrors.name = "Name is required";
    } else if (draft.name.trim().length < 2 || draft.name.trim().length > 120) {
      nextErrors.name = "Name must be between 2 and 120 characters";
    }

    if (draft.email.trim() && !emailRegex.test(draft.email.trim())) {
      nextErrors.email = "Please enter a valid email";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFieldFocus = () => {
    if (!editing) {
      setEditing(true);
    }
  };

  const handleSave = async () => {
    setError("");
    setMessage("");

    if (!storedToken) {
      setError("Please login to view profile");
      return;
    }

    if (!validate()) {
      return;
    }

    try {
      setSaving(true);
      const normalizedProfile = normalizeProfile(draft);

      if (isIndividual) {
        const response = await api.put<Partial<ProfileData>>("/individual/update", {
          name: normalizedProfile.name,
          email: normalizedProfile.email,
        }, {
          params: { user_id: profile.id || resolvedUserId },
        });

        const payload = response.data;
        const updated: ProfileData = {
          ...normalizedProfile,
          id: String(payload.id ?? profile.id),
          role: String(payload.role ?? profile.role),
          organization: String(payload.organization ?? profile.organization ?? ""),
        };

        setProfile(updated);
        setDraft(updated);
        updateUser({
          id: updated.id,
          name: updated.name,
          email: updated.email,
          phone: updated.phone,
          role: updated.role,
        });
      } else {
        if (!profile.id && !resolvedUserId) {
          throw new Error("Unable to save profile: user id is missing.");
        }

        const targetUserId = profile.id || resolvedUserId;

        const response = await api.put<{
          id: string;
          name: string;
          mobile: string;
          role: string;
        }>(`/users/${targetUserId}`, {
          name: normalizedProfile.name,
          mobile: normalizedProfile.phone,
        });

        const payload = response.data;
        const updated: ProfileData = {
          ...normalizedProfile,
          id: String(payload.id ?? profile.id),
          name: String(payload.name ?? normalizedProfile.name),
          phone: String(payload.mobile ?? normalizedProfile.phone),
          role: String(payload.role ?? profile.role),
        };

        setProfile(updated);
        setDraft(updated);
        updateUser({
          id: updated.id,
          name: updated.name,
          phone: updated.phone,
          role: updated.role,
        });
      }

      setEditing(false);
      setMessage("Profile updated successfully.");
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 280 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  const editableFieldSx = {
    "& .MuiInputBase-input": {
      lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
    },
    "& .MuiInputBase-input::placeholder": {
      lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
      opacity: 1,
    },
  };

  const standardControlHeight = 36;
  const standardFieldSx = {
    "& .MuiInputBase-root": {
      height: standardControlHeight,
    },
  };

  const getNameParts = (fullName: string) => {
    const trimmed = fullName.trim();
    if (!trimmed) {
      return { firstName: "", lastName: "" };
    }

    const segments = trimmed.split(/\s+/);
    return {
      firstName: segments[0] ?? "",
      lastName: segments.slice(1).join(" "),
    };
  };

  const nameSource = editing ? draft.name : profile.name;
  const { firstName, lastName } = getNameParts(nameSource);

  const nameReadOnly = !editing || saving;
  const emailReadOnly = !editing || saving || !isIndividual;

  return (
    <Box className="grid" sx={{ alignContent: "flex-start" }}>
      <Box className="col-12">
        <Typography variant="h4">Profile</Typography>
      </Box>

      <Box className="col-12">
        <Stack spacing={3}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h6">Account Information</Typography>
              <div className="grid">
                <div className="col-12 md:col-6">
                  <TextField
                    size="small"
                    label="First Name"
                    value={firstName}
                    onChange={(event) => {
                      const nextFirst = event.target.value;
                      const combined = `${nextFirst.trim()} ${lastName}`.trim();
                      setDraft((prev) => ({ ...prev, name: combined }));
                    }}
                    onFocus={handleFieldFocus}
                    error={Boolean(errors.name)}
                    helperText={errors.name}
                    InputProps={{ readOnly: nameReadOnly }}
                    className="postLogin"
                    sx={{ ...editableFieldSx, ...standardFieldSx }}
                    fullWidth
                  />
                </div>

                <div className="col-12 md:col-6">
                  <TextField
                    size="small"
                    label="Last Name"
                    value={lastName}
                    onChange={(event) => {
                      const nextLast = event.target.value;
                      const combined = `${firstName} ${nextLast.trim()}`.trim();
                      setDraft((prev) => ({ ...prev, name: combined }));
                    }}
                    onFocus={handleFieldFocus}
                    InputProps={{ readOnly: nameReadOnly }}
                    className="postLogin"
                    sx={{ ...editableFieldSx, ...standardFieldSx }}
                    fullWidth
                  />
                </div>

                <div className="col-12 md:col-6">
                  <TextField
                    size="small"
                    label="Email"
                    value={editing ? draft.email : profile.email}
                    onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
                    onFocus={isIndividual ? handleFieldFocus : undefined}
                    error={Boolean(errors.email)}
                    helperText={errors.email}
                    InputProps={{ readOnly: emailReadOnly }}
                    className="postLogin"
                    sx={{ ...editableFieldSx, ...standardFieldSx }}
                    fullWidth
                  />
                </div>

                <div className="col-12 md:col-6">
                  <TextField
                    size="small"
                    label="Phone Number"
                    value={profile.phone}
                    disabled
                    className="postLogin readOnly"
                    sx={{ ...editableFieldSx, ...standardFieldSx }}
                    fullWidth
                  />
                </div>
              </div>
            </Stack>
          </Paper>

          {!isIndividual ? (
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
              <Stack spacing={2}>
                <Typography variant="h6">Organization Details</Typography>
                <div className="grid">
                  <div className="col-12 md:col-6">
                    <TextField
                      size="small"
                      label="Company Name"
                      value={editing ? draft.organization : profile.organization}
                      onChange={(event) => setDraft((prev) => ({ ...prev, organization: event.target.value }))}
                      InputProps={{ readOnly: true }}
                      className="postLogin"
                      sx={{ ...editableFieldSx, ...standardFieldSx }}
                      fullWidth
                    />
                  </div>
                  <div className="col-12 md:col-6">
                    <TextField
                      size="small"
                      label="Account Type"
                      value={isIndividual ? "Individual" : "Organization"}
                      InputProps={{ readOnly: true }}
                      className="postLogin readOnly"
                      sx={{ ...editableFieldSx, ...standardFieldSx }}
                      fullWidth
                    />
                  </div>
                  <div className="col-12 md:col-6">
                    <TextField
                      size="small"
                      label="Role"
                      value={profile.role}
                      InputProps={{ readOnly: true }}
                      className="postLogin readOnly"
                      sx={{ ...editableFieldSx, ...standardFieldSx }}
                      fullWidth
                    />
                  </div>
                  <div className="col-12 md:col-6">
                    <TextField
                      size="small"
                      label="Registration Date"
                      value="-"
                      InputProps={{ readOnly: true }}
                      className="postLogin readOnly"
                      sx={{ ...editableFieldSx, ...standardFieldSx }}
                      fullWidth
                    />
                  </div>
                </div>
              </Stack>
            </Paper>
          ) : null}

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
              <Typography variant="h6">Security Settings</Typography>
              <Alert severity="info">Password and additional authentication controls can be managed from this section.</Alert>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={1.5}>
              <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 700, fontSize: "0.8rem" }}>
                Update your details and click Save Profile to apply changes.
              </Typography>

              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  sx={{
                    fontSize: POST_LOGIN_THEME.buttons.postLogin.fontSize,
                    px: POST_LOGIN_THEME.buttons.postLogin.padding.split(" ")[1],
                    height: POST_LOGIN_THEME.inputs.postLogin.height,
                    minHeight: POST_LOGIN_THEME.inputs.postLogin.height,
                  }}
                >
                  {saving ? "Saving..." : "Save Profile"}
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Stack>
      </Box>
    </Box>
  );
};

export default Profile;
