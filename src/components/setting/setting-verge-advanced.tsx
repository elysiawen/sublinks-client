import { ContentCopyRounded } from '@mui/icons-material'
import { Typography } from '@mui/material'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DialogRef, Switch, TooltipIcon } from '@/components/base'
import { updateLastCheckTime, useUpdate } from '@/hooks/use-update'
import { useVerge } from '@/hooks/use-verge'
import {
  exitApp,
  exportDiagnosticInfo,
  openAppDir,
  openCoreDir,
  openDevTools,
  openLogsDir,
} from '@/services/cmds'
import { showNotice } from '@/services/notice-service'
import { checkUpdate, IUpdateInfo } from '@/services/update-service'

const version = import.meta.env.APP_VERSION

import { BackupViewer } from './mods/backup-viewer'
import { ConfigViewer } from './mods/config-viewer'
import { HotkeyViewer } from './mods/hotkey-viewer'
import { LayoutViewer } from './mods/layout-viewer'
import { LiteModeViewer } from './mods/lite-mode-viewer'
import { MiscViewer } from './mods/misc-viewer'
import { SettingItem, SettingList } from './mods/setting-comp'
import { ThemeViewer } from './mods/theme-viewer'
import { UpdateDialog } from './mods/update-dialog'

interface Props {
  onError?: (err: Error) => void
}

const SettingVergeAdvanced = ({ onError: _ }: Props) => {
  const { t } = useTranslation()
  const { verge, patchVerge, mutateVerge } = useVerge()

  const { auto_check_update } = verge || {}

  const onChangeData = (patch: any) => {
    mutateVerge({ ...verge, ...patch }, false)
  }

  const updateEnabled = import.meta.env.UPDATE_ENABLED === 'true'

  const configRef = useRef<DialogRef>(null)
  const hotkeyRef = useRef<DialogRef>(null)
  const miscRef = useRef<DialogRef>(null)
  const themeRef = useRef<DialogRef>(null)
  const layoutRef = useRef<DialogRef>(null)
  const backupRef = useRef<DialogRef>(null)
  const liteModeRef = useRef<DialogRef>(null)

  const [updateInfo, setUpdateInfo] = useState<IUpdateInfo | null>(null)

  const onCheckUpdate = useCallback(async () => {
    try {
      const info = await checkUpdate()
      updateLastCheckTime()
      if (info) {
        setUpdateInfo(info)
      }
    } catch (err: any) {
      showNotice.error(err)
    }
  }, [])

  const onExportDiagnosticInfo = useCallback(async () => {
    await exportDiagnosticInfo()
    showNotice.success('shared.feedback.notifications.common.copySuccess', 1000)
  }, [])

  const copyVersion = useCallback(() => {
    navigator.clipboard.writeText(`v${version}`).then(() => {
      showNotice.success(
        'settings.components.verge.advanced.notifications.versionCopied',
        1000,
      )
    })
  }, [])

  const { updateInfo: autoUpdateInfo } = useUpdate()

  return (
    <SettingList title={t('settings.components.verge.advanced.title')}>
      <ThemeViewer ref={themeRef} />
      <ConfigViewer ref={configRef} />
      <HotkeyViewer ref={hotkeyRef} />
      <MiscViewer ref={miscRef} />
      <LayoutViewer ref={layoutRef} />
      <BackupViewer ref={backupRef} />
      <LiteModeViewer ref={liteModeRef} />

      <SettingItem
        onClick={() => backupRef.current?.open()}
        label={t('settings.components.verge.advanced.fields.backupSetting')}
        extra={
          <TooltipIcon
            title={t('settings.components.verge.advanced.tooltips.backupInfo')}
            sx={{ opacity: '0.7' }}
          />
        }
      />

      <SettingItem
        onClick={() => configRef.current?.open()}
        label={t('settings.components.verge.advanced.fields.runtimeConfig')}
      />

      <SettingItem
        onClick={openAppDir}
        label={t('settings.components.verge.advanced.fields.openConfDir')}
        extra={
          <TooltipIcon
            title={t('settings.components.verge.advanced.tooltips.openConfDir')}
            sx={{ opacity: '0.7' }}
          />
        }
      />

      <SettingItem
        onClick={openCoreDir}
        label={t('settings.components.verge.advanced.fields.openCoreDir')}
      />

      <SettingItem
        onClick={openLogsDir}
        label={t('settings.components.verge.advanced.fields.openLogsDir')}
      />

      <SettingItem
        onClick={updateEnabled ? onCheckUpdate : undefined}
        label={t('settings.components.verge.advanced.fields.checkUpdates')}
      />

      <SettingItem
        onClick={openDevTools}
        label={t('settings.components.verge.advanced.fields.openDevTools')}
      />

      <SettingItem
        label={t('settings.components.verge.advanced.fields.liteModeSettings')}
        extra={
          <TooltipIcon
            title={t('settings.components.verge.advanced.tooltips.liteMode')}
            sx={{ opacity: '0.7' }}
          />
        }
        onClick={() => liteModeRef.current?.open()}
      />

      <SettingItem
        onClick={() => {
          exitApp()
        }}
        label={t('settings.components.verge.advanced.fields.exit')}
      />

      <SettingItem
        label={t('settings.components.verge.advanced.fields.exportDiagnostics')}
        extra={
          <TooltipIcon
            icon={ContentCopyRounded}
            onClick={onExportDiagnosticInfo}
          />
        }
      ></SettingItem>

      {updateEnabled && (
        <SettingItem label={t('settings.modals.misc.fields.autoCheckUpdate')}>
          <Switch
            edge="end"
            checked={auto_check_update !== false}
            onChange={(_, checked) => {
              onChangeData({ auto_check_update: checked })
              patchVerge({ auto_check_update: checked })
            }}
          />
        </SettingItem>
      )}

      <SettingItem
        onClick={updateEnabled ? onCheckUpdate : undefined}
        label={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {t('settings.components.verge.advanced.fields.vergeVersion')}
            <TooltipIcon
              icon={ContentCopyRounded}
              onClick={(e) => {
                e.stopPropagation()
                copyVersion()
              }}
              title={t(
                'settings.components.verge.advanced.actions.copyVersion',
              )}
            />
            {updateEnabled && autoUpdateInfo?.available && (
              <span
                style={{
                  fontSize: 12,
                  color: '#fff',
                  background: '#4caf50',
                  padding: '0 6px',
                  borderRadius: 4,
                  fontWeight: 'bold',
                }}
              >
                NEW
              </span>
            )}
          </div>
        }
      >
        <Typography sx={{ py: '7px', pr: 1 }}>v{version}</Typography>
      </SettingItem>

      <UpdateDialog
        open={!!updateInfo}
        data={updateInfo}
        onClose={() => setUpdateInfo(null)}
      />
    </SettingList>
  )
}

export default SettingVergeAdvanced
