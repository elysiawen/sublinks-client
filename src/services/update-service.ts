import i18n from "@/services/i18n";
import { showNotice } from "@/services/notice-service";
import getSystem from "@/utils/get-system";
const currentVersion = import.meta.env.APP_VERSION;

// Env vars
const UPDATE_API_URL = import.meta.env.UPDATE_API_URL;
const UPDATE_APP_NAME = import.meta.env.UPDATE_APP_NAME;

export interface IUpdateInfo {
  version: {
    id: string;
    app: string;
    platform: string;
    arch: string;
    buildType: string;
    version: string;
    fileName: string;
    fileSize: number;
    checksum: string;
    uploadedAt: string;
    r2Key: string;
  };
  downloadUrl: string;
  expiresIn: number;
  note: string;
}

/**
 * Compare two semantic version strings.
 * Returns:
 *   1 if v1 > v2
 *   -1 if v1 < v2
 *   0 if v1 === v2
 */
const compareVersions = (v1: string, v2: string): number => {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  const len = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
};

/**
 * Get current architecture.
 * Since we don't have @tauri-apps/plugin-os installed, we use navigator.userAgent
 */
const getArch = (): string => {
  const ua = navigator.userAgent;
  if (/ARM64|aarch64/i.test(ua)) return "arm64";
  return "x64"; // Default to x64 for desktop if not ARM
};

export const getUpdateInfo = async (): Promise<
  (IUpdateInfo & { available: boolean }) | null
> => {
  const updateEnabled = import.meta.env.UPDATE_ENABLED === "true";
  if (!updateEnabled) return null;

  if (!UPDATE_API_URL || !UPDATE_APP_NAME) {
    // Silent failure for background check
    return null;
  }

  const platform = getSystem(); // windows, macos, linux
  const arch = getArch();
  const buildType = "release";

  // Construct URL
  const baseUrlStr = UPDATE_API_URL.endsWith("/")
    ? UPDATE_API_URL.slice(0, -1)
    : UPDATE_API_URL;
  const url = new URL(`${baseUrlStr}/api/download/latest`);
  url.searchParams.append("app", UPDATE_APP_NAME);
  url.searchParams.append("platform", platform);
  url.searchParams.append("arch", arch);
  url.searchParams.append("buildType", buildType);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data: IUpdateInfo = await response.json();
    const remoteVersion = data.version.version;

    const cmp = compareVersions(remoteVersion, currentVersion);

    if (cmp > 0) {
      return { ...data, available: true };
    }
    return null;
  } catch (error: any) {
    console.error("[Update] Failed to get update info:", error);
    // Rethrow to allow checkUpdate to differentiate
    throw error;
  }
};

export const checkUpdate = async (): Promise<IUpdateInfo | null> => {
  const updateEnabled = import.meta.env.UPDATE_ENABLED === "true";
  if (!updateEnabled) return null;

  if (!UPDATE_API_URL || !UPDATE_APP_NAME) {
    showNotice.error("UPDATE_API_URL / UPDATE_APP_NAME is not defined");
    return null;
  }

  showNotice.info(
    i18n.t("settings.components.verge.advanced.notifications.checking" as any),
    2000,
  );

  try {
    const info = await getUpdateInfo();

    if (info) {
      showNotice.success(
        i18n.t(
          "settings.components.verge.advanced.notifications.newVersion" as any,
          { version: `v${info.version.version}` },
        ) as string,
        5000,
      );
      return info;
    } else {
      showNotice.info(
        i18n.t(
          "settings.components.verge.advanced.notifications.latestVersion" as any,
        ),
      );
      return null;
    }
  } catch (ignore) {
    showNotice.error(
      i18n.t("settings.components.verge.advanced.notifications.failed" as any),
    );
    return null;
  }
};
