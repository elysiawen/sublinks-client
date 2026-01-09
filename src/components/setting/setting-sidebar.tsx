import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Switch } from "@/components/base";
import { SUBLINKS_CONFIG } from "@/configs/sublinks-config";
import { navItems } from "@/pages/_routers";

import { SettingItem, SettingList } from "./mods/setting-comp";

const SettingSidebar = () => {
  const { t } = useTranslation();

  // Visibility state: Record<path, isVisible>
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem(
      SUBLINKS_CONFIG.STORAGE_KEYS.SIDEBAR_VISIBILITY,
    );
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse sidebar visibility", e);
      }
    }
    // Default: all visible
    const defaultVisibility: Record<string, boolean> = {};
    navItems.forEach((item) => {
      defaultVisibility[item.path] = true;
    });
    return defaultVisibility;
  });

  const toggleVisibility = (path: string) => {
    const newVisibility = {
      ...visibility,
      [path]: !visibility[path],
    };
    setVisibility(newVisibility);
    localStorage.setItem(
      SUBLINKS_CONFIG.STORAGE_KEYS.SIDEBAR_VISIBILITY,
      JSON.stringify(newVisibility),
    );
    // Reload is required to apply changes to the sidebar in _layout.tsx
    // Alternatively, a custom event or a global state could be used.
    // For now, let's just save it. The layout will pick it up on next render if we use state there too.
    // Actually, dispatching a storage event for cross-tab or custom event for same window
    window.dispatchEvent(new Event("sidebar-visibility-change"));
  };

  const essentialPaths = ["/", "/settings"];

  return (
    <SettingList title={t("settings.components.sidebar.title")}>
      {navItems.map((item) => {
        const isEssential = essentialPaths.includes(item.path);
        return (
          <SettingItem
            key={item.path}
            label={t(item.label)}
            secondary={
              isEssential
                ? t("settings.components.sidebar.essential")
                : item.path
            }
          >
            <Switch
              edge="end"
              disabled={isEssential}
              checked={isEssential || visibility[item.path] !== false}
              onChange={(
                _e: React.ChangeEvent<HTMLInputElement>,
                _val: boolean,
              ) => toggleVisibility(item.path)}
            />
          </SettingItem>
        );
      })}
    </SettingList>
  );
};

export default SettingSidebar;
