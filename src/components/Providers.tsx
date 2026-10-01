"use client";

import { AuthProvider } from "./AuthProvider";
import { NativeSafeArea } from "./NativeSafeArea";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <NativeSafeArea />
      {children}
    </AuthProvider>
  );
}
