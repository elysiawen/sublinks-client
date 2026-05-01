import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  CircularProgress,
} from "@mui/material";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

import logoIcon from "@/assets/image/logo.ico";
import { WindowControls } from "@/components/layout/window-controller";
import { SUBLINKS_CONFIG } from "@/configs/sublinks-config";
import { getSystemHostname } from "@/services/cmds";
import { showNotice } from "@/services/notice-service";
// import { useThemeMode } from "@/services/states"; // This import is no longer needed if mode/isDark are removed
import {
  syncSubLinksSubscriptions,
  USER_AGENT,
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

  useEffect(() => {
    const reason = localStorage.getItem(
      SUBLINKS_CONFIG.STORAGE_KEYS.LOGOUT_REASON,
    );
    if (reason) {
      if (reason.includes("expired") || reason.includes("invalid") || reason.includes("过期") || reason.includes("失效")) {
        showNotice("error", reason);
      } else {
        showNotice("success", reason);
      }
      localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.LOGOUT_REASON);
    }
  }, []);

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
        headers: {
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify(bodyPayload),
      });

      const text = await response.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (!response.ok) {
          throw new Error(t("layout.notifications.loginRequestFailed" as any, { status: response.status, text }));
        }
        throw new Error(t("layout.notifications.serverInvalidResponse" as any));
      }

      if (!response.ok) {
        throw new Error(data.message || t("layout.notifications.loginFailed" as any, { status: response.status }));
      }

      if (data.requires2FA) {
        setRequires2FA(true);
        if (data.message) {
          showNotice("info", data.message);
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
      showNotice("error", err.message || t("layout.notifications.cannotConnectServer" as any));
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
      </Paper>
    </Box>
  );
};

export default LoginPage;
