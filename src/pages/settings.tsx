import { Box, Grid } from "@mui/material";
import { useTranslation } from "react-i18next";

import { BasePage } from "@/components/base";
import SettingClash from "@/components/setting/setting-clash";
import SettingSidebar from "@/components/setting/setting-sidebar";
import SettingSubLinks from "@/components/setting/setting-sublinks";
import SettingSystem from "@/components/setting/setting-system";
import SettingVergeAdvanced from "@/components/setting/setting-verge-advanced";
import SettingVergeBasic from "@/components/setting/setting-verge-basic";
import { showNotice } from "@/services/notice-service";
import { useThemeMode } from "@/services/states";

const SettingPage = () => {
  const { t } = useTranslation();

  const onError = (err: any) => {
    showNotice.error(err);
  };

  const mode = useThemeMode();
  const isDark = mode === "light" ? false : true;

  return (
    <BasePage title={t("settings.page.title")} header={null}>
      <Grid container spacing={1.5} columns={{ xs: 6, sm: 6, md: 12 }}>
        <Grid size={6}>
          <Box
            sx={{
              borderRadius: 2,
              marginBottom: 1.5,
              backgroundColor: isDark ? "#282a36" : "#ffffff",
            }}
          >
            <SettingSubLinks onError={onError} />
          </Box>
          <Box
            sx={{
              borderRadius: 2,
              marginBottom: 1.5,
              backgroundColor: isDark ? "#282a36" : "#ffffff",
            }}
          >
            <SettingClash onError={onError} />
          </Box>

          <Box
            sx={{
              borderRadius: 2,
              backgroundColor: isDark ? "#282a36" : "#ffffff",
            }}
          >
            <SettingSidebar />
          </Box>
        </Grid>
        <Grid size={6}>
          <Box
            sx={{
              borderRadius: 2,
              marginBottom: 1.5,
              backgroundColor: isDark ? "#282a36" : "#ffffff",
            }}
          >
            <SettingSystem onError={onError} />
          </Box>
          <Box
            sx={{
              borderRadius: 2,
              marginBottom: 1.5,
              backgroundColor: isDark ? "#282a36" : "#ffffff",
            }}
          >
            <SettingVergeBasic onError={onError} />
          </Box>
          <Box
            sx={{
              borderRadius: 2,
              backgroundColor: isDark ? "#282a36" : "#ffffff",
            }}
          >
            <SettingVergeAdvanced onError={onError} />
          </Box>
        </Grid>
      </Grid>
    </BasePage>
  );
};

export default SettingPage;
