"use client";

import { isNativeApp } from "@/lib/native-photo";
import { useLayoutEffect } from "react";

/** Marks the document so CSS can lift buttons above Android system navigation. */
export function NativeSafeArea() {
  useLayoutEffect(() => {
    if (!isNativeApp()) return;
    document.documentElement.classList.add("native-app");
    return () => document.documentElement.classList.remove("native-app");
  }, []);
  return null;
}
