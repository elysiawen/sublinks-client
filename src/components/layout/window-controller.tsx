import { Close, CropSquare, FilterNone, Minimize } from "@mui/icons-material";
import { Box, IconButton } from "@mui/material";
import { forwardRef, useImperativeHandle } from "react";

import { useWindowControls } from "@/hooks/use-window";
import getSystem from "@/utils/get-system";

export const WindowControls = forwardRef(function WindowControls(props, ref) {
  const OS = getSystem();
  const {
    currentWindow,
    maximized,
    minimize,
    close,
    toggleFullscreen,
    toggleMaximize,
  } = useWindowControls();

  useImperativeHandle(
    ref,
    () => ({
      currentWindow,
      maximized,
      minimize,
      close,
      toggleFullscreen,
      toggleMaximize,
    }),
    [
      currentWindow,
      maximized,
      minimize,
      close,
      toggleFullscreen,
      toggleMaximize,
    ],
  );

  // 通过前端对 tauri 窗口进行翻转全屏时会短暂地与系统图标重叠渲染。
  // 这可能是上游缺陷，保险起见跨平台以窗口的最大化翻转为准。

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "stretch",
        height: "100%",
        WebkitAppRegion: "no-drag",
      }}
    >
      {OS === "macos" && (
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", px: 1 }}>
          {/* macOS 风格：关闭 → 最小化 → 全屏 */}
          <IconButton
            size="small"
            sx={{ fontSize: 12, p: 0.5 }}
            onClick={close}
          >
            <Close fontSize="inherit" color="inherit" />
          </IconButton>
          <IconButton
            size="small"
            sx={{ fontSize: 12, p: 0.5 }}
            onClick={minimize}
          >
            <Minimize fontSize="inherit" color="inherit" />
          </IconButton>
          <IconButton
            size="small"
            sx={{ fontSize: 12, p: 0.5 }}
            onClick={toggleMaximize}
          >
            {maximized ? (
              <FilterNone fontSize="inherit" color="inherit" />
            ) : (
              <CropSquare fontSize="inherit" color="inherit" />
            )}
          </IconButton>
        </Box>
      )}

      {OS === "windows" && (
        <>
          {/* Windows 风格：最小化 → 最大化 → 关闭 */}
          <IconButton
            size="small"
            sx={{
              borderRadius: 0,
              width: 46,
              height: "100%",
              ":hover": { bgcolor: "action.hover" },
            }}
            onClick={minimize}
          >
            <Minimize sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton
            size="small"
            sx={{
              borderRadius: 0,
              width: 46,
              height: "100%",
              ":hover": { bgcolor: "action.hover" },
            }}
            onClick={toggleMaximize}
          >
            {maximized ? (
              <FilterNone sx={{ fontSize: 14 }} />
            ) : (
              <CropSquare sx={{ fontSize: 14 }} />
            )}
          </IconButton>
          <IconButton
            size="small"
            sx={{
              borderRadius: 0,
              width: 46,
              height: "100%",
              ":hover": {
                bgcolor: "#e81123",
                color: "white",
              },
            }}
            onClick={close}
          >
            <Close sx={{ fontSize: 16 }} />
          </IconButton>
        </>
      )}

      {OS === "linux" && (
        <>
          {/* Linux 桌面常见布局 */}
          <IconButton
            size="small"
            sx={{ ":hover": { bgcolor: "action.hover" } }}
            onClick={minimize}
          >
            <Minimize fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            sx={{ ":hover": { bgcolor: "action.hover" } }}
            onClick={toggleMaximize}
          >
            {maximized ? (
              <FilterNone fontSize="small" />
            ) : (
              <CropSquare fontSize="small" />
            )}
          </IconButton>
          <IconButton
            size="small"
            sx={{
              ":hover": { bgcolor: "#e81123", color: "white" },
            }}
            onClick={close}
          >
            <Close fontSize="small" />
          </IconButton>
        </>
      )}
    </Box>
  );
});
