import { ArrowDownwardRounded, ArrowUpwardRounded } from "@mui/icons-material";
import { Box, GlobalStyles, Paper, Typography } from "@mui/material";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useTrafficData } from "@/hooks/use-traffic-data";
import { hideInitialOverlay } from "@/pages/_layout/utils/initial-loading-overlay";
import parseTraffic from "@/utils/parse-traffic";

const MINI_WINDOW_POSITION_KEY = "mini_window_position";

const MiniPage = () => {
  const { t } = useTranslation();

  useEffect(() => {
    hideInitialOverlay();

    const window = getCurrentWebviewWindow();

    // Restore saved position
    const savedPosition = localStorage.getItem(MINI_WINDOW_POSITION_KEY);
    if (savedPosition) {
      try {
        const { x, y } = JSON.parse(savedPosition);
        window.setPosition(new LogicalPosition(x, y)).catch(console.error);
      } catch (e) {
        console.error("Failed to restore mini window position", e);
      }
    }

    // Save position when window is moved
    let saveTimeout: NodeJS.Timeout;
    const unlisten = window.onMoved(({ payload }) => {
      // Debounce saving to avoid too many writes
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        localStorage.setItem(MINI_WINDOW_POSITION_KEY, JSON.stringify(payload));
      }, 500);
    });

    return () => {
      unlisten.then((fn) => fn());
      clearTimeout(saveTimeout);
    };
  }, []);

  // Always enable traffic data for mini window
  const {
    response: { data: traffic },
  } = useTrafficData({ enabled: true });

  const [up, upUnit] = parseTraffic(traffic?.up || 0);
  const [down, downUnit] = parseTraffic(traffic?.down || 0);

  return (
    <>
      <GlobalStyles
        styles={{
          html: {
            backgroundColor: "transparent !important",
            margin: 0,
            padding: 0,
            height: "100%",
          },
          body: {
            backgroundColor: "transparent !important",
            margin: 0,
            padding: 0,
            height: "100%",
            overflow: "hidden",
          },
          "#root": {
            backgroundColor: "transparent !important",
            margin: 0,
            padding: 0,
            height: "100%",
          },
          "*:focus": { outline: "none !important" },
          "*": { userSelect: "none" },
        }}
      />
      <Paper
        elevation={0}
        square
        sx={{
          width: "100%",
          height: "100%",
          bgcolor: "background.paper", // "rgba(25, 118, 210, 0.9)", // semi-transparent primary color or background
          borderRadius: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          pl: 1,
          pr: 0.2, // Reduce right padding since we want to cut empty space
          position: "relative",
          cursor: "move",
        }}
        data-tauri-drag-region
      >
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          gap={0.5}
          alignItems="flex-start" // Keep left align for numbers to align decently
          width="100%"
          height="100%"
          sx={{ pointerEvents: "none" }}
        >
          <Box display="flex" alignItems="center" gap={0.5}>
            <ArrowUpwardRounded
              sx={{ fontSize: 14, color: "secondary.main" }}
            />
            <Typography
              variant="caption"
              fontWeight="bold"
              sx={{ minWidth: 40, userSelect: "none", lineHeight: 1 }}
            >
              {up}{" "}
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.7rem" }}
              >
                {upUnit}/s
              </Typography>
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={0.5}>
            <ArrowDownwardRounded
              sx={{ fontSize: 14, color: "primary.main" }}
            />
            <Typography
              variant="caption"
              fontWeight="bold"
              sx={{ minWidth: 40, userSelect: "none", lineHeight: 1 }}
            >
              {down}{" "}
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: "0.7rem" }}
              >
                {downUnit}/s
              </Typography>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </>
  );
};

export default MiniPage;
