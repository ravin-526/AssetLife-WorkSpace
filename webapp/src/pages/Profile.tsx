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
import { useTheme } from "@mui/material/styles";

import api from "../services/api.ts";
import useUserStore from "../store/userStore.ts";
import { DISABLED_FIELD, POST_LOGIN_THEME } from "../styles/theme";

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
  const muiTheme = useTheme();
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
  const disabledBackground =
    muiTheme.palette.mode === "light" ? DISABLED_FIELD.LIGHT_BACKGROUND : DISABLED_FIELD.DARK_BACKGROUND;

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
    "& .MuiInputLabel-root": {
      lineHeight: 1.2,
    },
    "& .MuiInputBase-root": {
      height: POST_LOGIN_THEME.inputs.postLogin.height,
      alignItems: "center",
      lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
      bgcolor: "background.paper",
    },
    "& .MuiInputBase-input": {
      fontSize: POST_LOGIN_THEME.inputs.postLogin.fontSize,
      lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
      padding: POST_LOGIN_THEME.inputs.postLogin.padding,
      height: POST_LOGIN_THEME.inputs.postLogin.height,
      boxSizing: POST_LOGIN_THEME.inputs.postLogin.boxSizing,
      width: POST_LOGIN_THEME.inputs.postLogin.width,
    },
    "& .MuiInputBase-input::placeholder": {
      fontSize: POST_LOGIN_THEME.inputs.postLogin.placeholderFontSize,
      lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
      opacity: 1,
    },
  };

  const readOnlyFieldSx = {
    ...editableFieldSx,
    "& .MuiInputBase-root": {
      ...editableFieldSx["& .MuiInputBase-root"],
      bgcolor: disabledBackground,
      color: DISABLED_FIELD.TEXT,
      cursor: POST_LOGIN_THEME.inputs.readOnly.cursor,
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: "divider",
      },
    },
    "& .MuiInputBase-input": {
      ...editableFieldSx["& .MuiInputBase-input"],
      color: DISABLED_FIELD.TEXT,
      WebkitTextFillColor: DISABLED_FIELD.TEXT,
      cursor: POST_LOGIN_THEME.inputs.readOnly.cursor,
    },
    "& .MuiInputBase-input::placeholder": {
      ...editableFieldSx["& .MuiInputBase-input::placeholder"],
      color: DISABLED_FIELD.TEXT,
      lineHeight: POST_LOGIN_THEME.inputs.postLogin.lineHeight,
    },
  };

  const nameReadOnly = !editing || saving;
  const emailReadOnly = !editing || saving || !isIndividual;

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Profile
      </Typography>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Stack sx={{ gap: POST_LOGIN_THEME.form.groupSpacing }}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {message ? <Alert severity="success">{message}</Alert> : null}

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              columnGap: 2,
              rowGap: POST_LOGIN_THEME.form.rowSpacing,
            }}
          >
            <Box>
              <TextField
                label="Name"
                value={editing ? draft.name : profile.name}
                onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                onFocus={handleFieldFocus}
                error={Boolean(errors.name)}
                helperText={errors.name}
                InputProps={{ readOnly: nameReadOnly }}
                sx={nameReadOnly ? readOnlyFieldSx : editableFieldSx}
                fullWidth
              />
            </Box>

            <Box>
              <TextField
                label="Email"
                value={editing ? draft.email : profile.email}
                onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
                onFocus={isIndividual ? handleFieldFocus : undefined}
                error={Boolean(errors.email)}
                helperText={errors.email}
                InputProps={{ readOnly: emailReadOnly }}
                sx={emailReadOnly ? readOnlyFieldSx : editableFieldSx}
                fullWidth
              />
            </Box>

            <Box>
              <TextField
                label="Phone"
                value={profile.phone}
                disabled
                sx={readOnlyFieldSx}
                fullWidth
              />
            </Box>

            {!isIndividual ? (
              <Box>
                <TextField
                  label="Organization"
                  value={editing ? draft.organization : profile.organization}
                  onChange={(event) => setDraft((prev) => ({ ...prev, organization: event.target.value }))}
                  InputProps={{ readOnly: true }}
                  sx={readOnlyFieldSx}
                  fullWidth
                />
              </Box>
            ) : null}

            <Box>
              <TextField label="Role" value={profile.role} disabled sx={readOnlyFieldSx} fullWidth />
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary" fontWeight={700} sx={{ mb: 1.5 }}>
            Edit the fields above and click Save Profile to update your profile.
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
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
          </Stack>
        </Stack>
      </Paper>
    </Box>
  );
};

export default Profile;
