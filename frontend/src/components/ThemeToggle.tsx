/**
 * Theme Toggle Component
 *
 * Button to switch between light and dark mode for code blocks.
 */

import { useTheme } from "../contexts/ThemeContext";

export function ThemeToggle() {
  const { mode, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 12px",
        backgroundColor: mode === "dark" ? "#2d333b" : "#f6f8fa",
        color: mode === "dark" ? "#e6edf3" : "#24292f",
        border: "1px solid",
        borderColor: mode === "dark" ? "#444c56" : "#d0d7de",
        borderRadius: "6px",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 500,
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor =
          mode === "dark" ? "#373e47" : "#f3f4f6";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor =
          mode === "dark" ? "#2d333b" : "#f6f8fa";
      }}
      title={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
    >
      {mode === "light" ? (
        <>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM8 0a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0V.75A.75.75 0 0 1 8 0zm0 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 8 13zM2.343 2.343a.75.75 0 0 1 1.061 0l1.06 1.061a.75.75 0 0 1-1.06 1.06l-1.06-1.06a.75.75 0 0 1 0-1.06zm9.193 9.193a.75.75 0 0 1 1.06 0l1.061 1.06a.75.75 0 0 1-1.06 1.061l-1.061-1.06a.75.75 0 0 1 0-1.061zM16 8a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 16 8zM3 8a.75.75 0 0 1-.75.75H.75a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 3 8zm10.657-5.657a.75.75 0 0 1 0 1.061l-1.061 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.061 0zm-9.193 9.193a.75.75 0 0 1 0 1.06l-1.06 1.061a.75.75 0 0 1-1.061-1.06l1.06-1.061a.75.75 0 0 1 1.061 0z" />
          </svg>
        </>
      ) : (
        <>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M9.598 1.591a.75.75 0 0 1 .785-.175 7 7 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786zm1.616 1.945a7 7 0 0 1-7.678 7.678 5.5 5.5 0 1 0 7.678-7.678z" />
          </svg>
        </>
      )}
    </button>
  );
}
