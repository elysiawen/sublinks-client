import { jwtDecode } from "jwt-decode";

import { SUBLINKS_CONFIG } from "@/configs/sublinks-config";
import {
  importProfile,
  getProfiles,
  patchProfilesConfig,
  enhanceProfiles,
  deleteProfile,
  patchProfile,
} from "@/services/cmds";
import i18n from "@/services/i18n";
import { showNotice } from "@/services/notice-service";
import getSystem from "@/utils/get-system";

// Dynamic version from vite env
const APP_VERSION = import.meta.env.APP_VERSION || "1.0.0";
export const USER_AGENT = `SubLinks Client Desktop/${APP_VERSION} (${getSystem()})`;

/**
 * Map the current i18n language to an Accept-Language header value.
 * The server parses the first language tag before the comma (e.g. zh-CN → zh).
 */
const getAcceptLanguage = (): string => {
  const lang = i18n.language || "zh";
  if (lang === "zhtw") return "zh-TW";
  return lang;
};

export const apiHeaders = (): Record<string, string> => ({
  "Content-Type": "application/json",
  "User-Agent": USER_AGENT,
  "Accept-Language": getAcceptLanguage(),
});

// Global flag to prevent concurrent syncs (login sync vs auto-sync)
let syncInProgress = false;
export const isSyncInProgress = () => syncInProgress;

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (): Promise<boolean> => {
  const refreshToken = localStorage.getItem(
    SUBLINKS_CONFIG.STORAGE_KEYS.REFRESH_TOKEN,
  );

  if (!refreshToken) {
    console.warn("[SubLinks Service] No refresh token found");
    return false;
  }

  const apiUrl = SUBLINKS_CONFIG.DEFAULT_API_URL;
  const baseUrl = apiUrl.replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/api/client/auth/refresh`, {
      method: "POST",
      headers: apiHeaders(),
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      console.warn("[SubLinks Service] Refresh token expired or invalid");
      return false;
    }

    const data = await response.json();
    const newAccessToken = data.accessToken || data.access_token;

    if (newAccessToken) {
      localStorage.setItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN, newAccessToken);
      console.log("[SubLinks Service] Access token refreshed successfully");
      return true;
    }

    return false;
  } catch (error: any) {
    console.error("[SubLinks Service] Failed to refresh token:", error);
    showNotice.error(
      `${i18n.t("settings.components.verge.advanced.notifications.refreshTokenFailed" as any)}: ${error.message || i18n.t("layout.notifications.syncNetworkError" as any)}`,
    );
    return false;
  }
};

/**
 * Check if access token is expiring (or expired) and refresh it proactively.
 * Threshold: 5 minutes (300 seconds)
 */
const checkAndRefreshAccessToken = async () => {
  const token = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN);
  if (!token) return;

  try {
    const decoded: any = jwtDecode(token);
    const exp = decoded.exp;
    if (!exp) return;

    // exp is in seconds, Date.now() is in ms
    const now = Date.now() / 1000;
    const threshold = 300; // 5 minutes

    const timeLeft = exp - now;

    if (timeLeft < threshold) {
      console.log(
        `[SubLinks Service] Token expiring in ${timeLeft.toFixed(0)}s (threshold ${threshold}s), refreshing proactively...`,
      );
      await refreshAccessToken();
    } else {
      // debug log can be removed later
      // console.log(`[SubLinks Service] Token valid for ${(timeLeft / 60).toFixed(1)} min`);
    }
  } catch (error) {
    console.warn("[SubLinks Service] Failed to decode token for check:", error);
  }
};

export const syncSubLinksSubscriptions = async (options?: {
  onProgress?: (status: string) => void;
}) => {
  // Prevent concurrent syncs
  if (syncInProgress) {
    console.log("[SubLinks Service] Sync already in progress, skipping");
    return false;
  }

  syncInProgress = true;
  const { onProgress } = options || {};

  try {
    // Proactive Token Refresh
    await checkAndRefreshAccessToken();

    let token = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN);
    const userStr = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.USER);

    if (!token || !userStr || token === "undefined") {
      console.error(
        "[SubLinks Service] No valid token or user found for sync",
        {
          hasToken: !!token,
          tokenVal: token,
        },
      );
      return false;
    }

    // Sanitize token
    token = token.trim();
    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1);
    }

    onProgress?.(i18n.t("layout.notifications.syncFetchingSubs" as any));
    const apiUrl = SUBLINKS_CONFIG.DEFAULT_API_URL;
    const baseUrl = apiUrl.replace(/\/$/, "");

    const [subResponse, profilesConfig] = await Promise.all([
      fetch(`${baseUrl}/api/client/subscriptions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...apiHeaders(),
        },
      }),
      getProfiles(),
    ]);

    // Handle 401 with token refresh and retry
    let finalResponse = subResponse;
    if (!subResponse.ok && subResponse.status === 401) {
      console.log("[SubLinks Service] Token expired, attempting refresh...");
      const refreshed = await refreshAccessToken();

      if (refreshed) {
        // Retry with new token
        const newToken = localStorage.getItem(
          SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN,
        );
        if (newToken) {
          finalResponse = await fetch(`${baseUrl}/api/client/subscriptions`, {
            headers: {
              Authorization: `Bearer ${newToken}`,
              ...apiHeaders(),
            },
          });
        }
      }

      // If still 401 after refresh attempt, logout
      if (!finalResponse.ok && finalResponse.status === 401) {
        console.warn(
          "[SubLinks Service] Session expired after refresh attempt, logging out...",
        );
        const errData = await finalResponse.json().catch(() => ({}));
        const sessionMsg =
          errData.message ||
          i18n.t("layout.api.messages.sessionExpired" as any);
        showNotice("error", sessionMsg);
        await logoutSubLinks(sessionMsg);
        return false;
      }
    }

    if (!finalResponse.ok) {
      const errorData = await finalResponse.json().catch(() => ({}));
      throw new Error(
        (errorData.message ?? errorData.error) ||
          i18n.t("layout.notifications.loginRequestFailed" as any, {
            status: finalResponse.status,
            text: "",
          }),
      );
    }

    const subData = await finalResponse.json();
    const serverSubs = subData.subscriptions || [];

    // 1. Pruning: Remove profiles that no longer exist on the server
    const serverUrlSet = new Set(serverSubs.map((s: any) => s.url));
    const orphanedProfiles = (profilesConfig?.items || []).filter(
      (p: any) => p.url && !serverUrlSet.has(p.url),
    );
    let deletedCount = 0;

    if (orphanedProfiles.length > 0) {
      // Deactivate current profile first to prevent core restarts on each delete
      if (profilesConfig?.current) {
        await patchProfilesConfig({ current: undefined }).catch(() => {});
      }
      for (const orphan of orphanedProfiles) {
        try {
          await deleteProfile(orphan.uid);
          console.log(
            `[SubLinks Service] Deleted orphaned profile: ${orphan.name}`,
          );
          deletedCount++;
        } catch (e) {
          console.error(
            `[SubLinks Service] Failed to delete profile ${orphan.uid}`,
            e,
          );
        }
      }
    }

    // 2. Importing & Updating: Add new or update existing subscriptions
    const existingUrlMap = new Map<string, IProfileItem>(
      (profilesConfig?.items
        ?.map((p: any) => [p.url, p])
        .filter(([url]: any) => !!url && serverUrlSet.has(url)) as any) || [],
    );
    let importedCount = 0;
    let renamedCount = 0;

    const total = serverSubs.length;
    let currentIdx = 0;
    for (const sub of serverSubs) {
      currentIdx++;
      onProgress?.(
        i18n.t("layout.notifications.syncProcessingSub" as any, {
          current: currentIdx,
          total,
          name: sub.name,
        }),
      );
      try {
        const existing = existingUrlMap.get(sub.url) as
          | IProfileItem
          | undefined;
        if (!existing) {
          await importProfile(sub.url, sub.name);
          console.log(`[SubLinks Service] Imported profile: ${sub.name}`);
          importedCount++;
        } else {
          // Check if name needs update
          if (existing.name !== sub.name) {
            await patchProfile(existing.uid, { name: sub.name });
            console.log(
              `[SubLinks Service] Updated profile name: ${existing.name} -> ${sub.name}`,
            );
            renamedCount++;
          } else {
            console.log(
              `[SubLinks Service] Skipping duplicate profile: ${sub.name}`,
            );
          }
        }
      } catch (e) {
        console.error(
          `[SubLinks Service] Failed to process profile ${sub.name}`,
          e,
        );
      }
    }

    // Fetch profiles again to ensure we have the latest state from disk
    const finalProfiles = await getProfiles();
    if (finalProfiles?.items && finalProfiles.items.length > 0) {
      // Use existing current profile or fallback to the first one available
      const targetUid = finalProfiles.current || finalProfiles.items[0].uid;

      // Force activate the target profile.
      // Even if it's already "current", calling patchProfilesConfig will trigger
      // a core reload (update_config) which is necessary after initial import.
      onProgress?.(i18n.t("layout.notifications.syncActivating" as any));

      // Small delay to let core stabilize after imports
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Retry logic for patchProfilesConfig (handles optimistic lock Busy status)
      let activated = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = (await patchProfilesConfig({
            current: targetUid,
          })) as any;
          // Check if result indicates Busy (optimistic lock held)
          if (result && result.status === "Busy") {
            console.log(
              `[SubLinks Service] Profile switch busy, retrying (${attempt + 1}/3)...`,
            );
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
          }
          console.log(`[SubLinks Service] Activated profile: ${targetUid}`);
          activated = true;
          break;
        } catch (pErr) {
          console.error(
            "[SubLinks Service] Failed to activate profile via patchProfilesConfig",
            pErr,
          );
          if (attempt < 2) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      if (!activated) {
        // Fallback to enhanceProfiles if patch fails
        console.log("[SubLinks Service] Falling back to enhanceProfiles");
        await enhanceProfiles();
      }
    }

    if (importedCount > 0 || deletedCount > 0 || renamedCount > 0) {
      const details = [];
      if (importedCount > 0)
        details.push(
          i18n.t("layout.notifications.syncNewCount" as any, {
            count: importedCount,
          }),
        );
      if (renamedCount > 0)
        details.push(
          i18n.t("layout.notifications.syncUpdatedCount" as any, {
            count: renamedCount,
          }),
        );
      if (deletedCount > 0)
        details.push(
          i18n.t("layout.notifications.syncDeletedCount" as any, {
            count: deletedCount,
          }),
        );
      showNotice.success(
        i18n.t("layout.notifications.syncResult" as any, {
          details: details.join("、"),
        }),
      );
    } else {
      showNotice.info(i18n.t("layout.notifications.syncNoChanges" as any));
    }

    onProgress?.(i18n.t("layout.notifications.syncComplete" as any));
    return true;
  } catch (err: any) {
    console.error("[SubLinks Service] Failed to sync subscriptions", err);
    showNotice.error(
      err.message || i18n.t("layout.notifications.syncNetworkError" as any),
    );
    return false;
  } finally {
    syncInProgress = false;
  }
};

/**
 * Download and cache avatar as base64 data URL in localStorage.
 * Only re-downloads if the avatar URL has changed.
 */
const cacheAvatarIfChanged = async (avatarUrl: string | undefined) => {
  if (!avatarUrl) {
    // No avatar, clear cache
    localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.AVATAR_URL);
    localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.AVATAR_CACHE);
    return;
  }

  const cachedUrl = localStorage.getItem(
    SUBLINKS_CONFIG.STORAGE_KEYS.AVATAR_URL,
  );

  // Avatar URL hasn't changed, skip download
  if (cachedUrl === avatarUrl) return;

  try {
    const response = await fetch(avatarUrl);
    if (!response.ok) return;

    const blob = await response.blob();
    const reader = new FileReader();

    const base64 = await new Promise<string>((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    localStorage.setItem(SUBLINKS_CONFIG.STORAGE_KEYS.AVATAR_URL, avatarUrl);
    localStorage.setItem(SUBLINKS_CONFIG.STORAGE_KEYS.AVATAR_CACHE, base64);
    console.log("[SubLinks Service] Avatar cached successfully");
    // Trigger UI update
    window.dispatchEvent(new Event("sublinks-auth-change"));
  } catch (error) {
    console.warn("[SubLinks Service] Failed to cache avatar:", error);
  }
};

export const fetchSubLinksUserInfo = async () => {
  // Proactive Token Refresh
  await checkAndRefreshAccessToken();

  const token = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN);
  if (!token) return;

  const apiUrl = SUBLINKS_CONFIG.DEFAULT_API_URL;
  const baseUrl = apiUrl.replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/api/client/auth/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...apiHeaders(),
      },
    });

    // Check for 401 Unauthorized
    if (response.status === 401) {
      const errBody = await response.json().catch(() => ({}));
      console.warn("[SubLinks Service] User Info 401, attempting refresh...");
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        // Retry with new token
        const newToken = localStorage.getItem(
          SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN,
        );
        if (newToken) {
          const retryResponse = await fetch(`${baseUrl}/api/client/auth/user`, {
            headers: {
              Authorization: `Bearer ${newToken}`,
              ...apiHeaders(),
            },
          });
          if (retryResponse.ok) {
            const data = await retryResponse.json();
            const userObj = data.user || data;
            localStorage.setItem(
              SUBLINKS_CONFIG.STORAGE_KEYS.USER,
              JSON.stringify(userObj),
            );
            // Cache avatar if changed
            await cacheAvatarIfChanged(userObj.avatar);
            window.dispatchEvent(new Event("sublinks-auth-change"));
            return;
          }
        }
      }
      // If refresh failed or retry failed, force logout
      console.warn("[SubLinks Service] Refresh failed, logging out...");
      await logoutSubLinks(
        (errBody.message ?? errBody.error) ||
          i18n.t("layout.api.messages.sessionExpired" as any),
      );
      return;
    }

    if (response.ok) {
      const data = await response.json();
      // Logic from Android: if data has "user" field, use that; otherwise use data itself
      const userObj = data.user || data;
      localStorage.setItem(
        SUBLINKS_CONFIG.STORAGE_KEYS.USER,
        JSON.stringify(userObj),
      );
      // Cache avatar if changed
      await cacheAvatarIfChanged(userObj.avatar);
      // Trigger update
      window.dispatchEvent(new Event("sublinks-auth-change"));
    }
  } catch (error: any) {
    console.error("[SubLinks Service] Failed to fetch user info:", error);
    showNotice.error(
      `${i18n.t("settings.components.verge.advanced.notifications.fetchUserInfoFailed" as any)}: ${error.message || i18n.t("layout.notifications.syncNetworkError" as any)}`,
    );
  }
};

export const logoutSubLinks = async (
  reason?: string,
): Promise<{
  success: boolean;
  message?: string;
}> => {
  const refreshToken = localStorage.getItem(
    SUBLINKS_CONFIG.STORAGE_KEYS.REFRESH_TOKEN,
  );
  const apiUrl = SUBLINKS_CONFIG.DEFAULT_API_URL;
  const baseUrl = apiUrl.replace(/\/$/, "");

  // Save logout reason for Login page to display
  if (reason) {
    localStorage.setItem(SUBLINKS_CONFIG.STORAGE_KEYS.LOGOUT_REASON, reason);
  }

  let apiResult: { success: boolean; message?: string };

  // Call Logout API if possible
  if (refreshToken) {
    try {
      const response = await fetch(`${baseUrl}/api/client/auth/logout`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({ refreshToken }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok || data.success) {
        apiResult = {
          success: true,
          message:
            (data.message ?? data.error) ||
            i18n.t("layout.notifications.logoutSuccess" as any),
        };
      } else {
        apiResult = {
          success: false,
          message: (data.message ?? data.error) || `HTTP ${response.status}`,
        };
      }
    } catch (e: any) {
      console.error("[SubLinks Service] Logout API failed", e);
      apiResult = {
        success: false,
        message:
          e.message || i18n.t("layout.notifications.syncNetworkError" as any),
      };
    }
  } else {
    apiResult = {
      success: true,
      message: i18n.t("layout.notifications.loggedOutLocal" as any),
    };
  }

  // Clear auth data immediately
  localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN);
  localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.REFRESH_TOKEN); // Also clear refresh token
  localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.USER);
  localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.AVATAR_URL);
  localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.AVATAR_CACHE);

  try {
    const profilesData = await getProfiles();

    // First, deactivate current profile to prevent core restarts during deletion
    // (deleteProfile only triggers update_config_forced when deleting the CURRENT profile)
    if (profilesData?.items && profilesData.items.length > 0) {
      // Step 1: Clear current profile (triggers one core restart)
      await patchProfilesConfig({ current: undefined }).catch(() => {});

      // Step 2: Delete all profile files (no core restarts since no current profile)
      for (const item of profilesData.items) {
        try {
          await deleteProfile(item.uid);
        } catch (e) {
          console.error(
            `[SubLinks Service] Failed to delete profile ${item.uid}`,
            e,
          );
        }
      }
      console.log(
        `[SubLinks Service] Deleted ${profilesData.items.length} profile files`,
      );
    }

    // Step 3: Clear the profile list
    await patchProfilesConfig({ items: [], current: undefined });
    console.log("[SubLinks Service] Cleared all profiles from config");
  } catch (err) {
    console.error("[SubLinks Service] Error during logout cleanup", err);
  }

  // Trigger auth change event for seamless logout
  window.dispatchEvent(new Event("sublinks-auth-change"));

  return apiResult;
};
