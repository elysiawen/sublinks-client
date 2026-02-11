import { Box, Typography } from "@mui/material";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import { BaseDialog } from "@/components/base";
import { openWebUrl } from "@/services/cmds";
import { IUpdateInfo } from "@/services/update-service";

interface Props {
  open: boolean;
  data: IUpdateInfo | null;
  onClose: () => void;
}

export const UpdateDialog = ({ open, data, onClose }: Props) => {
  const { t } = useTranslation();

  if (!data) return null;

  const handleDownload = () => {
    // Construct download link
    const UPDATE_API_URL = import.meta.env.UPDATE_API_URL;
    const baseUrl = new URL(UPDATE_API_URL).origin;
    // Check if downloadUrl is absolute or relative
    let downloadLink = data.downloadUrl;
    try {
      // If it throws, it's relative
      new URL(downloadLink);
    } catch {
      downloadLink = new URL(data.downloadUrl, baseUrl).toString();
    }

    openWebUrl(downloadLink);
    onClose();
  };

  return (
    <BaseDialog
      open={open}
      onClose={onClose}
      onCancel={onClose}
      onOk={handleDownload}
      title={t("settings.components.verge.updateDialog.title" as any)}
      okBtn={t("settings.components.verge.updateDialog.download" as any)}
      cancelBtn={t("settings.components.verge.updateDialog.cancel" as any)}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="h6" sx={{ fontSize: "1.1rem" }}>
          v{data.version.version}
        </Typography>

        <Box
          sx={{
            display: "flex",
            gap: 1,
            color: "text.secondary",
            fontSize: "0.85rem",
          }}
        >
          <span>
            {t("settings.components.verge.updateDialog.releaseTime" as any)}:
          </span>
          <span>
            {dayjs(data.version.uploadedAt).format("YYYY-MM-DD HH:mm:ss")}
          </span>
        </Box>
      </Box>
    </BaseDialog>
  );
};
