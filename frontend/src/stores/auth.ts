import { createContext, useContext } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "qa_engineer" | "viewer";
}

export interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  setUser: () => undefined,
});

export function useAuth() {
  return useContext(AuthContext);
}
