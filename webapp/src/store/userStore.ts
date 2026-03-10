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

const TOKEN_KEY = "jwt_token";

const persistedToken = localStorage.getItem(TOKEN_KEY);

const useUserStore = create<UserStore>((set) => ({
  token: persistedToken,
  user: null,
  isAuthenticated: Boolean(persistedToken),
  login: (token, user) => {
    localStorage.setItem(TOKEN_KEY, token);
    set({
      token,
      user,
      isAuthenticated: true,
    });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
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
