import { SUBLINKS_CONFIG } from "@/configs/sublinks-config";
import {
  importProfile,
  getProfiles,
  patchProfilesConfig,
  enhanceProfiles,
  deleteProfile,
  patchProfile,
} from "@/services/cmds";
import { showNotice } from "@/services/notice-service";

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
      headers: {
        "Content-Type": "application/json",
      },
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
  } catch (error) {
    console.error("[SubLinks Service] Failed to refresh token:", error);
    return false;
  }
};

export const syncSubLinksSubscriptions = async (options?: {
  onProgress?: (status: string) => void;
  silent?: boolean;
}) => {
  const { onProgress, silent } = options || {};
  let token = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN);
  const userStr = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.USER);

  if (!token || !userStr || token === "undefined") {
    console.error("[SubLinks Service] No valid token or user found for sync", {
      hasToken: !!token,
      tokenVal: token,
    });
    return;
  }

  // Sanitize token
  token = token.trim();
  if (token.startsWith('"') && token.endsWith('"')) {
    token = token.slice(1, -1);
  }

  onProgress?.("正在获取订阅列表...");
  const apiUrl = SUBLINKS_CONFIG.DEFAULT_API_URL;
  const baseUrl = apiUrl.replace(/\/$/, "");

  try {
    const [subResponse, profilesConfig] = await Promise.all([
      fetch(`${baseUrl}/api/client/subscriptions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "User-Agent": "sublinks-client",
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
              "User-Agent": "sublinks-client",
            },
          });
        }
      }

      // If still 401 after refresh attempt, logout
      if (!finalResponse.ok && finalResponse.status === 401) {
        console.warn(
          "[SubLinks Service] Session expired after refresh attempt, logging out...",
        );
        showNotice("error", "登录已过期，请重新登录");
        await logoutSubLinks();
        return false;
      }
    }

    if (!finalResponse.ok) {
      const errorData = await finalResponse.json().catch(() => ({}));
      throw new Error(
        errorData.message || `请求失败 (${finalResponse.status})`,
      );
    }

    const subData = await finalResponse.json();
    const serverSubs = subData.subscriptions || [];
    const serverUrls = new Set(
      serverSubs.map((s: any) => s.url).filter(Boolean),
    );

    // 1. Pruning: Remove local profiles that are no longer on the server
    let deletedCount = 0;
    if (profilesConfig?.items) {
      for (const profile of profilesConfig.items) {
        // We only prune profiles that have a URL (indicating they are managed subscriptions)
        // and whose URL is NOT in the server's list.
        if (profile.url && !serverUrls.has(profile.url)) {
          try {
            await deleteProfile(profile.uid);
            console.log(
              `[SubLinks Service] Pruned deleted profile: ${profile.name} (${profile.uid})`,
            );
            deletedCount++;
          } catch (delErr) {
            console.error(
              `[SubLinks Service] Failed to delete orphaned profile ${profile.name}`,
              delErr,
            );
          }
        }
      }
    }

    // 2. Importing & Updating: Add new or update existing subscriptions
    const existingUrlMap = new Map<string, IProfileItem>(
      (profilesConfig?.items
        ?.map((p: any) => [p.url, p])
        .filter(([url]: any) => !!url) as any) || [],
    );
    let importedCount = 0;
    let renamedCount = 0;

    const total = serverSubs.length;
    let currentIdx = 0;
    for (const sub of serverSubs) {
      currentIdx++;
      onProgress?.(`正在处理订阅 [${currentIdx}/${total}]: ${sub.name}`);
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
      onProgress?.("正在激活配置并启动内核...");
      try {
        // This triggers CoreManager::global().update_config() in the backend
        await patchProfilesConfig({ current: targetUid });
        console.log(`[SubLinks Service] Activated profile: ${targetUid}`);
      } catch (pErr) {
        console.error(
          "[SubLinks Service] Failed to activate profile via patchProfilesConfig",
          pErr,
        );
        // Fallback to enhanceProfiles if patch fails
        await enhanceProfiles();
      }
    }

    if (!silent) {
      if (importedCount > 0 || deletedCount > 0 || renamedCount > 0) {
        const msg = `成功从 SubLinks 同步：`;
        const details = [];
        if (importedCount > 0) details.push(`新增 ${importedCount} 个`);
        if (renamedCount > 0) details.push(`更新 ${renamedCount} 个`);
        if (deletedCount > 0) details.push(`删除 ${deletedCount} 个`);
        showNotice.success(msg + details.join("、"));
      } else if (onProgress) {
        showNotice.info("SubLinks 订阅已是最新状态");
      }
    }

    onProgress?.("同步完成");
    return true;
  } catch (err: any) {
    console.error("[SubLinks Service] Failed to sync subscriptions", err);
    if (!silent) {
      showNotice.error(
        `同步 SubLinks 订阅失败: ${err.message || "网络错误或服务器无响应"}`,
      );
    }
    return false;
  }
};

export const logoutSubLinks = async () => {
  // Clear auth data immediately
  localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN);
  localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.USER);

  try {
    const profilesData = await getProfiles();

    // Delete all profile files in parallel
    if (profilesData?.items && profilesData.items.length > 0) {
      await Promise.all(
        profilesData.items.map((item) =>
          deleteProfile(item.uid).catch((e) =>
            console.error(
              `[SubLinks Service] Failed to delete profile ${item.uid}`,
              e,
            ),
          ),
        ),
      );
      console.log(
        `[SubLinks Service] Deleted ${profilesData.items.length} profile files`,
      );
    }

    // Clear the profile list (now patch_config will actually clear items)
    await patchProfilesConfig({ items: [], current: undefined });
    console.log("[SubLinks Service] Cleared all profiles from config");
  } catch (err) {
    console.error("[SubLinks Service] Error during logout cleanup", err);
  }

  // Show notification before reload
  showNotice("success", "已登出"); // Note: Text will be managed by caller or hardcoded for now inside service

  // Trigger auth change event for seamless logout
  window.dispatchEvent(new Event("sublinks-auth-change"));
};
