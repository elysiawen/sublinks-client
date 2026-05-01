import {
  ArrowDownwardRounded,
  ArrowUpwardRounded,
  CheckRounded,
} from '@mui/icons-material'
import {
  Box,
  GlobalStyles,
  Paper,
  ThemeProvider,
  Typography,
  Divider,
  MenuList,
  MenuItem,
  ListItemText,
} from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { listen, emit } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useEffect, useRef, useState, useCallback } from 'react'

import { useConnectionData } from '@/hooks/use-connection-data'
import { useTrafficData } from '@/hooks/use-traffic-data'
import { useCustomTheme } from '@/pages/_layout/hooks'
import { hideInitialOverlay } from '@/pages/_layout/utils/initial-loading-overlay'
import {
  patchVergeConfig,
  getVergeConfig,
  closeMiniWindow,
} from '@/services/cmds'
import parseTraffic from '@/utils/parse-traffic'

const MiniPage = () => {
  const paperRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const hoverPanelRef = useRef<HTMLDivElement>(null)

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number
    mouseY: number
  } | null>(null)

  const [isHovered, setIsHovered] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reuse the exact same custom theme hook from the main app
  const { theme: muiTheme } = useCustomTheme()
  const queryClient = useQueryClient()

  const { data: vergeConfig } = useQuery({
    queryKey: ['getVergeConfig'],
    queryFn: getVergeConfig,
  })

  useEffect(() => {
    hideInitialOverlay()

    const window = getCurrentWebviewWindow()

    // Save position when window is moved
    let saveTimeout: ReturnType<typeof setTimeout>
    const unlistenMove = window.onMoved(({ payload }) => {
      // Debounce saving to avoid too many writes
      clearTimeout(saveTimeout)
      saveTimeout = setTimeout(() => {
        // Save to backend config instead of localStorage
        patchVergeConfig({
          mini_window_pos_x: payload.x,
          mini_window_pos_y: payload.y,
        }).catch(console.error)
      }, 500)
    })

    const unlistenFocus = window.onFocusChanged(({ payload }) => {
      if (!payload) {
        setContextMenu(null) // close menu on blur
      }
    })

    return () => {
      unlistenMove.then((fn) => fn())
      unlistenFocus.then((fn) => fn())
      clearTimeout(saveTimeout)
    }
  }, [])

  const updateWindowSize = useCallback(() => {
    if (!paperRef.current) return
    const trafficRect = paperRef.current.getBoundingClientRect()
    let width = trafficRect.width
    let height = trafficRect.height

    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect()
      width = Math.max(width, menuRect.right + 24)
      height = Math.max(height, menuRect.bottom + 24)
    }

    if (hoverPanelRef.current) {
      const hoverRect = hoverPanelRef.current.getBoundingClientRect()
      width = Math.max(width, hoverRect.right + 32)
      height = Math.max(height, hoverRect.bottom + 32)
    }

    width = Math.ceil(width)
    height = Math.ceil(height)

    if (width > 0 && height > 0) {
      const window = getCurrentWebviewWindow()
      window.setSize(new LogicalSize(width, height)).catch(console.error)
    }
  }, [])

  // Dynamically resize the window to fit the content
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      updateWindowSize()
    })

    if (paperRef.current) resizeObserver.observe(paperRef.current)
    if (hoverPanelRef.current) resizeObserver.observe(hoverPanelRef.current)
    if (menuRef.current) resizeObserver.observe(menuRef.current)

    return () => resizeObserver.disconnect()
  }, [updateWindowSize, isHovered, contextMenu])

  // Update size when menu opens/closes
  useEffect(() => {
    // delay to next frame to ensure DOM is updated
    const timer = setTimeout(updateWindowSize, 0)
    return () => clearTimeout(timer)
  }, [contextMenu, isHovered, updateWindowSize])

  // Sync theme changes with backend instantly
  useEffect(() => {
    let unlisten: () => void
    listen('verge://refresh-verge-config', () => {
      queryClient.invalidateQueries({ queryKey: ['getVergeConfig'] })
    }).then((fn) => {
      unlisten = fn
    })

    return () => {
      if (unlisten) unlisten()
    }
  }, [queryClient])

  // Prevent default context menu everywhere in the mini window
  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }
    window.addEventListener('contextmenu', handleGlobalContextMenu)
    return () =>
      window.removeEventListener('contextmenu', handleGlobalContextMenu)
  }, [])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({
      mouseX: e.clientX,
      mouseY: e.clientY,
    })
  }

  const closeMenu = () => {
    setContextMenu(null)
  }

  const toggleAlwaysOnTop = async () => {
    if (!vergeConfig) return
    const newVal = !(vergeConfig.mini_window_always_on_top ?? true)
    await patchVergeConfig({ mini_window_always_on_top: newVal })
    queryClient.invalidateQueries({ queryKey: ['getVergeConfig'] })
    await emit('verge://refresh-verge-config')
    const window = getCurrentWebviewWindow()
    window.setAlwaysOnTop(newVal).catch(console.error)
    closeMenu()
  }

  const toggleAutoHide = async () => {
    if (!vergeConfig) return
    const newVal = !(vergeConfig.mini_window_auto_hide ?? false)
    await patchVergeConfig({ mini_window_auto_hide: newVal })
    queryClient.invalidateQueries({ queryKey: ['getVergeConfig'] })
    await emit('verge://refresh-verge-config')
    closeMenu()
  }

  const handleCloseMini = async () => {
    await patchVergeConfig({ enable_mini_window: false })
    await emit('verge://refresh-verge-config')
    await closeMiniWindow()
  }

  // Always enable traffic data for mini window
  const {
    response: { data: traffic },
  } = useTrafficData({ enabled: true })

  const {
    response: { data: connectionData },
  } = useConnectionData()

  const [up, upUnit] = parseTraffic(traffic?.up || 0)
  const [down, downUnit] = parseTraffic(traffic?.down || 0)

  const isAlwaysOnTop = vergeConfig?.mini_window_always_on_top ?? true
  const isAutoHide = vergeConfig?.mini_window_auto_hide ?? false

  const activeConns = connectionData?.activeConnections || []
  const topUploads = [...activeConns]
    .filter((c) => c.curUpload && c.curUpload > 0)
    .sort((a, b) => (b.curUpload || 0) - (a.curUpload || 0))
    .slice(0, 3)
  const topDownloads = [...activeConns]
    .filter((c) => c.curDownload && c.curDownload > 0)
    .sort((a, b) => (b.curDownload || 0) - (a.curDownload || 0))
    .slice(0, 3)

  const paddedUploads = Array.from({ length: 3 }).map((_, i) => ({
    id: `up-slot-${i}`,
    data: topUploads[i] || null,
  }))
  const paddedDownloads = Array.from({ length: 3 }).map((_, i) => ({
    id: `down-slot-${i}`,
    data: topDownloads[i] || null,
  }))

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true)
    }, 300) // 300ms delay to avoid flashing
  }

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false)
    }, 150) // small delay before hiding
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <GlobalStyles
        styles={{
          html: {
            backgroundColor: 'transparent !important',
            margin: 0,
            padding: 0,
            height: '100%',
          },
          body: {
            backgroundColor: 'transparent !important',
            margin: 0,
            padding: 0,
            height: '100%',
            overflow: 'hidden',
          },
          '#root': {
            backgroundColor: 'transparent !important',
            margin: 0,
            padding: 0,
            height: '100%',
            display: 'flex',
            alignItems: 'flex-start', // Align to top-left so window scales outward
            justifyContent: 'flex-start',
            position: 'relative',
          },
          '*:focus': { outline: 'none !important' },
          '*': { userSelect: 'none' },
          '@keyframes menuFade': {
            from: { opacity: 0, transform: 'scale(0.9)' },
            to: { opacity: 1, transform: 'scale(1)' },
          },
        }}
      />
      <Paper
        ref={paperRef}
        elevation={0}
        square
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
          width: 'max-content',
          minWidth: 76, // Provide a stable base width to reduce jitter
          height: 56,
          bgcolor: 'background.paper',
          borderRadius: 0,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 1, // Add balanced horizontal padding
          position: 'relative',
          cursor: 'move',
        }}
        data-tauri-drag-region
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 0.5,
            alignItems: 'flex-start',
            pointerEvents: 'none',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ArrowUpwardRounded
              sx={{ fontSize: 14, color: 'secondary.main' }}
            />
            <Typography
              variant="caption"
              sx={{ fontWeight: 'bold', minWidth: 40, userSelect: 'none', lineHeight: 1 }}
            >
              {up}{' '}
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.7rem' }}
              >
                {upUnit}/s
              </Typography>
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <ArrowDownwardRounded
              sx={{ fontSize: 14, color: 'primary.main' }}
            />
            <Typography
              variant="caption"
              sx={{ fontWeight: 'bold', minWidth: 40, userSelect: 'none', lineHeight: 1 }}
            >
              {down}{' '}
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{ fontSize: '0.7rem' }}
              >
                {downUnit}/s
              </Typography>
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Hover Panel */}
      {isHovered && !contextMenu && (
        <Paper
          ref={hoverPanelRef}
          elevation={8}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          sx={{
            position: 'absolute',
            top: 60, // just below the main window
            left: 0,
            zIndex: 1200,
            width: 280, // 稍微减小宽度
            overflow: 'hidden', // 隐藏滚动条，防止由于滚动条占位导致右侧圆角变直角
            borderRadius: 2, // 加大圆角幅度（默认 theme.shape.borderRadius * 2）
            bgcolor: 'background.paper',
            p: 2,
            animation: 'menuFade 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            transformOrigin: 'top left',
          }}
        >
          {/* 实时上传 */}
          <Box sx={{ mb: 1.5 }}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: 'block',
                mb: 1,
                bgcolor: 'action.hover',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
              }}
            >
              实时上传
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 1 }}>
              {paddedUploads.map((slot) => {
                const conn = slot.data
                if (!conn) {
                  return (
                    <Box
                      key={slot.id}
                      sx={{
                        height: 38,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="caption" color="text.disabled">
                        -
                      </Typography>
                    </Box>
                  )
                }
                const [u, uU] = parseTraffic(conn.curUpload || 0)
                const host =
                  conn.metadata.host || conn.metadata.destinationIP || 'Unknown'
                const process = conn.metadata.process
                const chain = conn.chains?.[0]
                return (
                  <Box
                    key={conn.id}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      height: 38,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ flex: 1, width: 0, mr: 1 }}
                        title={host}
                      >
                        {host}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="secondary.main"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <ArrowUpwardRounded sx={{ fontSize: 14, mr: 0.5 }} />
                        {u} {uU}/s
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        alignItems: 'center',
                        height: 18,
                        mt: 0.25,
                        overflow: 'hidden',
                      }}
                    >
                      {process && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.65rem',
                            bgcolor: 'action.hover',
                            px: 0.8,
                            py: 0.2,
                            borderRadius: 1,
                            color: 'text.secondary',
                            maxWidth: 120,
                          }}
                          noWrap
                          title={process}
                        >
                          {process}
                        </Typography>
                      )}
                      {chain && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.65rem',
                            bgcolor: 'action.hover',
                            px: 0.8,
                            py: 0.2,
                            borderRadius: 1,
                            color: 'text.secondary',
                            maxWidth: 120,
                          }}
                          noWrap
                          title={conn.chains?.join(' ➔ ')}
                        >
                          {chain}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>

          {/* 实时下载 */}
          <Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: 'block',
                mb: 1,
                bgcolor: 'action.hover',
                px: 1.5,
                py: 0.5,
                borderRadius: 1,
              }}
            >
              实时下载
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 1 }}>
              {paddedDownloads.map((slot) => {
                const conn = slot.data
                if (!conn) {
                  return (
                    <Box
                      key={slot.id}
                      sx={{
                        height: 38,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="caption" color="text.disabled">
                        -
                      </Typography>
                    </Box>
                  )
                }
                const [d, dU] = parseTraffic(conn.curDownload || 0)
                const host =
                  conn.metadata.host || conn.metadata.destinationIP || 'Unknown'
                const process = conn.metadata.process
                const chain = conn.chains?.[0]
                return (
                  <Box
                    key={conn.id}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      height: 38,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="body2"
                        noWrap
                        sx={{ flex: 1, width: 0, mr: 1 }}
                        title={host}
                      >
                        {host}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="primary.main"
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <ArrowDownwardRounded sx={{ fontSize: 14, mr: 0.5 }} />
                        {d} {dU}/s
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        alignItems: 'center',
                        height: 18,
                        mt: 0.25,
                        overflow: 'hidden',
                      }}
                    >
                      {process && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.65rem',
                            bgcolor: 'action.hover',
                            px: 0.8,
                            py: 0.2,
                            borderRadius: 1,
                            color: 'text.secondary',
                            maxWidth: 120,
                          }}
                          noWrap
                          title={process}
                        >
                          {process}
                        </Typography>
                      )}
                      {chain && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontSize: '0.65rem',
                            bgcolor: 'action.hover',
                            px: 0.8,
                            py: 0.2,
                            borderRadius: 1,
                            color: 'text.secondary',
                            maxWidth: 120,
                          }}
                          noWrap
                          title={conn.chains?.join(' ➔ ')}
                        >
                          {chain}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Paper>
      )}

      {contextMenu && (
        <Paper
          ref={menuRef}
          elevation={8}
          sx={{
            position: 'absolute',
            top: contextMenu.mouseY,
            left: contextMenu.mouseX,
            zIndex: 1300,
            minWidth: 140,
            borderRadius: 2,
            bgcolor: 'background.paper',
            animation: 'menuFade 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            transformOrigin: 'top left',
          }}
        >
          <MenuList dense sx={{ py: 0.5 }}>
            <MenuItem onClick={toggleAlwaysOnTop} sx={{ minWidth: 140 }}>
              <ListItemText primary="窗口置顶显示" />
              {isAlwaysOnTop && (
                <CheckRounded fontSize="small" sx={{ ml: 2 }} />
              )}
            </MenuItem>
            <MenuItem onClick={toggleAutoHide} sx={{ minWidth: 140 }}>
              <ListItemText primary="全屏自动隐藏" />
              {isAutoHide && <CheckRounded fontSize="small" sx={{ ml: 2 }} />}
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem
              onClick={handleCloseMini}
              sx={{ minWidth: 140, color: 'error.main' }}
            >
              <ListItemText primary="关闭悬浮窗" />
            </MenuItem>
          </MenuList>
        </Paper>
      )}
    </ThemeProvider>
  )
}

export default MiniPage
