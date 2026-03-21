import { create } from "zustand";

export type ThemePreference = "light" | "dark";

export type UserData = {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  role?: string;
  theme_preference?: ThemePreference;
  [key: string]: unknown;
};

type UserStoreState = {
  token: string | null;
  user: UserData | null;
  isAuthenticated: boolean;
  themePreference: ThemePreference;
};

type UserStoreActions = {
  login: (token: string, user: UserData) => void;
  logout: () => void;
  updateUser: (user: UserData) => void;
  setThemePreference: (themePreference: ThemePreference) => void;
};

export type UserStore = UserStoreState & UserStoreActions;

const TOKEN_KEY = "access_token";
const LEGACY_TOKEN_KEY = "jwt_token";
const THEME_PREFERENCE_KEY = "assetlife-theme-mode";

const persistedToken = localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);
const persistedThemePreference: ThemePreference = localStorage.getItem(THEME_PREFERENCE_KEY) === "dark" ? "dark" : "light";

if (!localStorage.getItem(TOKEN_KEY) && persistedToken) {
  localStorage.setItem(TOKEN_KEY, persistedToken);
}

const useUserStore = create<UserStore>((set) => ({
  token: persistedToken,
  user: null,
  isAuthenticated: Boolean(persistedToken),
  themePreference: persistedThemePreference,
  login: (token, user) => {
    const storedThemePreference: ThemePreference = localStorage.getItem(THEME_PREFERENCE_KEY) === "dark" ? "dark" : "light";
    const nextThemePreference: ThemePreference = user.theme_preference === "dark" ? "dark" : storedThemePreference;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.setItem(THEME_PREFERENCE_KEY, nextThemePreference);
    set({
      token,
      user: {
        ...user,
        theme_preference: nextThemePreference,
      },
      isAuthenticated: true,
      themePreference: nextThemePreference,
    });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    set({
      token: null,
      user: null,
      isAuthenticated: false,
    });
  },
  updateUser: (user) => {
    set((state) => {
      const nextThemePreference: ThemePreference = user.theme_preference === "dark"
        ? "dark"
        : user.theme_preference === "light"
          ? "light"
          : state.themePreference;
      localStorage.setItem(THEME_PREFERENCE_KEY, nextThemePreference);
      return {
        user: {
          ...(state.user ?? {}),
          ...user,
          theme_preference: nextThemePreference,
        },
        themePreference: nextThemePreference,
      };
    });
  },
  setThemePreference: (themePreference) => {
    localStorage.setItem(THEME_PREFERENCE_KEY, themePreference);
    set((state) => ({
      themePreference,
      user: state.user
        ? {
            ...state.user,
            theme_preference: themePreference,
          }
        : state.user,
    }));
  },
}));

export default useUserStore;
