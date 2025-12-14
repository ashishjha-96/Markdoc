/**
 * Landing Component
 *
 * First screen shown when visiting root path '/'.
 * Collects username and redirects to a new document with random ID.
 */

import { useState, useEffect, type FormEvent } from "react";
import { generateDocId } from "../lib/generateDocId";

export function Landing() {
  const [name, setName] = useState("");

  // Pre-fill name from localStorage if exists
  useEffect(() => {
    const storedName = localStorage.getItem("markdoc-username");
    if (storedName) {
      setName(storedName);
    }
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName) {
      // Save username to localStorage
      localStorage.setItem("markdoc-username", trimmedName);

      // Generate random document ID
      const docId = generateDocId();

      // Redirect to new document
      window.location.pathname = `/${docId}`;
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#fafafa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="mobile-modal"
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "48px",
          maxWidth: "480px",
          width: "90%",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h1
          style={{
            margin: "0 0 12px 0",
            fontSize: "32px",
            fontWeight: 600,
            color: "#1a1a1a",
            textAlign: "center",
          }}
        >
          Welcome to Markdoc
        </h1>
        <p
          style={{
            margin: "0 0 32px 0",
            color: "#666",
            fontSize: "15px",
            textAlign: "center",
            lineHeight: "1.5",
          }}
        >
          A collaborative markdown editor for real-time team collaboration.
          <br />
          Create a new document to get started.
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
              marginTop: "24px",
              width: "100%",
              padding: "14px 24px",
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
            Create New Document
          </button>
        </form>
      </div>
    </div>
  );
}
