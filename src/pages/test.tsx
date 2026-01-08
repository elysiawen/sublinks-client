import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  AccessTimeOutlined,
  CancelOutlined,
  CheckCircleOutlined,
  HelpOutline,
  PendingOutlined,
  RefreshRounded,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { useLockFn } from "ahooks";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

// test icons
import apple from "@/assets/image/test/apple.svg?raw";
import github from "@/assets/image/test/github.svg?raw";
import google from "@/assets/image/test/google.svg?raw";
import x from "@/assets/image/test/x.svg?raw";
import youtube from "@/assets/image/test/youtube.svg?raw";
import { BaseEmpty, BasePage } from "@/components/base";
import { ScrollTopButton } from "@/components/layout/scroll-top-button";
import { TestItem } from "@/components/test/test-item";
import { TestViewer, TestViewerRef } from "@/components/test/test-viewer";
import { useVerge } from "@/hooks/use-verge";
import { showNotice } from "@/services/notice-service";

interface UnlockItem {
  name: string;
  status: string;
  region?: string | null;
  check_time?: string | null;
}

const UNLOCK_RESULTS_STORAGE_KEY = "clash_verge_unlock_results";
const UNLOCK_RESULTS_TIME_KEY = "clash_verge_unlock_time";

const STATUS_LABEL_KEYS: Record<string, string> = {
  Pending: "tests.statuses.test.pending",
  Yes: "tests.statuses.test.yes",
  No: "tests.statuses.test.no",
  Failed: "tests.statuses.test.failed",
  Completed: "tests.statuses.test.completed",
  "Disallowed ISP": "tests.statuses.test.disallowedIsp",
  "Originals Only": "tests.statuses.test.originalsOnly",
  "No (IP Banned By Disney+)": "tests.statuses.test.noDisney",
  "Unsupported Country/Region": "tests.statuses.test.unsupportedRegion",
  "Failed (Network Connection)": "tests.statuses.test.failedNetwork",
};

const normalizeUnlockName = (name: string) => name.trim().toLowerCase();

const getStatusPriority = (status: string) => (status === "Pending" ? 0 : 1);
const mergeOptionalFields = (preferred: UnlockItem, fallback: UnlockItem) => ({
  ...preferred,
  region: preferred.region ?? fallback.region,
  check_time: preferred.check_time ?? fallback.check_time,
});

const dedupeUnlockItems = (items: UnlockItem[]) => {
  const map = new Map<string, UnlockItem>();
  items.forEach((item) => {
    const key = normalizeUnlockName(item.name);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      return;
    }
    const existingPriority = getStatusPriority(existing.status);
    const itemPriority = getStatusPriority(item.status);
    if (itemPriority > existingPriority) {
      map.set(key, mergeOptionalFields(item, existing));
      return;
    }
    if (itemPriority < existingPriority) {
      map.set(key, mergeOptionalFields(existing, item));
      return;
    }
    map.set(key, mergeOptionalFields(item, existing));
  });
  return Array.from(map.values());
};

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const TestPage = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // --- Web Test Logic ---
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const { verge, mutateVerge, patchVerge } = useVerge();

  const defaultTestList = useMemo(
    () => [
      {
        uid: nanoid(),
        name: "Apple",
        url: "https://www.apple.com",
        icon: apple,
      },
      {
        uid: nanoid(),
        name: "GitHub",
        url: "https://www.github.com",
        icon: github,
      },
      {
        uid: nanoid(),
        name: "Google",
        url: "https://www.google.com",
        icon: google,
      },
      { uid: nanoid(), name: "X", url: "https://x.com", icon: x },
      {
        uid: nanoid(),
        name: "YouTube",
        url: "https://www.youtube.com",
        icon: youtube,
      },
    ],
    [],
  );

  const testList = useMemo(
    () => verge?.test_list ?? defaultTestList,
    [verge, defaultTestList],
  );

  const onTestListItemChange = (
    uid: string,
    patch?: Partial<IVergeTestItem>,
  ) => {
    if (patch) {
      const newList = testList.map((x) =>
        x.uid === uid ? { ...x, ...patch } : x,
      );
      mutateVerge({ ...verge, test_list: newList }, false);
    } else {
      mutateVerge();
    }
  };

  const onDeleteTestListItem = (uid: string) => {
    const newList = testList.filter((x) => x.uid !== uid);
    patchVerge({ test_list: newList });
    mutateVerge({ ...verge, test_list: newList }, false);
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const old_index = testList.findIndex((x) => x.uid === active.id);
      const new_index = testList.findIndex((x) => x.uid === over.id);
      if (old_index >= 0 && new_index >= 0) {
        const newList = [...testList];
        const [removed] = newList.splice(old_index, 1);
        newList.splice(new_index, 0, removed);
        await mutateVerge({ ...verge, test_list: newList }, false);
        await patchVerge({ test_list: newList });
      }
    }
  };

  useEffect(() => {
    if (verge && !verge.test_list) {
      // 如果没有保存的列表，使用默认列表
      patchVerge({ test_list: defaultTestList });
    } else if (verge?.test_list) {
      // 如果有保存的列表，检查是否有新的默认项需要添加
      const existingUrls = new Set(verge.test_list.map((item) => item.url));
      const newItems = defaultTestList.filter(
        (item) => !existingUrls.has(item.url),
      );

      if (newItems.length > 0) {
        // 将新项添加到现有列表末尾
        const mergedList = [...verge.test_list, ...newItems];
        patchVerge({ test_list: mergedList });
      }
    }
  }, [verge, patchVerge, defaultTestList]);

  const viewerRef = useRef<TestViewerRef>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleScroll = (e: any) => {
    setShowScrollTop(e.target.scrollTop > 100);
  };

  // --- Media Test Logic ---
  const [unlockItems, setUnlockItems] = useState<UnlockItem[]>([]);
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [loadingItems, setLoadingItems] = useState<string[]>([]);

  const sortItemsByName = useCallback((items: UnlockItem[]) => {
    return [...items].sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const mergeUnlockItems = useCallback(
    (defaults: UnlockItem[], existing?: UnlockItem[] | null) => {
      if (!existing || existing.length === 0) return defaults;
      const normalizedExisting = dedupeUnlockItems(existing);
      const existingMap = new Map(
        normalizedExisting.map((item) => [
          normalizeUnlockName(item.name),
          item,
        ]),
      );
      const merged = defaults.map((item) => {
        const matchedItem = existingMap.get(normalizeUnlockName(item.name));
        return matchedItem ? { ...matchedItem, name: item.name } : item;
      });
      const mergedNameSet = new Set(
        merged.map((item) => normalizeUnlockName(item.name)),
      );
      normalizedExisting.forEach((item) => {
        if (!mergedNameSet.has(normalizeUnlockName(item.name)))
          merged.push(item);
      });
      return merged;
    },
    [],
  );

  const saveResultsToStorage = useCallback(
    (items: UnlockItem[], time: string | null) => {
      try {
        localStorage.setItem(UNLOCK_RESULTS_STORAGE_KEY, JSON.stringify(items));
        if (time) localStorage.setItem(UNLOCK_RESULTS_TIME_KEY, time);
      } catch (err) {
        console.error("Failed to save results to storage:", err);
      }
    },
    [],
  );

  const loadResultsFromStorage = useCallback(() => {
    try {
      const itemsJson = localStorage.getItem(UNLOCK_RESULTS_STORAGE_KEY);
      const time = localStorage.getItem(UNLOCK_RESULTS_TIME_KEY);
      if (itemsJson)
        return { items: dedupeUnlockItems(JSON.parse(itemsJson)), time };
    } catch (err) {
      console.error("Failed to load results from storage:", err);
    }
    return { items: null, time: null };
  }, []);

  const getUnlockItems = useCallback(
    async (
      existingItems: UnlockItem[] | null = null,
      existingTime: string | null = null,
    ) => {
      try {
        const defaultItems = await invoke<UnlockItem[]>("get_unlock_items");
        const mergedItems = mergeUnlockItems(defaultItems, existingItems);
        const sortedItems = sortItemsByName(mergedItems);
        setUnlockItems(sortedItems);
        saveResultsToStorage(
          sortedItems,
          existingItems && existingItems.length > 0 ? existingTime : null,
        );
      } catch (err) {
        console.error("Failed to get unlock items:", err);
      }
    },
    [mergeUnlockItems, saveResultsToStorage, sortItemsByName],
  );

  useEffect(() => {
    void (async () => {
      const { items: storedItems, time: storedTime } = loadResultsFromStorage();
      if (storedItems && storedItems.length > 0) {
        setUnlockItems(sortItemsByName(storedItems));
        await getUnlockItems(storedItems, storedTime);
      } else {
        await getUnlockItems();
      }
    })();
  }, [getUnlockItems, loadResultsFromStorage, sortItemsByName]);

  const invokeWithTimeout = async <T,>(
    cmd: string,
    args?: any,
    timeout = 15000,
  ): Promise<T> => {
    return Promise.race([
      invoke<T>(cmd, args),
      new Promise<T>((_, reject) =>
        setTimeout(
          () =>
            reject(new Error(t("tests.unlock.page.messages.detectionTimeout"))),
          timeout,
        ),
      ),
    ]);
  };

  const checkAllMedia = useLockFn(async () => {
    try {
      setIsCheckingAll(true);
      const result =
        await invokeWithTimeout<UnlockItem[]>("check_media_unlock");
      const sortedItems = sortItemsByName(dedupeUnlockItems(result));
      setUnlockItems(sortedItems);
      const currentTime = new Date().toLocaleString();
      saveResultsToStorage(sortedItems, currentTime);
      setIsCheckingAll(false);
    } catch (err: any) {
      setIsCheckingAll(false);
      showNotice.error("tests.unlock.page.messages.detectionTimeout", err);
    }
  });

  const checkSingleMedia = useLockFn(async (name: string) => {
    try {
      setLoadingItems((prev) => [...prev, name]);
      const result =
        await invokeWithTimeout<UnlockItem[]>("check_media_unlock");
      const dedupedResult = dedupeUnlockItems(result);
      const targetItem = dedupedResult.find(
        (item) => normalizeUnlockName(item.name) === normalizeUnlockName(name),
      );
      if (targetItem) {
        const updatedItems = sortItemsByName(
          dedupeUnlockItems(
            unlockItems.map((item) =>
              normalizeUnlockName(item.name) === normalizeUnlockName(name)
                ? targetItem
                : item,
            ),
          ),
        );
        setUnlockItems(updatedItems);
        saveResultsToStorage(updatedItems, new Date().toLocaleString());
      }
      setLoadingItems((prev) => prev.filter((item) => item !== name));
    } catch (err: any) {
      setLoadingItems((prev) => prev.filter((item) => item !== name));
      showNotice.error(
        "tests.unlock.page.messages.detectionFailedWithName",
        { name },
        err,
      );
    }
  });

  const getStatusColor = (status: string) => {
    if (status === "Pending") return "default";
    if (status === "Yes") return "success";
    if (status === "No") return "error";
    if (status === "Soon") return "warning";
    if (status.includes("Failed")) return "error";
    if (status === "Completed") return "info";
    return "error";
  };

  const getStatusIcon = (status: string) => {
    if (status === "Pending") return <PendingOutlined />;
    if (status === "Yes") return <CheckCircleOutlined />;
    if (status === "No") return <CancelOutlined />;
    if (status === "Soon") return <AccessTimeOutlined />;
    return <HelpOutline />;
  };

  const getStatusBorderColor = (status: string) => {
    if (status === "Yes") return theme.palette.success.main;
    if (status === "No" || status.includes("Failed"))
      return theme.palette.error.main;
    if (status === "Soon") return theme.palette.warning.main;
    if (status === "Completed") return theme.palette.info.main;
    return theme.palette.divider;
  };

  const isDark = theme.palette.mode === "dark";

  return (
    <BasePage
      full
      title={t("layout.components.navigation.tabs.test")}
      header={
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {tabValue === 0 && (
            <>
              <Button
                variant="contained"
                size="small"
                onClick={() => emit("verge://test-all")}
              >
                {t("tests.page.actions.testAll")}
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => viewerRef.current?.create()}
              >
                {t("shared.actions.new")}
              </Button>
            </>
          )}
          {tabValue === 1 && (
            <Button
              variant="contained"
              size="small"
              disabled={isCheckingAll}
              onClick={checkAllMedia}
              startIcon={
                isCheckingAll ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <RefreshRounded />
                )
              }
            >
              {isCheckingAll
                ? t("tests.unlock.page.actions.testing")
                : t("tests.page.actions.testAll")}
            </Button>
          )}
        </Box>
      }
    >
      <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="test tabs"
        >
          <Tab
            label={t("layout.components.navigation.tabs.test_web")}
            id="test-tab-0"
          />
          <Tab
            label={t("layout.components.navigation.tabs.test_media")}
            id="test-tab-1"
          />
        </Tabs>
      </Box>

      <CustomTabPanel value={tabValue} index={0}>
        <Box
          ref={containerRef}
          onScroll={handleScroll}
          sx={{
            pt: 0,
            mb: 0.5,
            px: "10px",
            height: "calc(100vh - 160px)",
            overflow: "auto",
            position: "relative",
          }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <Box sx={{ mb: 4.5 }}>
              <Grid container spacing={1}>
                <SortableContext items={testList.map((x) => x.uid)}>
                  {testList.map((item) => (
                    <Grid
                      component={"div"}
                      size={{ xs: 6, lg: 2, sm: 4, md: 3 }}
                      key={item.uid}
                    >
                      <TestItem
                        id={item.uid}
                        itemData={item}
                        onEdit={() => viewerRef.current?.edit(item)}
                        onDelete={onDeleteTestListItem}
                      />
                    </Grid>
                  ))}
                </SortableContext>
              </Grid>
            </Box>
          </DndContext>
          <ScrollTopButton
            onClick={scrollToTop}
            show={showScrollTop}
            sx={{
              position: "absolute",
              bottom: "20px",
              left: "20px",
              zIndex: 1000,
            }}
          />
        </Box>
        <TestViewer ref={viewerRef} onChange={onTestListItemChange} />
      </CustomTabPanel>

      <CustomTabPanel value={tabValue} index={1}>
        <Box sx={{ px: 2, height: "calc(100vh - 160px)", overflow: "auto" }}>
          {unlockItems.length === 0 ? (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "50%",
              }}
            >
              <BaseEmpty textKey="tests.unlock.page.empty" />
            </Box>
          ) : (
            <Grid container spacing={1.5} columns={{ xs: 1, sm: 2, md: 3 }}>
              {unlockItems.map((item) => (
                <Grid size={1} key={item.name}>
                  <Card
                    variant="outlined"
                    sx={{
                      height: "100%",
                      borderRadius: 2,
                      borderLeft: `4px solid ${getStatusBorderColor(item.status)}`,
                      backgroundColor: isDark ? "#282a36" : "#ffffff",
                      position: "relative",
                      overflow: "hidden",
                      "&:hover": {
                        backgroundColor: isDark
                          ? alpha("#fff", 0.05)
                          : alpha("#000", 0.05),
                      },
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Box sx={{ p: 1.3, flex: 1 }}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography
                          variant="subtitle1"
                          sx={{ fontWeight: 600 }}
                        >
                          {item.name}
                        </Typography>
                        <Tooltip
                          title={t("tests.components.item.actions.test")}
                        >
                          <span>
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={
                                loadingItems.includes(item.name) ||
                                isCheckingAll
                              }
                              sx={{
                                minWidth: "32px",
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                              }}
                              onClick={() => checkSingleMedia(item.name)}
                            >
                              <RefreshRounded
                                sx={{
                                  animation: loadingItems.includes(item.name)
                                    ? "spin 1s linear infinite"
                                    : "none",
                                  "@keyframes spin": {
                                    "0%": { transform: "rotate(0deg)" },
                                    "100%": { transform: "rotate(360deg)" },
                                  },
                                }}
                              />
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 1,
                        }}
                      >
                        <Chip
                          label={t(
                            STATUS_LABEL_KEYS[item.status] ?? item.status,
                          )}
                          color={getStatusColor(item.status)}
                          size="small"
                          icon={getStatusIcon(item.status)}
                          sx={{
                            fontWeight:
                              item.status === "Pending" ? "normal" : "bold",
                          }}
                        />
                        {item.region && (
                          <Chip
                            label={item.region}
                            size="small"
                            variant="outlined"
                            color="info"
                          />
                        )}
                      </Box>
                    </Box>
                    <Divider sx={{ borderStyle: "dashed", mx: 1 }} />
                    <Box sx={{ px: 1.5, py: 0.2 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          display: "block",
                          color: "text.secondary",
                          textAlign: "right",
                        }}
                      >
                        {item.check_time || "-- --"}
                      </Typography>
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Box>
      </CustomTabPanel>
    </BasePage>
  );
};

export default TestPage;
