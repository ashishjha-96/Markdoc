/**
 * NamePrompt Component
 *
 * Modal dialog to collect user's name before joining the document.
 */

import { useState, type FormEvent } from "react";

interface NamePromptProps {
  onSubmit: (name: string) => void;
  docId: string;
}

export function NamePrompt({ onSubmit, docId }: NamePromptProps) {
  const [name, setName] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      onSubmit(trimmedName);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "32px",
          maxWidth: "400px",
          width: "90%",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
        }}
      >
        <h2
          style={{
            margin: "0 0 8px 0",
            fontSize: "24px",
            fontWeight: 600,
            color: "#1a1a1a",
          }}
        >
          Join Document
        </h2>
        <p
          style={{
            margin: "0 0 24px 0",
            color: "#666",
            fontSize: "14px",
          }}
        >
          You're joining:{" "}
          <code
            style={{
              background: "#f5f5f5",
              padding: "2px 6px",
              borderRadius: "3px",
              fontSize: "13px",
            }}
          >
            {docId}
          </code>
        </p>

        <form onSubmit={handleSubmit}>
          <label
            style={{
              display: "block",
              marginBottom: "8px",
              fontSize: "14px",
              fontWeight: 500,
              color: "#333",
            }}
          >
            Your Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            autoFocus
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: "15px",
              border: "1px solid #e0e0e0",
              borderRadius: "6px",
              outline: "none",
              transition: "border-color 0.2s",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "#646cff";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "#e0e0e0";
            }}
          />

          <button
            type="submit"
            disabled={!name.trim()}
            style={{
              marginTop: "20px",
              width: "100%",
              padding: "12px 24px",
              fontSize: "15px",
              fontWeight: 600,
              color: "white",
              backgroundColor: name.trim() ? "#646cff" : "#ccc",
              border: "none",
              borderRadius: "6px",
              cursor: name.trim() ? "pointer" : "not-allowed",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) => {
              if (name.trim()) {
                e.currentTarget.style.backgroundColor = "#535bf2";
              }
            }}
            onMouseLeave={(e) => {
              if (name.trim()) {
                e.currentTarget.style.backgroundColor = "#646cff";
              }
            }}
          >
            Join Document
          </button>
        </form>
      </div>
    </div>
  );
}
