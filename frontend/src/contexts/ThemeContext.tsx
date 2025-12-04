/**
 * Theme Context
 *
 * Manages dark/light mode for the entire application.
 * Stores preference in localStorage.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type ThemeMode = "light" | "dark";

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // Load from localStorage or default to light
    const stored = localStorage.getItem("markdoc-theme");
    return (stored === "dark" || stored === "light") ? stored : "light";
  });

  // Save to localStorage whenever mode changes
  useEffect(() => {
    localStorage.setItem("markdoc-theme", mode);
    // Update CSS variable for code block backgrounds
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
