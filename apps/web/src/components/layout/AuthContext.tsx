'use client';

import React, { createContext, useContext } from 'react';

export interface ClientSessionUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
}

interface AuthContextType {
  user: ClientSessionUser | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  logout: async () => {},
});

export function AuthProvider({
  user,
  logout,
  children,
}: {
  user: ClientSessionUser | null;
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

