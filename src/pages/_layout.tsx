import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { LogoutRounded, PersonRounded } from "@mui/icons-material";
import {
  Box,
  List,
  Menu,
  MenuItem,
  Paper,
  ThemeProvider,
  Typography,
  IconButton,
  Tooltip,
} from "@mui/material";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useNavigate } from "react-router";
import { SWRConfig } from "swr";

import logoIcon from "@/assets/image/logo.ico";
import { BaseErrorBoundary } from "@/components/base";
import { LayoutItem } from "@/components/layout/layout-item";
import { LayoutTraffic } from "@/components/layout/layout-traffic";
import { NoticeManager } from "@/components/layout/notice-manager";
import { WindowControls } from "@/components/layout/window-controller";
import { SUBLINKS_CONFIG } from "@/configs/sublinks-config"; // [NEW] Import config
import { useI18n } from "@/hooks/use-i18n";
import { useVerge } from "@/hooks/use-verge";
import { useWindowDecorations } from "@/hooks/use-window";
// [NEW] Updated imports for cleanup
import { showNotice } from "@/services/notice-service";
import { useThemeMode } from "@/services/states";
import {
  syncSubLinksSubscriptions,
  logoutSubLinks,
} from "@/services/sublinks-service"; // [NEW] Updated imports
import getSystem from "@/utils/get-system";

import {
  useAppInitialization,
  useCustomTheme,
  useLayoutEvents,
  useLoadingOverlay,
  useNavMenuOrder,
} from "./_layout/hooks";
import { handleNoticeMessage } from "./_layout/utils";
import { navItems } from "./_routers";
import LoginPage from "./login"; // [NEW] Import Login Page

import "dayjs/locale/ru";
import "dayjs/locale/zh-cn";

export const portableFlag = false;

type NavItem = (typeof navItems)[number];

type MenuContextPosition = { top: number; left: number };

interface SortableNavMenuItemProps {
  item: NavItem;
  label: string;
}

const SortableNavMenuItem = ({ item, label }: SortableNavMenuItemProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.path,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (isDragging) {
    style.zIndex = 100;
  }

  return (
    <LayoutItem
      to={item.path}
      icon={item.icon}
      sortable={{
        setNodeRef,
        attributes,
        listeners,
        style,
        isDragging,
      }}
    >
      {label}
    </LayoutItem>
  );
};

dayjs.extend(relativeTime);

const OS = getSystem();

const Layout = () => {
  const mode = useThemeMode();
  const isDark = mode !== "light";
  const { t } = useTranslation();
  const { theme } = useCustomTheme();
  const { verge, mutateVerge, patchVerge } = useVerge();
  const { language } = verge ?? {};
  const navCollapsed = verge?.collapse_navbar ?? false;
  const { switchLanguage } = useI18n();
  const navigate = useNavigate();
  const themeReady = useMemo(() => Boolean(theme), [theme]);

  const [menuUnlocked, setMenuUnlocked] = useState(false);
  const [menuContextPosition, setMenuContextPosition] =
    useState<MenuContextPosition | null>(null);

  const windowControlsRef = useRef<any>(null);
  const { decorated } = useWindowDecorations();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleMenuOrderOptimisticUpdate = useCallback(
    (order: string[]) => {
      mutateVerge(
        (prev: IVergeConfig | undefined) =>
          prev ? { ...prev, menu_order: order } : prev,
        false,
      );
    },
    [mutateVerge],
  );

  const handleMenuOrderPersist = useCallback(
    (order: string[]) => patchVerge({ menu_order: order }),
    [patchVerge],
  );

  const {
    menuOrder,
    navItemMap,
    handleMenuDragEnd,
    isDefaultOrder,
    resetMenuOrder,
  } = useNavMenuOrder({
    enabled: menuUnlocked,
    items: navItems,
    storedOrder: verge?.menu_order,
    onOptimisticUpdate: handleMenuOrderOptimisticUpdate,
    onPersist: handleMenuOrderPersist,
  });

  const handleMenuContextMenu = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setMenuContextPosition({ top: event.clientY, left: event.clientX });
    },
    [],
  );

  const handleMenuContextClose = useCallback(() => {
    setMenuContextPosition(null);
  }, []);

  const handleResetMenuOrder = useCallback(() => {
    setMenuContextPosition(null);
    void resetMenuOrder();
  }, [resetMenuOrder]);

  const handleUnlockMenu = useCallback(() => {
    setMenuUnlocked(true);
    setMenuContextPosition(null);
  }, []);

  const handleLockMenu = useCallback(() => {
    setMenuUnlocked(false);
    setMenuContextPosition(null);
  }, []);

  const handleToggleNavCollapsed = useCallback(() => {
    setMenuContextPosition(null);
    void patchVerge({ collapse_navbar: !navCollapsed });
  }, [navCollapsed, patchVerge]);

  const customTitlebar = useMemo(
    () =>
      !decorated ? (
        <div className="the_titlebar" data-tauri-drag-region="true">
          <Typography
            variant="caption"
            sx={{
              fontWeight: "bold",
              opacity: 0.8,
              pointerEvents: "none",
              ml: 2,
            }}
          >
            {SUBLINKS_CONFIG.PRODUCT_NAME}
          </Typography>
          <WindowControls ref={windowControlsRef} />
        </div>
      ) : null,
    [decorated],
  );

  useLoadingOverlay(themeReady);
  useAppInitialization();

  const handleNotice = useCallback(
    (payload: [string, string]) => {
      const [status, msg] = payload;
      try {
        handleNoticeMessage(status, msg, t, navigate);
      } catch (_error) {
        console.error("[通知处理] 失败:", _error);
      }
    },
    [t, navigate],
  );

  useLayoutEvents(handleNotice);

  useEffect(() => {
    if (language) {
      dayjs.locale(language === "zh" ? "zh-cn" : language);
      switchLanguage(language);
    }
  }, [language, switchLanguage]);

  const [sidebarVisibility, setSidebarVisibility] = useState<
    Record<string, boolean>
  >(() => {
    const saved = localStorage.getItem(
      SUBLINKS_CONFIG.STORAGE_KEYS.SIDEBAR_VISIBILITY,
    );
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (ignore) {
        return {};
      }
    }
    return {};
  });

  useEffect(() => {
    const handleVisibilityUpdate = () => {
      const saved = localStorage.getItem(
        SUBLINKS_CONFIG.STORAGE_KEYS.SIDEBAR_VISIBILITY,
      );
      if (saved) {
        try {
          setSidebarVisibility(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse sidebar visibility", e);
        }
      }
    };
    window.addEventListener(
      "sidebar-visibility-change",
      handleVisibilityUpdate,
    );
    return () =>
      window.removeEventListener(
        "sidebar-visibility-change",
        handleVisibilityUpdate,
      );
  }, []);

  const visibleMenuOrder = useMemo(() => {
    const essentialPaths = ["/", "/settings"];
    return menuOrder.filter(
      (path: string) =>
        essentialPaths.includes(path) || sidebarVisibility[path] !== false,
    );
  }, [menuOrder, sidebarVisibility]);

  // [NEW] Auth State - Use state to support seamless login/logout
  const [token, setToken] = useState<string | null>(() => {
    const t = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN);
    // Handle "undefined" string from previous bugs
    if (t === "undefined") {
      localStorage.removeItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN);
      return null;
    }
    return t;
  });

  useEffect(() => {
    const handleAuthChange = () => {
      const newToken = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN);
      setToken(newToken);
    };
    window.addEventListener("sublinks-auth-change", handleAuthChange);
    return () =>
      window.removeEventListener("sublinks-auth-change", handleAuthChange);
  }, []);

  // Sync user object (optional, mostly for display if needed)
  const userStr = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.USER);
  let user = null;
  try {
    if (userStr) user = JSON.parse(userStr);
  } catch (ignore) {}

  // [NEW] Auto-sync subscriptions on startup
  const syncAttemptedRef = useRef(false);
  const syncTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if auto-sync is enabled in settings
    const autoSyncEnabled = verge?.sublinks_auto_sync ?? false;

    if (token && !syncAttemptedRef.current && autoSyncEnabled) {
      syncAttemptedRef.current = true;

      // Clear any existing timer
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }

      // Delay sync to allow core and app to stabilize
      syncTimerRef.current = setTimeout(() => {
        syncSubLinksSubscriptions({ silent: true })
          .then(() => {
            showNotice(
              "success",
              t("layout.notifications.autoSyncSuccess") as string,
            );
          })
          .catch((err) => {
            console.error("[Auto-Sync] Failed:", err);
            showNotice(
              "error",
              t("layout.notifications.autoSyncFailed") as string,
            );
          });
        syncTimerRef.current = null;
      }, 1000);
    }

    // Cleanup function - but don't clear the timer if sync was already scheduled
    return () => {
      // Only clear if we haven't started syncing yet
      if (syncTimerRef.current && !syncAttemptedRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [token, verge?.sublinks_auto_sync, t]);

  if (!themeReady) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: mode === "light" ? "#fff" : "#181a1b",
          transition: "background 0.2s",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: mode === "light" ? "#333" : "#fff",
        }}
      ></div>
    );
  }

  if (!token) {
    return (
      <ThemeProvider theme={theme}>
        <LoginPage />
      </ThemeProvider>
    );
  }

  const handleLogout = async () => {
    await logoutSubLinks();
  };

  return (
    <SWRConfig
      value={{
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        onError: (error, key) => {
          console.error(`[SWR Error] Key: ${key}, Error:`, error);
          if (key !== "getAutotemProxy") {
            console.error(`SWR Error for ${key}:`, error);
          }
        },
        dedupingInterval: 2000,
      }}
    >
      <ThemeProvider theme={theme}>
        {/* 左侧底部窗口控制按钮 */}
        <NoticeManager position={verge?.notice_position} />
        <div
          style={{
            animation: "fadeIn 0.5s",
            WebkitAnimation: "fadeIn 0.5s",
          }}
        />
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}
        </style>
        <Paper
          square
          elevation={0}
          className={`${OS} layout${navCollapsed ? " layout--nav-collapsed" : ""}`}
          style={{
            borderTopLeftRadius: "0px",
            borderTopRightRadius: "0px",
          }}
          onContextMenu={(e) => {
            if (
              OS === "windows" &&
              !["input", "textarea"].includes(
                e.currentTarget.tagName.toLowerCase(),
              ) &&
              !e.currentTarget.isContentEditable
            ) {
              e.preventDefault();
            }
          }}
          sx={[
            ({ palette }) => ({ bgcolor: palette.background.paper }),
            OS === "linux"
              ? {
                  borderRadius: "8px",
                  width: "100vw",
                  height: "100vh",
                }
              : {},
          ]}
        >
          {/* Custom titlebar - rendered only when decorated is false, memoized for performance */}
          {customTitlebar}

          <div className="layout-content">
            <div className="layout-content__left">
              <div className="the-logo" data-tauri-drag-region="false">
                <div
                  data-tauri-drag-region="true"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Box
                    component="img"
                    src={logoIcon}
                    sx={{
                      height: 39,
                      width: 39,
                      objectFit: "contain",
                    }}
                  />
                  {!navCollapsed && (
                    <Typography
                      variant="h6"
                      sx={{
                        fontWeight: "bold",
                        color: isDark ? "white" : "black",
                        userSelect: "none",
                        fontSize: "1.5rem",
                        lineHeight: 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {SUBLINKS_CONFIG.PRODUCT_NAME.split(" ")[0]}
                    </Typography>
                  )}
                </div>
              </div>

              {menuUnlocked && (
                <Box
                  sx={(theme) => ({
                    px: 1.5,
                    py: 0.75,
                    mx: "auto",
                    mb: 1,
                    maxWidth: 250,
                    borderRadius: 1.5,
                    fontSize: 12,
                    fontWeight: 600,
                    textAlign: "center",
                    color: theme.palette.warning.contrastText,
                    bgcolor:
                      theme.palette.mode === "light"
                        ? theme.palette.warning.main
                        : theme.palette.warning.dark,
                  })}
                >
                  {t("layout.components.navigation.menu.reorderMode")}
                </Box>
              )}

              {menuUnlocked ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleMenuDragEnd}
                >
                  <SortableContext items={visibleMenuOrder}>
                    <List
                      className="the-menu"
                      onContextMenu={handleMenuContextMenu}
                    >
                      {visibleMenuOrder.map((path) => {
                        const item = navItemMap.get(path);
                        if (!item) {
                          return null;
                        }
                        return (
                          <SortableNavMenuItem
                            key={item.path}
                            item={item}
                            label={t(item.label)}
                          />
                        );
                      })}
                    </List>
                  </SortableContext>
                </DndContext>
              ) : (
                <List
                  className="the-menu"
                  onContextMenu={handleMenuContextMenu}
                >
                  {visibleMenuOrder.map((path) => {
                    const item = navItemMap.get(path);
                    if (!item) {
                      return null;
                    }
                    return (
                      <LayoutItem
                        key={item.path}
                        to={item.path}
                        icon={item.icon}
                      >
                        {t(item.label)}
                      </LayoutItem>
                    );
                  })}
                </List>
              )}

              <Menu
                open={Boolean(menuContextPosition)}
                onClose={handleMenuContextClose}
                anchorReference="anchorPosition"
                anchorPosition={
                  menuContextPosition
                    ? {
                        top: menuContextPosition.top,
                        left: menuContextPosition.left,
                      }
                    : undefined
                }
                transitionDuration={200}
                slotProps={{
                  list: {
                    sx: { py: 0.5 },
                  },
                }}
              >
                <MenuItem onClick={handleToggleNavCollapsed} dense>
                  {navCollapsed
                    ? t("layout.components.navigation.menu.expandNavBar")
                    : t("layout.components.navigation.menu.collapseNavBar")}
                </MenuItem>
                <MenuItem
                  onClick={menuUnlocked ? handleLockMenu : handleUnlockMenu}
                  dense
                >
                  {menuUnlocked
                    ? t("layout.components.navigation.menu.lock")
                    : t("layout.components.navigation.menu.unlock")}
                </MenuItem>
                <MenuItem
                  onClick={handleResetMenuOrder}
                  dense
                  disabled={isDefaultOrder}
                >
                  {t("layout.components.navigation.menu.restoreDefaultOrder")}
                </MenuItem>
              </Menu>

              {/* User Info & Logout */}
              <Box
                sx={{
                  mx: 2,
                  mt: "auto",
                  mb: 1,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: (theme) =>
                    theme.palette.mode === "light"
                      ? "rgba(0, 0, 0, 0.05)"
                      : "rgba(255, 255, 255, 0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    overflow: "hidden",
                  }}
                >
                  <PersonRounded sx={{ fontSize: 20, mr: 1, opacity: 0.7 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight="bold" noWrap>
                      {user?.username || "User"}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      noWrap
                      display="block"
                    >
                      {t("layout.components.navigation.userInfo.loggedIn")}
                    </Typography>
                  </Box>
                </Box>
                <Tooltip
                  title={t("layout.components.navigation.userInfo.logout")}
                >
                  <IconButton
                    onClick={handleLogout}
                    size="small"
                    sx={{ ml: 0.5 }}
                  >
                    <LogoutRounded fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>

              <div className="the-traffic">
                <LayoutTraffic />
              </div>
            </div>

            <div className="layout-content__right">
              <div className="the-bar"></div>
              <div className="the-content">
                <BaseErrorBoundary>
                  <Outlet />
                </BaseErrorBoundary>
              </div>
            </div>
          </div>
        </Paper>
      </ThemeProvider>
    </SWRConfig>
  );
};

export default Layout;
