/**
 * useSharingSettings Hook
 *
 * Hook for fetching and updating document sharing settings via the API.
 */

import { useState, useCallback, useEffect } from "react";
import type { SharingSettings } from "../components/SharingSettings";

interface UseSharingSettingsOptions {
  docId: string;
  isOwner: boolean;
  isPrivateDomain: boolean;
}

interface UseSharingSettingsResult {
  settings: SharingSettings;
  isLoading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  updateSettings: (newSettings: SharingSettings) => Promise<void>;
}

const DEFAULT_SETTINGS: SharingSettings = {
  sharingMode: "only_me",
  allowedEmails: [],
};

export function useSharingSettings({
  docId,
  isOwner,
  isPrivateDomain,
}: UseSharingSettingsOptions): UseSharingSettingsResult {
  const [settings, setSettings] = useState<SharingSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!isOwner || !isPrivateDomain) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/docs/${docId}/sharing`, {
        method: "GET",
        credentials: "include", // Include cookies for CF_Authorization
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.reason || "Failed to fetch sharing settings");
      }

      const data = await response.json();
      setSettings({
        sharingMode: data.sharing_mode || "only_me",
        allowedEmails: data.allowed_emails || [],
        ownerEmail: data.owner_email,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch settings";
      setError(message);
      console.error("Failed to fetch sharing settings:", err);
    } finally {
      setIsLoading(false);
    }
  }, [docId, isOwner, isPrivateDomain]);

  const updateSettings = useCallback(
    async (newSettings: SharingSettings) => {
      if (!isOwner || !isPrivateDomain) {
        throw new Error("You must be the document owner to update sharing settings");
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/docs/${docId}/sharing`, {
          method: "PUT",
          credentials: "include", // Include cookies for CF_Authorization
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sharing_mode: newSettings.sharingMode,
            allowed_emails: newSettings.allowedEmails,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.reason || "Failed to update sharing settings");
        }

        const data = await response.json();
        setSettings({
          sharingMode: data.sharing_mode || newSettings.sharingMode,
          allowedEmails: data.allowed_emails || newSettings.allowedEmails,
          ownerEmail: settings.ownerEmail,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update settings";
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [docId, isOwner, isPrivateDomain, settings.ownerEmail]
  );

  // Fetch settings when owner status is confirmed
  useEffect(() => {
    if (isOwner && isPrivateDomain) {
      fetchSettings();
    }
  }, [fetchSettings, isOwner, isPrivateDomain]);

  return {
    settings,
    isLoading,
    error,
    fetchSettings,
    updateSettings,
  };
}
