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
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  List,
  Menu,
  MenuItem,
  Paper,
  ThemeProvider,
  Typography,
} from "@mui/material";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { CSSProperties } from "react";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useLocation, useNavigate } from "react-router";

import logoIcon from "@/assets/image/logo.ico";
import { BaseErrorBoundary } from "@/components/base";
import { LayoutItem } from "@/components/layout/layout-item";
import { LayoutTraffic } from "@/components/layout/layout-traffic";
import { NoticeManager } from "@/components/layout/notice-manager";
import {
  WindowControls,
  WindowResizeHandles,
} from "@/components/layout/window-controller";
import { SUBLINKS_CONFIG } from "@/configs/sublinks-config";
import { useI18n } from "@/hooks/use-i18n";
import { useVerge } from "@/hooks/use-verge";
import { useVisibility } from "@/hooks/use-visibility";
import { useWindowDecorations } from "@/hooks/use-window";
import { useProxiesData } from "@/providers/app-data-context";
import { showNotice } from "@/services/notice-service";
import { useThemeMode } from "@/services/states";
import {
  syncSubLinksSubscriptions,
  logoutSubLinks,
  fetchSubLinksUserInfo,
  isSyncInProgress,
} from "@/services/sublinks-service";
import getSystem from "@/utils/get-system";

import {
  useCustomTheme,
  useLayoutEvents,
  useLoadingOverlay,
  useNavMenuOrder,
} from "./_layout/hooks";
import { handleNoticeMessage } from "./_layout/utils";
import { navItems, preloadLogsPage, preloadNavigationRoutes } from "./_routers";
import LoginPage from "./login";

import "dayjs/locale/ru";
import "dayjs/locale/zh-cn";

export const portableFlag = false;

const LogsPage = lazy(() => preloadLogsPage());

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
      onPreload={item.preload}
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
  const { pathname } = useLocation();
  const isLogsPage = pathname === "/logs";
  const pageVisible = useVisibility();
  const themeReady = useMemo(() => Boolean(theme), [theme]);

  // Logout Dialog State
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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
        (prev) => (prev ? { ...prev, menu_order: order } : prev),
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
      decorated === false ? (
        <div className="the_titlebar">
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
          <div
            className="the_titlebar-drag-region"
            data-tauri-drag-region="true"
          />
          <WindowControls ref={windowControlsRef} />
        </div>
      ) : null,
    [decorated],
  );

  useLoadingOverlay(themeReady);

  useEffect(() => {
    if (!themeReady || !pageVisible) {
      return;
    }

    const controller = new AbortController();
    const timerId = window.setTimeout(() => {
      void preloadNavigationRoutes(controller.signal);
    }, 2000);

    return () => {
      controller.abort();
      window.clearTimeout(timerId);
    };
  }, [themeReady, pageVisible]);

  const handleNotice = useCallback(
    (payload: [string, string]) => {
      const [status, msg] = payload;
      try {
        handleNoticeMessage(status, msg, t, navigate);
      } catch (error) {
        console.error("[通知处理] 失败:", error);
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

  // Sidebar visibility filtering (SubLinks customization)
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

  // Auth State
  const [token, setToken] = useState<string | null>(() => {
    const t = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.TOKEN);
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

  // User state
  const [user, setUser] = useState<any>(() => {
    const userStr = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.USER);
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleAuthChange = () => {
      const userStr = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.USER);
      try {
        setUser(userStr ? JSON.parse(userStr) : null);
      } catch {
        setUser(null);
      }
    };
    window.addEventListener("sublinks-auth-change", handleAuthChange);
    return () =>
      window.removeEventListener("sublinks-auth-change", handleAuthChange);
  }, []);

  // Cache avatar URL
  const avatarUrl = useMemo(() => {
    if (!user?.avatar) return undefined;
    return (
      localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.AVATAR_CACHE) ||
      user.avatar
    );
  }, [user?.avatar]);

  const { proxies } = useProxiesData();

  // Auto-sync subscriptions and user info on startup
  const syncAttemptedRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userInfoFetchedRef = useRef(false);

  useEffect(() => {
    const autoSyncEnabled = verge?.sublinks_auto_sync ?? false;

    if (token) {
      if (proxies && !userInfoFetchedRef.current) {
        userInfoFetchedRef.current = true;
        fetchSubLinksUserInfo();
      }

      if (!syncAttemptedRef.current && autoSyncEnabled && !isSyncInProgress()) {
        syncAttemptedRef.current = true;

        if (syncTimerRef.current) {
          clearTimeout(syncTimerRef.current);
        }

        syncTimerRef.current = setTimeout(() => {
          syncSubLinksSubscriptions()
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
    }

    return () => {
      if (syncTimerRef.current && !syncAttemptedRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
    };
  }, [token, verge?.sublinks_auto_sync, proxies, t]);

  // Logout handlers
  const handleLogoutClick = () => {
    setLogoutDialogOpen(true);
  };

  const handleLogoutConfirm = async () => {
    setLoggingOut(true);
    try {
      const result = await logoutSubLinks(
        t("layout.notifications.logoutSuccess"),
      );
      if (!result.success) {
        showNotice(
          "error",
          result.message || (t("layout.notifications.logoutFailed") as string),
        );
      }
    } catch (e: any) {
      showNotice(
        "error",
        t("layout.notifications.logoutFailed") + ": " + e.message,
      );
    } finally {
      setLoggingOut(false);
      setLogoutDialogOpen(false);
    }
  };

  const handleLogoutCancel = () => {
    if (!loggingOut) {
      setLogoutDialogOpen(false);
    }
  };

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

  // Auth gating - show login page if no token
  if (!token) {
    return (
      <ThemeProvider theme={theme}>
        <NoticeManager position={verge?.notice_position} />
        <LoginPage />
      </ThemeProvider>
    );
  }

  return (
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
        {decorated === false && <WindowResizeHandles />}

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
              <List className="the-menu" onContextMenu={handleMenuContextMenu}>
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
                      onPreload={item.preload}
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
                mb: 2,
                p: 1.5,
                borderRadius: 2,
                bgcolor: (theme) =>
                  theme.palette.mode === "light"
                    ? "rgba(0, 0, 0, 0.05)"
                    : "rgba(255, 255, 255, 0.05)",
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  overflow: "hidden",
                }}
              >
                {user?.avatar ? (
                  <Box
                    component="img"
                    src={avatarUrl}
                    sx={{
                      height: 44,
                      width: 44,
                      borderRadius: "50%",
                      mr: 1.5,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                    onError={(e: any) => {
                      e.target.style.display = "none";
                    }}
                  />
                ) : (
                  <PersonRounded
                    sx={{
                      fontSize: 44,
                      mr: 1.5,
                      opacity: 0.7,
                      flexShrink: 0,
                    }}
                  />
                )}
                <Box sx={{ minWidth: 0 }}>
                  <Typography
                    variant="subtitle2"
                    sx={{ fontWeight: "bold" }}
                    noWrap
                  >
                    {user?.nickname || user?.username || "User"}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    noWrap
                    sx={{ display: "block" }}
                  >
                    {t("layout.components.navigation.userInfo.loggedIn")}
                  </Typography>
                </Box>
              </Box>

              <Button
                onClick={handleLogoutClick}
                variant="outlined"
                color="error"
                size="small"
                fullWidth
                startIcon={<LogoutRounded fontSize="small" />}
                sx={{ borderRadius: 1.5 }}
              >
                {t("layout.components.navigation.userInfo.logout")}
              </Button>
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
              {isLogsPage && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                >
                  <Suspense fallback={null}>
                    <LogsPage />
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        </div>
      </Paper>
      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutDialogOpen}
        onClose={handleLogoutCancel}
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
      >
        <DialogTitle id="logout-dialog-title" sx={{ fontWeight: "bold" }}>
          {t("layout.components.navigation.userInfo.logoutConfirmationTitle")}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="logout-dialog-description">
            {t(
              "layout.components.navigation.userInfo.logoutConfirmationMessage",
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleLogoutCancel}
            color="inherit"
            disabled={loggingOut}
          >
            {t("layout.components.navigation.userInfo.cancel")}
          </Button>
          <Button
            onClick={handleLogoutConfirm}
            color="error"
            variant="contained"
            disabled={loggingOut}
            autoFocus
          >
            {loggingOut
              ? t("layout.components.navigation.userInfo.loggingOut")
              : t("layout.components.navigation.userInfo.amountLogout")}
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
};

export default Layout;
