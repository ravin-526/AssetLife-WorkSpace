import { create } from "zustand";

export type UserData = {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
};

type UserStoreState = {
  token: string | null;
  user: UserData | null;
  isAuthenticated: boolean;
};

type UserStoreActions = {
  login: (token: string, user: UserData) => void;
  logout: () => void;
  updateUser: (user: UserData) => void;
};

export type UserStore = UserStoreState & UserStoreActions;

const TOKEN_KEY = "access_token";
const LEGACY_TOKEN_KEY = "jwt_token";

const persistedToken = localStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(LEGACY_TOKEN_KEY);

if (!localStorage.getItem(TOKEN_KEY) && persistedToken) {
  localStorage.setItem(TOKEN_KEY, persistedToken);
}

const useUserStore = create<UserStore>((set) => ({
  token: persistedToken,
  user: null,
  isAuthenticated: Boolean(persistedToken),
  login: (token, user) => {
    console.log(`JWT Token: ${token}`);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    set({
      token,
      user,
      isAuthenticated: true,
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
    set((state) => ({
      user: {
        ...(state.user ?? {}),
        ...user,
      },
    }));
  },
}));

export default useUserStore;
