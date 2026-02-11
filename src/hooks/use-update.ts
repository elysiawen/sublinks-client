import useSWR, { SWRConfiguration } from "swr";

import { getUpdateInfo } from "@/services/update-service";

import { useVerge } from "./use-verge";

export const useUpdate = (
  enabled: boolean = true,
  options?: SWRConfiguration,
) => {
  const { verge } = useVerge();
  const { auto_check_update } = verge || {};

  // Determine if we should check for updates
  // If enabled is explicitly false, don't check
  // Otherwise, respect the auto_check_update setting (or default to true if null/undefined for manual triggers)
  const updateEnabled = import.meta.env.UPDATE_ENABLED === "true";
  const shouldCheck = enabled && updateEnabled && auto_check_update !== false;

  const {
    data: updateInfo,
    mutate: checkUpdate,
    isValidating,
  } = useSWR(shouldCheck ? "checkUpdate" : null, getUpdateInfo, {
    errorRetryCount: 2,
    revalidateIfStale: false,
    revalidateOnFocus: false,
    focusThrottleInterval: 36e5, // 1 hour
    refreshInterval: 24 * 60 * 60 * 1000, // 24 hours
    dedupingInterval: 60 * 60 * 1000, // 1 hour
    ...options,
  });

  return {
    updateInfo,
    checkUpdate,
    loading: isValidating,
  };
};
