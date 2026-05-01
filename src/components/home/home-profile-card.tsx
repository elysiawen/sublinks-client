import {
  CloudUploadOutlined,
  EventOutlined,
  LaunchOutlined,
  SpeedOutlined,
  StorageOutlined,
  UpdateOutlined,
} from '@mui/icons-material'
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  Link,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Typography,
  alpha,
  keyframes,
  useTheme,
} from '@mui/material'
import { useLockFn } from 'ahooks'
import dayjs from 'dayjs'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'

import { useProfiles } from '@/hooks/use-profiles'
import { useAppRefreshers } from '@/providers/app-data-context'
import { openWebUrl, updateProfile } from '@/services/cmds'
import { showNotice } from '@/services/notice-service'
import parseTraffic from '@/utils/parse-traffic'

import { EnhancedCard } from './enhanced-card'

// 定义旋转动画
const round = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`

// 辅助函数解析过期时间
const parseExpire = (expire?: number) => {
  if (!expire) return '-'
  return dayjs(expire * 1000).format('YYYY-MM-DD')
}

interface HomeProfileCardProps {
  current: IProfileItem | null | undefined
  onProfileUpdated?: () => void
}

// 提取独立组件减少主组件复杂度
const ProfileDetails = ({
  current,
  allProfiles,
  onUpdateProfile,
  onProfileChange,
  updating,
  switching,
}: {
  current: IProfileItem
  allProfiles: IProfileItem[]
  onUpdateProfile: () => void
  onProfileChange: (uid: string) => void
  updating: boolean
  switching: boolean
}) => {
  const { t } = useTranslation()
  const theme = useTheme()

  const usedTraffic = useMemo(() => {
    if (!current.extra) return 0
    return current.extra.upload + current.extra.download
  }, [current.extra])

  const trafficPercentage = useMemo(() => {
    if (!current.extra || !current.extra.total || current.extra.total <= 0)
      return 0
    return Math.min(Math.round((usedTraffic / current.extra.total) * 100), 100)
  }, [current.extra, usedTraffic])

  const handleSelectChange = (event: SelectChangeEvent) => {
    onProfileChange(event.target.value as string)
  }

  return (
    <Box>
      <Stack spacing={1.5}>
        <FormControl fullWidth variant="outlined" size="small">
          <InputLabel id="home-profile-select-label">
            {t('profiles.page.title')}
          </InputLabel>
          <Select
            labelId="home-profile-select-label"
            value={current.uid}
            label={t('profiles.page.title')}
            onChange={handleSelectChange}
            disabled={switching || updating}
            MenuProps={{
              slotProps: {
                paper: {
                  style: {
                    maxHeight: 400,
                  },
                },
              },
            }}
            sx={{
              '& .MuiSelect-select': {
                py: 1,
                display: 'flex',
                alignItems: 'center',
              },
            }}
            endAdornment={
              switching ? (
                <CircularProgress
                  size={18}
                  sx={{
                    position: 'absolute',
                    right: 32,
                    top: 'calc(50% - 9px)',
                  }}
                />
              ) : null
            }
          >
            {allProfiles.map((profile) => (
              <MenuItem
                key={profile.uid}
                value={profile.uid}
                sx={{
                  py: 1,
                  px: 2,
                  minHeight: 'auto',
                  fontSize: '0.875rem',
                  '&.Mui-selected': {
                    fontWeight: 'bold',
                  },
                }}
              >
                <Typography variant="body2" noWrap>
                  {profile.name ||
                    (profile.type === 'remote'
                      ? 'Remote Profile'
                      : 'Local Profile')}
                </Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {current.updated && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <UpdateOutlined
              fontSize="small"
              color="action"
              sx={{
                cursor: 'pointer',
                animation: updating ? `${round} 1.5s linear infinite` : 'none',
              }}
              onClick={onUpdateProfile}
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ cursor: 'pointer' }}
              onClick={onUpdateProfile}
            >
              {t('shared.labels.updateTime')}:{' '}
              <Box component="span" sx={{ fontWeight: 'medium' }}>
                {dayjs(current.updated * 1000).format('YYYY-MM-DD HH:mm')}
              </Box>
            </Typography>
          </Stack>
        )}

        {current.extra && (
          <>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <SpeedOutlined fontSize="small" color="action" />
              <Typography variant="body2" color="text.secondary">
                {t('shared.labels.usedTotal')}:{' '}
                <Box component="span" sx={{ fontWeight: 'medium' }}>
                  {parseTraffic(usedTraffic)} /{' '}
                  {parseTraffic(current.extra.total)}
                </Box>
              </Typography>
            </Stack>

            {current.extra.expire > 0 && (
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <EventOutlined fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {t('shared.labels.expireTime')}:{' '}
                  <Box component="span" sx={{ fontWeight: 'medium' }}>
                    {parseExpire(current.extra.expire)}
                  </Box>
                </Typography>
              </Stack>
            )}

            <Box sx={{ mt: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, display: 'block' }}
              >
                {trafficPercentage}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={trafficPercentage}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: alpha(theme.palette.primary.main, 0.12),
                }}
              />
            </Box>
          </>
        )}
      </Stack>
    </Box>
  )
}

// 提取空配置组件
const EmptyProfile = ({ onClick }: { onClick: () => void }) => {
  const { t } = useTranslation()

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 2.4,
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        borderRadius: 2,
      }}
      onClick={onClick}
    >
      <CloudUploadOutlined
        sx={{ fontSize: 60, color: 'primary.main', mb: 2 }}
      />
      <Typography variant="h6" sx={{ mb: 1 }}>
        {t('profiles.page.actions.import')} {t('profiles.page.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t('profiles.components.card.labels.clickToImport')}
      </Typography>
    </Box>
  )
}

export const HomeProfileCard = ({
  current: currentProp,
  onProfileUpdated,
}: HomeProfileCardProps) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refreshAll, isProfileSwitching, setIsProfileSwitching } = useAppRefreshers()
  const { profiles, patchProfiles, mutateProfiles } = useProfiles()

  // 优先使用来自 hook 的 current，如果没有则使用 props 里的
  const current = useMemo(() => {
    if (profiles?.items && profiles.current) {
      return profiles.items.find((p) => p && p.uid === profiles.current)
    }
    return currentProp
  }, [profiles, currentProp])

  const allProfiles = useMemo(() => {
    const items = profiles?.items || []
    const allowedTypes = ['local', 'remote']
    return items.filter(
      (p): p is IProfileItem =>
        !!p && !!p.uid && allowedTypes.includes(p.type || ''),
    )
  }, [profiles])

  // 更新当前订阅
  const [updating, setUpdating] = useState(false)

  const onUpdateProfile = useLockFn(async () => {
    if (!current?.uid || isProfileSwitching) return

    setUpdating(true)
    try {
      await updateProfile(current.uid, current.option)
      onProfileUpdated?.()
      mutateProfiles()

      // 刷新首页数据
      refreshAll()
    } catch (err) {
      showNotice.error(err, 3000)
    } finally {
      setUpdating(false)
    }
  })

  // 切换订阅
  const onProfileChange = useCallback(
    async (uid: string) => {
      if (uid === current?.uid || updating) return
      setIsProfileSwitching(true)
      try {
        await patchProfiles({ current: uid })
        onProfileUpdated?.()

        // 给内核一点时间稳定其内部状态
        await new Promise((resolve) => setTimeout(resolve, 500))

        // 等待数据刷新完成再关闭加载状态
        await refreshAll()
      } catch (err) {
        showNotice.error(err, 3000)
      } finally {
        setIsProfileSwitching(false)
      }
    },
    [
      current?.uid,
      patchProfiles,
      onProfileUpdated,
      refreshAll,
      updating,
      setIsProfileSwitching,
    ],
  )

  // 导航到订阅页面
  const goToProfiles = useCallback(() => {
    navigate('/profile')
  }, [navigate])

  // 卡片标题
  const cardTitle = useMemo(() => {
    if (!current) return t('profiles.page.title')

    if (!current.home) return current.name

    return (
      <Link
        component="button"
        variant="h6"
        onClick={() => current.home && openWebUrl(current.home)}
        sx={{
          color: 'inherit',
          textDecoration: 'none',
          display: 'flex',
          alignItems: 'center',
          minWidth: 0,
          maxWidth: '100%',
          fontWeight: 'medium',
          fontSize: 18,
          '& > span': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          },
        }}
        title={current.name}
      >
        <span>{current.name}</span>
        <LaunchOutlined
          fontSize="inherit"
          sx={{
            ml: 0.5,
            fontSize: '0.8rem',
            opacity: 0.7,
            flexShrink: 0,
          }}
        />
      </Link>
    )
  }, [current, t])

  // 卡片操作按钮
  const cardAction = useMemo(() => {
    if (!current) return null

    return (
      <Button
        variant="outlined"
        size="small"
        onClick={goToProfiles}
        endIcon={<StorageOutlined fontSize="small" />}
        sx={{ borderRadius: 1.5 }}
      >
        {t('layout.components.navigation.tabs.profiles')}
      </Button>
    )
  }, [current, goToProfiles, t])

  return (
    <EnhancedCard
      title={cardTitle}
      icon={<CloudUploadOutlined />}
      iconColor="info"
      action={cardAction}
    >
      {current ? (
        <ProfileDetails
          current={current}
          allProfiles={allProfiles}
          onUpdateProfile={onUpdateProfile}
          onProfileChange={onProfileChange}
          updating={updating}
          switching={isProfileSwitching}
        />
      ) : (
        <EmptyProfile onClick={goToProfiles} />
      )}
    </EnhancedCard>
  )
}
