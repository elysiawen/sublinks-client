import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router";

import logoIcon from "@/assets/image/logo.ico";
import { WindowControls } from "@/components/layout/window-controller";
import { SUBLINKS_CONFIG } from "@/configs/sublinks-config";
import { showNotice } from "@/services/notice-service";
import { useThemeMode } from "@/services/states";
import { syncSubLinksSubscriptions } from "@/services/sublinks-service";

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState("");
  const navigate = useNavigate();

  const mode = useThemeMode();
  const isDark = mode !== "light";
  const apiUrl = SUBLINKS_CONFIG.DEFAULT_API_URL;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/client/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "登录失败");
      }

      // Extract token robustly
      const token = data.token || data.accessToken || data.access_token;

      if (!token) {
        console.error("[Login] No token found in response", data);
        throw new Error("登录成功但未获取到访问令牌，请联系管理员");
      }

      // Save Token and Config
      localStorage.setItem(SUBLINKS_CONFIG.STORAGE_KEYS.API_URL, apiUrl);
      localStorage.setItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN, token);
      localStorage.setItem(
        SUBLINKS_CONFIG.STORAGE_KEYS.USER,
        JSON.stringify(data.user),
      );

      setSyncStatus("验证成功，正在同步订阅...");

      // Sync before reload to show progress
      await syncSubLinksSubscriptions({
        onProgress: (status) => {
          setSyncStatus(status);
        },
      });

      showNotice("success", "登录及同步成功，正在进入系统...");

      // Reload to ensure Layout picks up the token and triggers auto-sync
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "无法连接到服务器");
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

        <Typography variant="h5" fontWeight="bold" gutterBottom>
          SubLinks 客户端
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: "100%" }}>
            {error}
          </Alert>
        )}

        <Box
          component="form"
          onSubmit={handleLogin}
          sx={{ width: "100%", mt: 1 }}
        >
          <TextField
            fullWidth
            label="用户名"
            margin="normal"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <TextField
            fullWidth
            label="密码"
            type="password"
            margin="normal"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 3, mb: 2 }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : "登录"}
          </Button>

          {loading && syncStatus && (
            <Box sx={{ width: "100%", textAlign: "center", mt: 1 }}>
              <Typography
                variant="body2"
                color="primary"
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                }}
              >
                <CircularProgress size={16} color="inherit" />
                {syncStatus}
              </Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginPage;
