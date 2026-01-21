import {
  DnsOutlined,
  HistoryEduOutlined,
  RouterOutlined,
  SettingsOutlined,
  SpeedOutlined,
  RefreshRounded,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { BasePage } from "@/components/base";
import { ClashModeCard } from "@/components/home/clash-mode-card";
import { CurrentProxyCard } from "@/components/home/current-proxy-card";
import { EnhancedCard } from "@/components/home/enhanced-card";
import { EnhancedTrafficStats } from "@/components/home/enhanced-traffic-stats";
import { HomeProfileCard } from "@/components/home/home-profile-card";
import { ProxyTunCard } from "@/components/home/proxy-tun-card";
import { SUBLINKS_CONFIG } from "@/configs/sublinks-config";
import { useProfiles } from "@/hooks/use-profiles";
import { useVerge } from "@/hooks/use-verge";
import { entry_lightweight_mode } from "@/services/cmds";
// Removed local welcomeBg import to use API

// Moved cards to About and Test pages

// 定义首页卡片设置接口
interface HomeCardsSettings {
  profile: boolean;
  proxy: boolean;
  network: boolean;
  mode: boolean;
  traffic: boolean;
  [key: string]: boolean;
}

// 首页设置对话框组件接口
interface HomeSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  homeCards: HomeCardsSettings;
  onSave: (cards: HomeCardsSettings) => void;
}

const serializeCardFlags = (cards: HomeCardsSettings) =>
  Object.keys(cards)
    .sort()
    .map((key) => `${key}:${cards[key] ? 1 : 0}`)
    .join("|");

// 首页设置对话框组件
const HomeSettingsDialog = ({
  open,
  onClose,
  homeCards,
  onSave,
}: HomeSettingsDialogProps) => {
  const { t } = useTranslation();
  const [cards, setCards] = useState<HomeCardsSettings>(homeCards);
  const { patchVerge } = useVerge();

  const handleToggle = (key: string) => {
    setCards((prev: HomeCardsSettings) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    await patchVerge({ home_cards: cards });
    onSave(cards);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("home.page.settings.title")}</DialogTitle>
      <DialogContent>
        <FormGroup>
          <FormControlLabel
            control={
              <Checkbox
                checked={cards.profile || false}
                onChange={() => handleToggle("profile")}
              />
            }
            label={t("home.page.settings.cards.profile")}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={cards.proxy || false}
                onChange={() => handleToggle("proxy")}
              />
            }
            label={t("home.page.settings.cards.currentProxy")}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={cards.network || false}
                onChange={() => handleToggle("network")}
              />
            }
            label={t("home.page.settings.cards.network")}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={cards.mode || false}
                onChange={() => handleToggle("mode")}
              />
            }
            label={t("home.page.settings.cards.proxyMode")}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={cards.traffic || false}
                onChange={() => handleToggle("traffic")}
              />
            }
            label={t("home.page.settings.cards.traffic")}
          />
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("shared.actions.cancel")}</Button>
        <Button onClick={handleSave} color="primary">
          {t("shared.actions.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const WelcomeBanner = () => {
  const { t } = useTranslation();
  const userStr = localStorage.getItem(SUBLINKS_CONFIG.STORAGE_KEYS.USER);
  const user = useMemo(() => {
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }, [userStr]);

  const [hitokoto, setHitokoto] = useState("");

  // Cache background image URL in sessionStorage to reduce API calls
  const [bgUrl, setBgUrl] = useState(() => {
    const cached = sessionStorage.getItem("home_bg_url");
    if (cached) return cached;
    const newUrl = `${SUBLINKS_CONFIG.BACKGROUND_IMAGE_API}?seed=${Math.random()}`;
    sessionStorage.setItem("home_bg_url", newUrl);
    return newUrl;
  });

  const handleRefreshBackground = () => {
    const newUrl = `${SUBLINKS_CONFIG.BACKGROUND_IMAGE_API}?seed=${Math.random()}`;
    sessionStorage.setItem("home_bg_url", newUrl);
    setBgUrl(newUrl);
  };

  useEffect(() => {
    const fetchGreeting = () => {
      // eslint-disable-next-line
      setHitokoto(t("home.components.welcomeBanner.hitokoto.loading"));
      fetch(SUBLINKS_CONFIG.HITOKOTO_API)
        .then((res) => res.json())
        .then((data) => {
          setHitokoto(data.hitokoto);
        })
        .catch((err) => {
          console.error("Failed to fetch hitokoto", err);
          setHitokoto(t("home.components.welcomeBanner.hitokoto.fallback"));
        });
    };
    fetchGreeting();
  }, [t]);

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5)
      return t("home.components.welcomeBanner.greetings.earlyMorning");
    if (hour >= 5 && hour < 9)
      return t("home.components.welcomeBanner.greetings.morning");
    if (hour >= 9 && hour < 11)
      return t("home.components.welcomeBanner.greetings.forenoon");
    if (hour >= 11 && hour < 13)
      return t("home.components.welcomeBanner.greetings.noon");
    if (hour >= 13 && hour < 18)
      return t("home.components.welcomeBanner.greetings.afternoon");
    if (hour >= 18 && hour < 20)
      return t("home.components.welcomeBanner.greetings.evening");
    if (hour >= 20 && hour < 23)
      return t("home.components.welcomeBanner.greetings.night");
    return t("home.components.welcomeBanner.greetings.lateNight");
  };

  const username = user?.nickname || user?.username || "Guest";
  const greeting = getTimeGreeting();

  return (
    <Box
      sx={{
        mb: 2,
        borderRadius: "16px",
        overflow: "hidden",
        position: "relative",
        height: "160px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        px: 4,
        color: "#fff",
        backgroundImage: `url(${bgUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          zIndex: 1,
        },
      }}
    >
      <Box sx={{ zIndex: 2 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            mb: 1,
            textShadow: "0 2px 4px rgba(0,0,0,0.5)",
            fontSize: { xs: "1.5rem", md: "2rem" },
          }}
        >
          {greeting}，{username}!
        </Typography>
        <Typography
          variant="body1"
          sx={{
            fontWeight: 500,
            opacity: 0.9,
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
            fontStyle: "italic",
          }}
        >
          {hitokoto}
        </Typography>
      </Box>
      {/* Refresh button in bottom-right corner */}
      <Tooltip
        title={t("home.components.welcomeBanner.tooltips.refreshBackground")}
        placement="left"
      >
        <IconButton
          onClick={handleRefreshBackground}
          sx={{
            position: "absolute",
            bottom: 8,
            right: 8,
            zIndex: 2,
            color: "white",
            bgcolor: "rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(10px)",
            ":hover": {
              bgcolor: "rgba(255, 255, 255, 0.25)",
              transform: "rotate(180deg)",
            },
            transition: "all 0.3s ease",
          }}
          size="small"
        >
          <RefreshRounded fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

const HomePage = () => {
  const { t } = useTranslation();
  const { verge } = useVerge();
  const { current, mutateProfiles } = useProfiles();

  // 设置弹窗的状态
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localHomeCards, setLocalHomeCards] = useState<{
    value: HomeCardsSettings;
    baseSignature: string;
  } | null>(null);

  // 卡片显示状态
  const defaultCards = useMemo<HomeCardsSettings>(
    () => ({
      profile: true,
      proxy: true,
      network: true,
      mode: true,
      traffic: true,
    }),
    [],
  );

  const vergeHomeCards = useMemo<HomeCardsSettings | null>(
    () => (verge?.home_cards as HomeCardsSettings | undefined) ?? null,
    [verge],
  );

  const remoteHomeCards = useMemo<HomeCardsSettings>(
    () => vergeHomeCards ?? defaultCards,
    [defaultCards, vergeHomeCards],
  );

  const remoteSignature = useMemo(
    () => serializeCardFlags(remoteHomeCards),
    [remoteHomeCards],
  );

  const pendingLocalCards = useMemo<HomeCardsSettings | null>(() => {
    if (!localHomeCards) return null;
    return localHomeCards.baseSignature === remoteSignature
      ? localHomeCards.value
      : null;
  }, [localHomeCards, remoteSignature]);

  const effectiveHomeCards = pendingLocalCards ?? remoteHomeCards;

  // 新增：打开设置弹窗
  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const renderCard = useCallback(
    (cardKey: string, component: React.ReactNode, size: number = 6) => {
      if (!effectiveHomeCards[cardKey]) return null;

      return (
        <Grid size={size} key={cardKey}>
          {component}
        </Grid>
      );
    },
    [effectiveHomeCards],
  );

  const criticalCards = useMemo(
    () => [
      renderCard(
        "profile",
        <HomeProfileCard current={current} onProfileUpdated={mutateProfiles} />,
      ),
      renderCard("proxy", <CurrentProxyCard />),
      renderCard("network", <NetworkSettingsCard />),
      renderCard("mode", <ClashModeEnhancedCard />),
    ],
    [current, mutateProfiles, renderCard],
  );

  // 新增：保存设置时用requestIdleCallback/setTimeout
  const handleSaveSettings = (newCards: HomeCardsSettings) => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() =>
        setLocalHomeCards({
          value: newCards,
          baseSignature: remoteSignature,
        }),
      );
    } else {
      setTimeout(
        () =>
          setLocalHomeCards({
            value: newCards,
            baseSignature: remoteSignature,
          }),
        0,
      );
    }
  };

  const nonCriticalCards = useMemo(
    () => [
      renderCard(
        "traffic",
        <EnhancedCard
          title={t("home.page.cards.trafficStats")}
          icon={<SpeedOutlined />}
          iconColor="secondary"
        >
          <EnhancedTrafficStats />
        </EnhancedCard>,
        12,
      ),
    ],
    [t, renderCard],
  );
  const dialogKey = useMemo(
    () => `${serializeCardFlags(effectiveHomeCards)}:${settingsOpen ? 1 : 0}`,
    [effectiveHomeCards, settingsOpen],
  );
  return (
    <BasePage
      title={t("home.page.title")}
      contentStyle={{ padding: 2 }}
      header={
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Tooltip title={t("home.page.tooltips.lightweightMode")} arrow>
            <IconButton
              onClick={async () => await entry_lightweight_mode()}
              size="small"
              color="inherit"
            >
              <HistoryEduOutlined />
            </IconButton>
          </Tooltip>

          <Tooltip title={t("home.page.tooltips.settings")} arrow>
            <IconButton onClick={openSettings} size="small" color="inherit">
              <SettingsOutlined />
            </IconButton>
          </Tooltip>
        </Box>
      }
    >
      <WelcomeBanner />

      <Grid container spacing={1.5} columns={{ xs: 6, sm: 6, md: 12 }}>
        {criticalCards}

        {nonCriticalCards}
      </Grid>

      {/* 首页设置弹窗 */}
      <HomeSettingsDialog
        key={dialogKey}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        homeCards={effectiveHomeCards}
        onSave={handleSaveSettings}
      />
    </BasePage>
  );
};

// 增强版网络设置卡片组件
const NetworkSettingsCard = () => {
  const { t } = useTranslation();
  return (
    <EnhancedCard
      title={t("home.page.cards.networkSettings")}
      icon={<DnsOutlined />}
      iconColor="primary"
      action={null}
    >
      <ProxyTunCard />
    </EnhancedCard>
  );
};

// 增强版 Clash 模式卡片组件
const ClashModeEnhancedCard = () => {
  const { t } = useTranslation();
  return (
    <EnhancedCard
      title={t("home.page.cards.proxyMode")}
      icon={<RouterOutlined />}
      iconColor="info"
      action={null}
    >
      <ClashModeCard />
    </EnhancedCard>
  );
};

export default HomePage;
