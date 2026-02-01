/**
 * SharingSettings Component
 *
 * Modal for configuring document sharing settings.
 * Only visible to document owners on the private domain.
 */

import { useState, useEffect } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { getPublicDomain } from "../lib/PhoenixProvider";

export type SharingMode = "only_me" | "specific_people" | "authenticated_users" | "public";

export interface SharingSettings {
  sharingMode: SharingMode;
  allowedEmails: string[];
  ownerEmail?: string;
}

interface SharingSettingsProps {
  docId: string;
  isOpen: boolean;
  onClose: () => void;
  settings: SharingSettings;
  onSave: (settings: SharingSettings) => Promise<void>;
}

const SHARING_OPTIONS: { value: SharingMode; label: string; description: string }[] = [
  {
    value: "only_me",
    label: "Only me",
    description: "Only you can access this document",
  },
  {
    value: "specific_people",
    label: "Specific people",
    description: "Only people you specify can access",
  },
  {
    value: "authenticated_users",
    label: "Anyone with Cloudflare access",
    description: "Anyone authenticated through Cloudflare can access",
  },
  {
    value: "public",
    label: "Public",
    description: "Anyone with the link can access (also available on markdoc.live)",
  },
];

export function SharingSettings({
  docId,
  isOpen,
  onClose,
  settings,
  onSave,
}: SharingSettingsProps) {
  const { mode } = useTheme();
  const [sharingMode, setSharingMode] = useState<SharingMode>(settings.sharingMode || "only_me");
  const [emailInput, setEmailInput] = useState("");
  const [allowedEmails, setAllowedEmails] = useState<string[]>(settings.allowedEmails || []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Update local state when settings change
  useEffect(() => {
    setSharingMode(settings.sharingMode || "only_me");
    setAllowedEmails(settings.allowedEmails || []);
  }, [settings]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await onSave({
        sharingMode,
        allowedEmails,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddEmail = () => {
    const email = emailInput.trim().toLowerCase();
    if (email && isValidEmail(email) && !allowedEmails.includes(email)) {
      if (allowedEmails.length >= 50) {
        setError("Maximum of 50 emails allowed");
        return;
      }
      setAllowedEmails([...allowedEmails, email]);
      setEmailInput("");
      setError(null);
    } else if (email && !isValidEmail(email)) {
      setError("Please enter a valid email address");
    }
  };

  const handleRemoveEmail = (email: string) => {
    setAllowedEmails(allowedEmails.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleCopyLink = async () => {
    const publicDomain = getPublicDomain();
    const url = `https://${publicDomain}/${docId}`;

    try {
      await navigator.clipboard.writeText(url);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isDark = mode === "dark";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 2000,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: isDark ? "#1c1c1c" : "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.24)",
          padding: "24px",
          width: "min(480px, 90vw)",
          maxHeight: "90vh",
          overflowY: "auto",
          zIndex: 2001,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
              color: isDark ? "#e6edf3" : "#1a1a1a",
            }}
          >
            Share Document
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "20px",
              cursor: "pointer",
              color: isDark ? "#8b949e" : "#666",
              padding: "4px",
            }}
          >
            x
          </button>
        </div>

        {/* Copy Link Section */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            marginBottom: "24px",
          }}
        >
          <input
            type="text"
            readOnly
            value={`https://${getPublicDomain()}/${docId}`}
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "6px",
              border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`,
              backgroundColor: isDark ? "#21262d" : "#f6f8fa",
              color: isDark ? "#e6edf3" : "#1a1a1a",
              fontSize: "14px",
            }}
          />
          <button
            onClick={handleCopyLink}
            style={{
              padding: "10px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: copySuccess ? "#2da44e" : "#646cff",
              color: "white",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {copySuccess ? "Copied!" : "Copy Link"}
          </button>
        </div>

        {/* Sharing Mode Options */}
        <div style={{ marginBottom: "20px" }}>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: 500,
              color: isDark ? "#e6edf3" : "#1a1a1a",
              marginBottom: "12px",
            }}
          >
            Who can access
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {SHARING_OPTIONS.map((option) => (
              <label
                key={option.value}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  padding: "12px",
                  borderRadius: "8px",
                  border: `1px solid ${
                    sharingMode === option.value
                      ? "#646cff"
                      : isDark
                      ? "#30363d"
                      : "#d0d7de"
                  }`,
                  backgroundColor:
                    sharingMode === option.value
                      ? isDark
                        ? "rgba(100, 108, 255, 0.1)"
                        : "rgba(100, 108, 255, 0.05)"
                      : "transparent",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="sharing_mode"
                  value={option.value}
                  checked={sharingMode === option.value}
                  onChange={() => setSharingMode(option.value)}
                  style={{ marginTop: "2px" }}
                />
                <div>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 500,
                      color: isDark ? "#e6edf3" : "#1a1a1a",
                    }}
                  >
                    {option.label}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: isDark ? "#8b949e" : "#666",
                      marginTop: "2px",
                    }}
                  >
                    {option.description}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Specific People Email List */}
        {sharingMode === "specific_people" && (
          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "14px",
                fontWeight: 500,
                color: isDark ? "#e6edf3" : "#1a1a1a",
                marginBottom: "8px",
              }}
            >
              Add people by email
            </label>
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter email address"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  borderRadius: "6px",
                  border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`,
                  backgroundColor: isDark ? "#21262d" : "#ffffff",
                  color: isDark ? "#e6edf3" : "#1a1a1a",
                  fontSize: "14px",
                }}
              />
              <button
                onClick={handleAddEmail}
                style={{
                  padding: "10px 16px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#646cff",
                  color: "white",
                  fontSize: "14px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Add
              </button>
            </div>

            {/* Email List */}
            {allowedEmails.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                {allowedEmails.map((email) => (
                  <div
                    key={email}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 10px",
                      borderRadius: "16px",
                      backgroundColor: isDark ? "#21262d" : "#f6f8fa",
                      border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`,
                      fontSize: "13px",
                      color: isDark ? "#e6edf3" : "#1a1a1a",
                    }}
                  >
                    {email}
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: isDark ? "#8b949e" : "#666",
                        padding: "0",
                        fontSize: "14px",
                        lineHeight: 1,
                      }}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "6px",
              backgroundColor: isDark ? "rgba(248, 81, 73, 0.1)" : "#fff5f5",
              border: "1px solid #f85149",
              color: "#f85149",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "12px",
            marginTop: "24px",
            paddingTop: "16px",
            borderTop: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: `1px solid ${isDark ? "#30363d" : "#d0d7de"}`,
              backgroundColor: "transparent",
              color: isDark ? "#e6edf3" : "#1a1a1a",
              fontSize: "14px",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: isSaving ? "#4a4a4a" : "#646cff",
              color: "white",
              fontSize: "14px",
              fontWeight: 500,
              cursor: isSaving ? "not-allowed" : "pointer",
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
