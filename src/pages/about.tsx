import { Grid, Skeleton, Paper, Typography, Link } from "@mui/material";
import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";

import { BasePage } from "@/components/base";
import { openWebUrl } from "@/services/cmds";

const LazyIpInfoCard = lazy(() =>
  import("@/components/home/ip-info-card").then((module) => ({
    default: module.IpInfoCard,
  })),
);
const LazyClashInfoCard = lazy(() =>
  import("@/components/home/clash-info-card").then((module) => ({
    default: module.ClashInfoCard,
  })),
);
const LazySystemInfoCard = lazy(() =>
  import("@/components/home/system-info-card").then((module) => ({
    default: module.SystemInfoCard,
  })),
);

const AboutPage = () => {
  const { t } = useTranslation();

  return (
    <BasePage
      title={t("layout.components.navigation.tabs.about")}
      contentStyle={{ padding: 2 }}
    >
      <Grid container spacing={1.5} columns={{ xs: 6, sm: 6, md: 12 }}>
        <Grid size={6}>
          <Suspense fallback={<Skeleton variant="rectangular" height={200} />}>
            <LazyIpInfoCard />
          </Suspense>
        </Grid>
        <Grid size={6}>
          <Suspense fallback={<Skeleton variant="rectangular" height={200} />}>
            <LazyClashInfoCard />
          </Suspense>
        </Grid>
        <Grid size={12}>
          <Suspense fallback={<Skeleton variant="rectangular" height={200} />}>
            <LazySystemInfoCard />
          </Suspense>
        </Grid>

        <Grid size={12}>
          <Paper
            sx={{
              p: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t("layout.components.navigation.aboutPage.attribution")}
            </Typography>
            <Link
              component="button"
              variant="body2"
              onClick={() =>
                openWebUrl("https://github.com/clash-verge-rev/clash-verge-rev")
              }
            >
              https://github.com/clash-verge-rev/clash-verge-rev
            </Link>
          </Paper>
        </Grid>
      </Grid>
    </BasePage>
  );
};

export default AboutPage;
