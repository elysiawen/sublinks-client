import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlineOutlined";
import KeyIcon from "@mui/icons-material/Key";
import LaunchIcon from "@mui/icons-material/Launch";
import OpenInBrowserIcon from "@mui/icons-material/OpenInBrowser";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
  alpha,
  keyframes,
} from "@mui/material";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";

// Pulse animation for waiting state
const pulse = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.8; }
  100% { transform: scale(1); opacity: 1; }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
`;

import logoIcon from "@/assets/image/logo.ico";
import { WindowControls } from "@/components/layout/window-controller";
import { SUBLINKS_CONFIG } from "@/configs/sublinks-config";
import { getSystemHostname, openWebUrl } from "@/services/cmds";
import { showNotice } from "@/services/notice-service";
// import { useThemeMode } from "@/services/states"; // This import is no longer needed if mode/isDark are removed
import {
  syncSubLinksSubscriptions,
  USER_AGENT,
  apiHeaders,
} from "@/services/sublinks-service";

const LoginPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  // const mode = useThemeMode(); // Removed as per instruction
  // const isDark = mode !== "light"; // Removed as per instruction
  const apiUrl = SUBLINKS_CONFIG.DEFAULT_API_URL;
  console.log("[Login] Using API URL:", apiUrl);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // 2FA states
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");

  // Login method: 'browser' or 'password'
  const [loginMethod, setLoginMethod] = useState<"browser" | "password">(
    "browser",
  );

  // Device auth states
  const [verificationUri, setVerificationUri] = useState("");
  const [deviceStatus, setDeviceStatus] = useState<
    "idle" | "waiting" | "expired" | "success" | "denied"
  >("idle");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiresAtRef = useRef<number>(0);

  useEffect(() => {
    const reason = localStorage.getItem(
      SUBLINKS_CONFIG.STORAGE_KEYS.LOGOUT_REASON,
    );
    if (reason) {
      if (
        reason.includes("expired") ||
        reason.includes("invalid") ||
        reason.includes("过期") ||
        reason.includes("失效")
      ) {
        showNotice("error", reason);
      } else {
        showNotice("success", reason);
      }
      localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.LOGOUT_REASON);
    }
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const handleDeviceAuthSuccess = useCallback(
    async (data: any) => {
      const token = data.accessToken;
      const refreshToken = data.refreshToken;

      if (!token) {
        console.error("[Login] No token found in device auth response", data);
        showNotice("error", t("layout.notifications.loginNoToken" as any));
        return;
      }

      // Save Token and Config
      localStorage.setItem(SUBLINKS_CONFIG.STORAGE_KEYS.API_URL, apiUrl);
      localStorage.setItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN, token);
      if (refreshToken) {
        localStorage.setItem(
          SUBLINKS_CONFIG.STORAGE_KEYS.REFRESH_TOKEN,
          refreshToken,
        );
      }
      localStorage.setItem(
        SUBLINKS_CONFIG.STORAGE_KEYS.USER,
        JSON.stringify(data.user),
      );

      setSyncStatus(t("layout.notifications.syncVerifying" as any));

      // Sync before reload to show progress
      await syncSubLinksSubscriptions({
        onProgress: (status) => {
          setSyncStatus(status);
        },
      });

      showNotice("success", t("layout.notifications.loginSuccess") as string);

      // Trigger auth change event for seamless login
      window.dispatchEvent(new Event("sublinks-auth-change"));
    },
    [apiUrl, t],
  );

  const startPolling = useCallback(
    (code: string, intervalSec: number) => {
      stopPolling();

      pollingRef.current = setInterval(async () => {
        // Check if expired
        if (Date.now() >= expiresAtRef.current) {
          stopPolling();
          setDeviceStatus("expired");
          return;
        }

        try {
          const response = await fetch(
            `${apiUrl}/api/client/auth/device/token`,
            {
              method: "POST",
              headers: apiHeaders(),
              body: JSON.stringify({ deviceCode: code }),
            },
          );

          const data = await response.json();

          if (response.ok && data.success) {
            // Success!
            stopPolling();
            setDeviceStatus("success");
            await handleDeviceAuthSuccess(data);
            return;
          }

          if (data.error === "authorization_pending") {
            // Continue waiting
            return;
          }

          // User denied authorization
          if (data.error === "authorization_denied") {
            stopPolling();
            setDeviceStatus("denied");
            return;
          }

          // Other errors (expired, invalid, etc.)
          if (data.error?.includes("expired")) {
            stopPolling();
            setDeviceStatus("expired");
            return;
          }

          // Unexpected error
          console.warn("[Login] Device auth polling error:", data.error);
        } catch (err) {
          console.warn("[Login] Device auth polling network error:", err);
        }
      }, intervalSec * 1000);
    },
    [apiUrl, stopPolling, handleDeviceAuthSuccess],
  );

  const startDeviceAuth = useCallback(async () => {
    setLoading(true);
    setDeviceStatus("idle");

    try {
      // Get device info (same as password login)
      let deviceInfo = USER_AGENT;
      try {
        const hostname = await getSystemHostname();
        if (hostname) {
          deviceInfo = hostname;
        }
      } catch (e) {
        console.warn("[Login] Failed to get hostname, using UA:", e);
      }

      const response = await fetch(
        `${apiUrl}/api/client/auth/device/authorize`,
        {
          method: "POST",
          headers: apiHeaders(),
          body: JSON.stringify({ deviceInfo }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle 429 Too Many Requests
        if (response.status === 429) {
          throw new Error(t("layout.notifications.deviceAuthTooMany" as any));
        }

        throw new Error(
          errorData.error ||
            t("layout.notifications.cannotConnectServer" as any),
        );
      }

      const data = await response.json();
      const {
        deviceCode: code,
        verificationUri: uri,
        expiresIn,
        interval,
      } = data;

      setVerificationUri(uri);
      setDeviceStatus("waiting");
      setLoading(false);

      // Open browser
      await openWebUrl(uri);

      // Start polling
      expiresAtRef.current = Date.now() + (expiresIn || 300) * 1000;
      startPolling(code, interval || 5);
    } catch (err: any) {
      setLoading(false);
      showNotice(
        "error",
        err.message || t("layout.notifications.cannotConnectServer" as any),
      );
    }
  }, [apiUrl, t, startPolling]);

  const copyVerificationUri = useCallback(() => {
    if (verificationUri) {
      navigator.clipboard.writeText(verificationUri).then(() => {
        showNotice(
          "success",
          t("layout.notifications.deviceAuthCopyLink" as any),
        );
      });
    }
  }, [verificationUri, t]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoading(true);

    try {
      let deviceInfo = USER_AGENT;
      try {
        const hostname = await getSystemHostname();
        if (hostname) {
          deviceInfo = hostname;
        }
      } catch (e) {
        console.warn("[Login] Failed to get hostname, using UA:", e);
      }

      const bodyPayload: any = { username, password, deviceInfo };
      if (requires2FA) {
        bodyPayload.code = twoFactorCode;
      }

      const response = await fetch(`${apiUrl}/api/client/auth/login`, {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify(bodyPayload),
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (!response.ok) {
          throw new Error(
            t("layout.notifications.loginRequestFailed" as any, {
              status: response.status,
              text,
            }),
          );
        }
        throw new Error(t("layout.notifications.serverInvalidResponse" as any));
      }

      if (!response.ok) {
        const serverMsg = data.message ?? data.error;
        const fallbackKey = (() => {
          switch (response.status) {
            case 400:
              return "layout.api.messages.usernameAndPasswordRequired";
            case 401:
              return "layout.api.messages.invalidCredentials";
            case 403:
              return "layout.api.messages.accountDisabled";
            default:
              return "layout.api.messages.serverError";
          }
        })();
        throw new Error(serverMsg || t(fallbackKey as any));
      }

      if (data.requires2FA) {
        setRequires2FA(true);
        const twoFAMsg = data.message ?? data.error;
        if (twoFAMsg) {
          showNotice("info", twoFAMsg);
        }
        return;
      }

      // Extract token robustly
      const token = data.token || data.accessToken || data.access_token;
      const refreshToken = data.refreshToken;

      if (!token) {
        console.error("[Login] No token found in response", data);
        throw new Error(t("layout.notifications.loginNoToken" as any));
      }

      // Save Token and Config
      localStorage.setItem(SUBLINKS_CONFIG.STORAGE_KEYS.API_URL, apiUrl);
      localStorage.setItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN, token);
      if (refreshToken) {
        localStorage.setItem(
          SUBLINKS_CONFIG.STORAGE_KEYS.REFRESH_TOKEN,
          refreshToken,
        );
      }
      localStorage.setItem(
        SUBLINKS_CONFIG.STORAGE_KEYS.USER,
        JSON.stringify(data.user),
      );

      setSyncStatus(t("layout.notifications.syncVerifying" as any));

      // Sync before reload to show progress
      await syncSubLinksSubscriptions({
        onProgress: (status) => {
          setSyncStatus(status);
        },
      });

      showNotice("success", t("layout.notifications.loginSuccess") as string);

      // Trigger auth change event for seamless login
      window.dispatchEvent(new Event("sublinks-auth-change"));
    } catch (err: any) {
      showNotice(
        "error",
        err.message || t("layout.notifications.cannotConnectServer" as any),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        color: "text.primary",
        position: "relative",
      }}
    >
      <Box
        data-tauri-drag-region
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 40,
          zIndex: 999,
          cursor: "move",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          zIndex: 1000,
        }}
      >
        <WindowControls />
      </Box>

      <Paper
        elevation={3}
        sx={{
          p: 4,
          width: "100%",
          maxWidth: 400,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          borderRadius: 2,
        }}
      >
        <Box
          component="img"
          src={logoIcon}
          sx={{
            width: 130,
            height: 130,
            mb: 1,
            objectFit: "contain",
          }}
        />

        <Typography variant="h5" sx={{ fontWeight: "bold", mb: 1 }}>
          {t("layout.notifications.loginTitle" as any)}
        </Typography>

        {/* Login Method Toggle */}
        <Box
          sx={{
            display: "flex",
            width: "100%",
            mb: 3,
            p: 0.5,
            borderRadius: 2,
            bgcolor: "action.hover",
            gap: 0.5,
          }}
        >
          {[
            {
              value: "browser" as const,
              icon: <OpenInBrowserIcon />,
              label: t("layout.notifications.browserLogin" as any),
            },
            {
              value: "password" as const,
              icon: <KeyIcon />,
              label: t("layout.notifications.passwordLogin" as any),
            },
          ].map((item) => {
            const isActive = loginMethod === item.value;
            return (
              <Box
                key={item.value}
                onClick={() => {
                  setLoginMethod(item.value);
                  stopPolling();
                  setDeviceStatus("idle");
                }}
                sx={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                  py: 1.2,
                  borderRadius: 1.5,
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "all 0.2s ease-in-out",
                  bgcolor: isActive ? "background.paper" : "transparent",
                  boxShadow: isActive ? 1 : 0,
                  color: isActive ? "primary.main" : "text.secondary",
                  fontWeight: isActive ? 600 : 400,
                  "&:hover": {
                    color: isActive ? "primary.main" : "text.primary",
                    bgcolor: isActive ? "background.paper" : "action.selected",
                  },
                }}
              >
                {item.icon}
                <Typography variant="body2" component="span">
                  {item.label}
                </Typography>
              </Box>
            );
          })}
        </Box>

        {/* Browser Login (Device Auth) */}
        {loginMethod === "browser" && (
          <Box
            sx={{
              width: "100%",
              animation: `${fadeIn} 0.3s ease-in-out`,
            }}
          >
            {/* Idle State - Initial */}
            {deviceStatus === "idle" && (
              <Box sx={{ textAlign: "center" }}>
                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                    border: "1px solid",
                    borderColor: (theme) =>
                      alpha(theme.palette.primary.main, 0.2),
                  }}
                >
                  <LaunchIcon
                    sx={{ fontSize: 40, color: "primary.main", mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {t("layout.notifications.deviceAuthDesc" as any)}
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<OpenInBrowserIcon />}
                  onClick={startDeviceAuth}
                  disabled={loading}
                  sx={{
                    py: 1.5,
                    fontSize: "1rem",
                    fontWeight: 600,
                    borderRadius: 2,
                    textTransform: "none",
                    boxShadow: (theme) =>
                      `0 4px 14px ${alpha(theme.palette.primary.main, 0.4)}`,
                    "&:hover": {
                      boxShadow: (theme) =>
                        `0 6px 20px ${alpha(theme.palette.primary.main, 0.5)}`,
                    },
                  }}
                >
                  {loading ? (
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      <CircularProgress size={22} color="inherit" />
                      <Typography variant="button">
                        {t("layout.notifications.loggingIn" as any)}
                      </Typography>
                    </Box>
                  ) : (
                    t("layout.notifications.deviceAuthOpenBrowser" as any)
                  )}
                </Button>
              </Box>
            )}

            {/* Waiting State - Polling */}
            {deviceStatus === "waiting" && (
              <Box
                sx={{
                  textAlign: "center",
                  animation: `${fadeIn} 0.3s ease-in-out`,
                }}
              >
                <Box
                  sx={{
                    position: "relative",
                    display: "inline-flex",
                    mb: 2,
                    animation: `${pulse} 2s ease-in-out infinite`,
                  }}
                >
                  <CircularProgress
                    size={64}
                    thickness={3}
                    sx={{ color: "primary.main" }}
                  />
                  <Box
                    sx={{
                      top: 0,
                      left: 0,
                      bottom: 0,
                      right: 0,
                      position: "absolute",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <OpenInBrowserIcon
                      sx={{ fontSize: 28, color: "primary.main" }}
                    />
                  </Box>
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {t("layout.notifications.deviceAuthWaiting" as any)}
                </Typography>

                {syncStatus && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    {syncStatus}
                  </Typography>
                )}

                <Box
                  sx={{
                    mt: 2,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "background.default",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mb: 1.5 }}
                  >
                    {t("layout.notifications.deviceAuthManualCopy" as any)}
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={copyVerificationUri}
                    sx={{
                      borderRadius: 1.5,
                      textTransform: "none",
                    }}
                  >
                    {t("layout.notifications.deviceAuthCopyLink" as any)}
                  </Button>
                </Box>
              </Box>
            )}

            {/* Expired State */}
            {deviceStatus === "expired" && (
              <Box
                sx={{
                  textAlign: "center",
                  animation: `${fadeIn} 0.3s ease-in-out`,
                }}
              >
                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: (theme) => alpha(theme.palette.error.main, 0.08),
                    border: "1px solid",
                    borderColor: (theme) =>
                      alpha(theme.palette.error.main, 0.2),
                  }}
                >
                  <ErrorOutlineIcon
                    sx={{ fontSize: 40, color: "error.main", mb: 1 }}
                  />
                  <Typography variant="body2" color="error.main">
                    {t("layout.notifications.deviceAuthExpired" as any)}
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<OpenInBrowserIcon />}
                  onClick={startDeviceAuth}
                  sx={{
                    py: 1.5,
                    fontSize: "1rem",
                    fontWeight: 600,
                    borderRadius: 2,
                    textTransform: "none",
                  }}
                >
                  {t("layout.notifications.deviceAuthOpenBrowser" as any)}
                </Button>
              </Box>
            )}

            {/* Denied State */}
            {deviceStatus === "denied" && (
              <Box
                sx={{
                  textAlign: "center",
                  animation: `${fadeIn} 0.3s ease-in-out`,
                }}
              >
                <Box
                  sx={{
                    mb: 3,
                    p: 2,
                    borderRadius: 2,
                    bgcolor: (theme) => alpha(theme.palette.warning.main, 0.08),
                    border: "1px solid",
                    borderColor: (theme) =>
                      alpha(theme.palette.warning.main, 0.2),
                  }}
                >
                  <ErrorOutlineIcon
                    sx={{ fontSize: 40, color: "warning.main", mb: 1 }}
                  />
                  <Typography variant="body2" color="warning.main">
                    {t("layout.notifications.deviceAuthDenied" as any)}
                  </Typography>
                </Box>

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<OpenInBrowserIcon />}
                  onClick={startDeviceAuth}
                  sx={{
                    py: 1.5,
                    fontSize: "1rem",
                    fontWeight: 600,
                    borderRadius: 2,
                    textTransform: "none",
                  }}
                >
                  {t("layout.notifications.deviceAuthOpenBrowser" as any)}
                </Button>
              </Box>
            )}

            {/* Success State */}
            {deviceStatus === "success" && (
              <Box
                sx={{
                  textAlign: "center",
                  animation: `${fadeIn} 0.3s ease-in-out`,
                }}
              >
                <Box
                  sx={{
                    position: "relative",
                    display: "inline-flex",
                    mb: 2,
                  }}
                >
                  <CircularProgress
                    size={64}
                    thickness={3}
                    sx={{ color: "success.main" }}
                  />
                  <Box
                    sx={{
                      top: 0,
                      left: 0,
                      bottom: 0,
                      right: 0,
                      position: "absolute",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <CheckCircleOutlineIcon
                      sx={{ fontSize: 28, color: "success.main" }}
                    />
                  </Box>
                </Box>

                <Typography
                  variant="h6"
                  sx={{ fontWeight: 600, color: "success.main", mb: 0.5 }}
                >
                  {t("layout.notifications.deviceAuthSuccess" as any)}
                </Typography>

                {syncStatus && (
                  <Typography variant="body2" color="text.secondary">
                    {syncStatus}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}

        {/* Password Login */}
        {loginMethod === "password" && (
          <Box
            component="form"
            onSubmit={handleLogin}
            sx={{ width: "100%", mt: 1 }}
          >
            {!requires2FA ? (
              <>
                <TextField
                  fullWidth
                  label={t("layout.notifications.username" as any)}
                  margin="normal"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <TextField
                  fullWidth
                  label={t("layout.notifications.password" as any)}
                  type="password"
                  margin="normal"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </>
            ) : (
              <>
                <TextField
                  fullWidth
                  label={t("layout.notifications.totpCode" as any)}
                  margin="normal"
                  required
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                />
                <Button
                  fullWidth
                  variant="outlined"
                  color="inherit"
                  disabled={loading}
                  onClick={() => {
                    setRequires2FA(false);
                    setTwoFactorCode("");
                  }}
                  sx={{ mt: 1 }}
                >
                  {t("layout.notifications.backToChangePassword" as any)}
                </Button>
              </>
            )}
            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: requires2FA ? 1 : 3, mb: 2 }}
            >
              {loading ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={20} color="inherit" />
                  <Typography variant="button">
                    {syncStatus || t("layout.notifications.loggingIn" as any)}
                  </Typography>
                </Box>
              ) : requires2FA ? (
                t("layout.notifications.verify" as any)
              ) : (
                t("layout.notifications.login" as any)
              )}
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default LoginPage;
