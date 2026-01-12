import React from "react";
import { useTranslation } from "react-i18next";

import { Switch } from "@/components/base";
import { useVerge } from "@/hooks/use-verge";

import { GuardState } from "./mods/guard-state";
import { SettingList, SettingItem } from "./mods/setting-comp";

interface Props {
  onError?: (err: Error) => void;
}

const SettingSubLinks = ({ onError }: Props) => {
  const { t } = useTranslation();

  const { verge, mutateVerge, patchVerge } = useVerge();

  const { sublinks_auto_sync } = verge ?? {};

  const onSwitchFormat = (
    _e: React.ChangeEvent<HTMLInputElement>,
    value: boolean,
  ) => value;

  const onChangeData = (patch: Partial<IVergeConfig>) => {
    mutateVerge({ ...verge, ...patch }, false);
  };

  return (
    <SettingList title={t("settings.sections.sublinks.title") as string}>
      <SettingItem
        label={t("settings.sections.sublinks.fields.autoSync") as string}
        secondary={
          t("settings.sections.sublinks.descriptions.autoSync") as string
        }
      >
        <GuardState
          value={sublinks_auto_sync ?? false}
          valueProps="checked"
          onCatch={(err) => {
            console.error("[SubLinks Settings] Error:", err);
            onError?.(err);
          }}
          onFormat={onSwitchFormat}
          onChange={(e) => onChangeData({ sublinks_auto_sync: e })}
          onGuard={(e) => patchVerge({ sublinks_auto_sync: e })}
        >
          <Switch edge="end" />
        </GuardState>
      </SettingItem>
    </SettingList>
  );
};

export default SettingSubLinks;
