import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import {
  Box, AppBar, Toolbar, Typography, IconButton,
  Tooltip, Snackbar, Alert, CircularProgress,
  Drawer, Divider, Chip, InputAdornment, TextField,
  ToggleButtonGroup, ToggleButton, Avatar, Select,
  MenuItem, FormControl, useMediaQuery, useTheme,
  BottomNavigation, BottomNavigationAction, Paper,
} from '@mui/material'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoutIcon from '@mui/icons-material/Logout'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import SearchIcon from '@mui/icons-material/Search'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import MenuIcon from '@mui/icons-material/Menu'
import ClearIcon from '@mui/icons-material/Clear'
import AddIcon from '@mui/icons-material/Add'
import ArchiveIcon from '@mui/icons-material/Archive'
import FilterListIcon from '@mui/icons-material/FilterList'
import { supabase } from '../lib/supabase'
import { EMPLOYEES, WORK_STATUSES, stringToColor, getInitials } from '../lib/constants'
import EmployeeColumn from './EmployeeColumn'
import TaskCard from './TaskCard'
import TaskDialog from './TaskDialog'
import ArchivePage from './ArchivePage'

const DRAWER_WIDTH = 220

export default function Board({ onLogout, mode, onToggleMode }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))       // < 600px
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'lg')) // 600–1200px

  const [tasks,          setTasks]          = useState([])
  const [commentCounts,  setCommentCounts]  = useState({})
  const [loading,        setLoading]        = useState(true)
  const [activeTask,     setActiveTask]     = useState(null)
  const [dialogOpen,     setDialogOpen]     = useState(false)
  const [editingTask,    setEditingTask]    = useState(null)
  const [defaultEmpId,   setDefaultEmpId]   = useState(null)
  const [snack,          setSnack]          = useState({ open: false, msg: '', sev: 'success' })
  const [drawerOpen,     setDrawerOpen]     = useState(!isMobile && !isTablet)
  const [filterProject,  setFilterProject]  = useState(null)
  const [filterWorkStatus, setfilterWorkStatus] = useState([])
  const [searchQuery,    setSearchQuery]    = useState('')
  const [mobileEmpIdx,   setMobileEmpIdx]   = useState(0)  // which employee to show on mobile
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showArchive, setShowArchive] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Close drawer automatically on mobile/tablet
  useEffect(() => {
    if (isMobile || isTablet) setDrawerOpen(false)
    else setDrawerOpen(true)
  }, [isMobile, isTablet])

  // ── Load ──────────────────────────────────────────────────────
  useEffect(() => {
    loadTasks()
    loadCommentCounts()
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => loadCommentCounts())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadTasks() {
    const { data, error } = await supabase
      .from('tasks').select('*').order('position', { ascending: true })
    if (!error) setTasks(data || [])
    setLoading(false)
  }

  async function loadCommentCounts() {
    const { data } = await supabase.from('comments').select('task_id')
    if (data) {
      const counts = {}
      data.forEach(({ task_id }) => { counts[task_id] = (counts[task_id] || 0) + 1 })
      setCommentCounts(counts)
    }
  }

  // ── Derived ───────────────────────────────────────────────────
  const allProjects = useMemo(() => {
    return [...new Set(tasks.map(t => t.project_name).filter(Boolean))].sort()
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterProject && t.project_name !== filterProject) return false
      if (filterWorkStatus.length > 0 && !filterWorkStatus.includes(t.work_status)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        if (!t.title?.toLowerCase().includes(q) &&
            !t.description?.toLowerCase().includes(q) &&
            !t.project_name?.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [tasks, filterProject, filterWorkStatus, searchQuery])

  const tasksForEmployee = useCallback(
    (empId) => filteredTasks.filter(t => t.employee_id === empId),
    [filteredTasks]
  )

  const activeFilterCount = (filterProject ? 1 : 0) + filterWorkStatus.length + (searchQuery.trim() ? 1 : 0)

  // ── Drag & Drop ───────────────────────────────────────────────
  function findEmployeeOfTask(taskId) {
    return tasks.find(t => t.id === taskId)?.employee_id
  }

  function handleDragStart({ active }) {
    setActiveTask(tasks.find(t => t.id === active.id) || null)
  }

  async function handleDragEnd({ active, over }) {
    setActiveTask(null)
    if (!over || active.id === over.id) return
    const fromEmp = findEmployeeOfTask(active.id)
    const toEmp   = EMPLOYEES.find(e => e.id === over.id)?.id || findEmployeeOfTask(over.id)
    if (!toEmp) return

    setTasks(prev => {
      let next = [...prev]
      const activeIdx = next.findIndex(t => t.id === active.id)
      if (fromEmp !== toEmp) {
        next[activeIdx] = { ...next[activeIdx], employee_id: toEmp }
      } else {
        const overIdx = next.findIndex(t => t.id === over.id)
        if (overIdx >= 0) next = arrayMove(next, activeIdx, overIdx)
      }
      const empTasks = next.filter(t => t.employee_id === toEmp)
      empTasks.forEach((t, i) => {
        const idx = next.findIndex(x => x.id === t.id)
        next[idx].position = i * 1000
      })
      return next
    })

    if (fromEmp !== toEmp) {
      await supabase.from('tasks').update({ employee_id: toEmp }).eq('id', active.id)
    }
    const updated = tasks.filter(t => t.employee_id === toEmp)
    for (let i = 0; i < updated.length; i++) {
      await supabase.from('tasks').update({ position: i * 1000 }).eq('id', updated[i].id)
    }
  }


  // ── Mark done ────────────────────────────────────────────────
  async function handleMarkDone(task) {
    const now = new Date().toISOString()
    await supabase.from('tasks').update({ status: 'done', completed_at: now }).eq('id', task.id)
    setTasks(prev => prev.filter(t => t.id !== task.id))
    setSnack({ open: true, msg: '✓ Task archiviato!', sev: 'success' })
  }

  // ── Dialog ────────────────────────────────────────────────────
  function openNewTask(empId)  { setEditingTask(null); setDefaultEmpId(empId); setDialogOpen(true) }
  function openEditTask(task)  { setEditingTask(task); setDefaultEmpId(task.employee_id); setDialogOpen(true) }

  function handleTaskSaved(saved) {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.id === saved.id)
      if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next }
      return [...prev, saved]
    })
    setDialogOpen(false)
    setSnack({ open: true, msg: editingTask ? 'Task aggiornato!' : 'Task creato!', sev: 'success' })
  }

  function handleTaskDeleted(id) {
    setTasks(prev => prev.filter(t => t.id !== id))
    setDialogOpen(false)
    setSnack({ open: true, msg: 'Task eliminato.', sev: 'info' })
  }

  const currentEmployee = EMPLOYEES[mobileEmpIdx]

  // ── Mobile view ───────────────────────────────────────────────
  if (showArchive) {
    return <ArchivePage onBack={() => setShowArchive(false)} mode={mode} onToggleMode={onToggleMode} />
  }

  if (isMobile) {
    const empTasks = tasksForEmployee(currentEmployee.id)
    const empColor = stringToColor(currentEmployee.name)
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

        {/* Mobile AppBar */}
        <AppBar position="static" color="default" elevation={0}
          sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Toolbar variant="dense" sx={{ gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: '1rem' }}>
              Housedada
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Cerca">
              <IconButton size="small" onClick={() => setShowMobileFilters(v => !v)}>
                <SearchIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Archivio">
              <IconButton size="small" onClick={() => setShowArchive(true)}>
                <ArchiveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <IconButton size="small" onClick={onToggleMode}>
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
            <IconButton size="small" onClick={onLogout}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Toolbar>

          {/* Mobile search bar — collapsible */}
          {showMobileFilters && (
            <Box sx={{ px: 1.5, pb: 1 }}>
              <TextField
                size="small" fullWidth
                placeholder="Cerca task…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoFocus
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment>,
                  endAdornment: searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.3 }}>
                        <ClearIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                  sx: { fontSize: '0.85rem' },
                }}
              />
            </Box>
          )}
        </AppBar>

        {/* Employee selector — horizontal scrollable chips */}
        <Box
          sx={{
            display: 'flex',
            gap: 0.75,
            px: 1.5,
            py: 1,
            overflowX: 'auto',
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          {EMPLOYEES.map((emp, idx) => {
            const color = stringToColor(emp.name)
            const count = tasksForEmployee(emp.id).length
            const isActive = idx === mobileEmpIdx
            return (
              <Box
                key={emp.id}
                onClick={() => setMobileEmpIdx(idx)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75,
                  flexShrink: 0, cursor: 'pointer',
                  px: 1.25, py: 0.6,
                  borderRadius: 4,
                  border: '1.5px solid',
                  borderColor: isActive ? color : 'transparent',
                  bgcolor: isActive ? color + '18' : 'action.hover',
                  transition: 'all 0.15s',
                }}
              >
                <Avatar sx={{ width: 22, height: 22, bgcolor: color, fontSize: '0.6rem', fontWeight: 700 }}>
                  {getInitials(emp.name)}
                </Avatar>
                <Typography variant="caption" sx={{ fontWeight: isActive ? 700 : 400, fontSize: '0.72rem', color: isActive ? color : 'text.primary', whiteSpace: 'nowrap' }}>
                  {emp.name.split(' ')[0]}
                </Typography>
                {count > 0 && (
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: isActive ? color : 'text.disabled', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: '0.6rem', color: '#fff', fontWeight: 700, lineHeight: 1 }}>{count}</Typography>
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>

        {/* Column header for current employee */}
        <Box sx={{
          px: 2, py: 1.25,
          bgcolor: 'background.paper',
          borderBottom: `2px solid ${empColor}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 30, height: 30, bgcolor: empColor, fontSize: '0.72rem', fontWeight: 700 }}>
              {getInitials(currentEmployee.name)}
            </Avatar>
            <Box>
              <Typography variant="subtitle2" sx={{ fontSize: '0.85rem', lineHeight: 1.2 }}>
                {currentEmployee.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">{currentEmployee.role}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label={`${empTasks.length} task`} size="small"
              sx={{ height: 20, fontSize: '0.65rem', bgcolor: empColor + '22', color: empColor }} />
            <IconButton size="small" onClick={() => openNewTask(currentEmployee.id)}
              sx={{ bgcolor: empColor + '22', color: empColor, '&:hover': { bgcolor: empColor + '33' } }}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Task list */}
        <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { borderRadius: 2, bgcolor: 'divider' },
        }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}><CircularProgress size={28} /></Box>
          ) : empTasks.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body2" color="text.disabled">Nessun task assegnato</Typography>
              <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
                Tocca + per aggiungerne uno
              </Typography>
            </Box>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCorners}
              onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <EmployeeColumn
                employee={currentEmployee}
                tasks={empTasks}
                commentCounts={commentCounts}
                onAddTask={openNewTask}
                onOpenTask={openEditTask}
                hideHeader
              />
              <DragOverlay>
                {activeTask && <TaskCard task={activeTask} commentCount={commentCounts[activeTask.id] || 0} onClick={() => {}} />}
              </DragOverlay>
            </DndContext>
          )}
        </Box>

        {/* Mobile FAB-style bottom bar */}
        <Paper elevation={4} sx={{ borderTop: 1, borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1, gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              {activeFilterCount > 0 ? `${activeFilterCount} filtri attivi` : 'Nessun filtro'}
            </Typography>
            {activeFilterCount > 0 && (
              <Chip label="Reset filtri" size="small"
                onDelete={() => { setFilterProject(null); setFilterWorkStatus([]); setSearchQuery('') }}
                sx={{ fontSize: '0.65rem', height: 20 }} />
            )}
          </Box>
        </Paper>

        <TaskDialog open={dialogOpen} task={editingTask} defaultEmployeeId={defaultEmpId}
          onClose={() => setDialogOpen(false)} onSaved={handleTaskSaved} onDeleted={handleTaskDeleted} />
        <Snackbar open={snack.open} autoHideDuration={3000}
          onClose={() => setSnack(s => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
          <Alert severity={snack.sev} variant="filled">{snack.msg}</Alert>
        </Snackbar>
      </Box>
    )
  }

  // ── Desktop / Tablet view ─────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* AppBar */}
      <AppBar position="static" color="default" elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', zIndex: 1201 }}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <Tooltip title={drawerOpen ? 'Chiudi sidebar' : 'Apri sidebar'}>
            <IconButton size="small" onClick={() => setDrawerOpen(v => !v)}>
              {drawerOpen ? <MenuOpenIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mr: 2 }}>
            Housedada
          </Typography>

          {/* Work status filter */}
          {!isTablet && (
            <ToggleButtonGroup size="small" value={filterWorkStatus}
              onChange={(_, val) => setFilterWorkStatus(val)} sx={{ mr: 1 }}>
              {WORK_STATUSES.map(s => (
                <ToggleButton key={s.value} value={s.value} sx={{
                  fontSize: '0.65rem', py: 0.3, px: 1, fontWeight: 600, color: s.color,
                  borderColor: s.color + '44',
                  '&.Mui-selected': { bgcolor: s.color + '22', color: s.color, borderColor: s.color },
                }}>
                  {s.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}

          {/* On tablet: compact work status select */}
          {isTablet && (
            <FormControl size="small" sx={{ minWidth: 120, mr: 1 }}>
              <Select multiple displayEmpty value={filterWorkStatus}
                onChange={e => setFilterWorkStatus(e.target.value)}
                renderValue={sel => sel.length === 0
                  ? <Typography variant="caption" color="text.secondary">Stato lavoro</Typography>
                  : <Typography variant="caption">{sel.length} sel.</Typography>
                } sx={{ fontSize: '0.78rem' }}>
                {WORK_STATUSES.map(s => (
                  <MenuItem key={s.value} value={s.value} sx={{ fontSize: '0.82rem' }}>
                    <Chip label={s.label} size="small"
                      sx={{ bgcolor: s.color + '22', color: s.color, fontWeight: 700, height: 18, fontSize: '0.65rem' }} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <TextField
            size="small"
            placeholder="Cerca task…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            sx={{ width: isTablet ? 160 : 200 }}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} /></InputAdornment>,
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.3 }}>
                    <ClearIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
              sx: { fontSize: '0.8rem' },
            }}
          />

          {activeFilterCount > 0 && (
            <Chip label={`${activeFilterCount} filtri`} size="small"
              onDelete={() => { setFilterProject(null); setFilterWorkStatus([]); setSearchQuery('') }}
              sx={{ fontSize: '0.68rem', height: 22 }} />
          )}

          <Box sx={{ flex: 1 }} />
          <Tooltip title="Archivio task svolti">
            <IconButton onClick={() => setShowArchive(true)} size="small">
              <ArchiveIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title={mode === 'dark' ? 'Tema chiaro' : 'Tema scuro'}>
            <IconButton onClick={onToggleMode} size="small">
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Esci">
            <IconButton onClick={onLogout} size="small"><LogoutIcon fontSize="small" /></IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Body */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <Drawer variant="persistent" open={drawerOpen} sx={{
          width: drawerOpen ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          transition: 'width 0.2s',
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            position: 'relative',
            borderRight: 1,
            borderColor: 'divider',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          },
        }}>
          <Box sx={{ p: 1.5, overflowY: 'auto', flex: 1 }}>
            <Typography variant="caption" color="text.secondary"
              sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5, mb: 1, display: 'block' }}>
              Progetti
            </Typography>
            <Box onClick={() => setFilterProject(null)} sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 1, py: 0.7, borderRadius: 1.5, cursor: 'pointer', mb: 0.5,
              bgcolor: filterProject === null ? 'primary.main' + '18' : 'transparent',
              color: filterProject === null ? 'primary.main' : 'text.secondary',
              '&:hover': { bgcolor: 'action.hover' }, transition: 'all 0.12s',
            }}>
              <FolderOutlinedIcon sx={{ fontSize: 15 }} />
              <Typography variant="caption" sx={{ fontWeight: filterProject === null ? 700 : 400, fontSize: '0.78rem' }}>
                Tutti i progetti
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>{tasks.length}</Typography>
            </Box>
            <Divider sx={{ my: 1 }} />
            {allProjects.length === 0 && (
              <Typography variant="caption" color="text.disabled" sx={{ px: 1, display: 'block' }}>
                Nessun progetto ancora
              </Typography>
            )}
            {allProjects.map(proj => {
              const color = stringToColor(proj)
              const count = tasks.filter(t => t.project_name === proj).length
              const isActive = filterProject === proj
              return (
                <Box key={proj} onClick={() => setFilterProject(isActive ? null : proj)} sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  px: 1, py: 0.7, borderRadius: 1.5, cursor: 'pointer', mb: 0.3,
                  bgcolor: isActive ? color + '18' : 'transparent',
                  '&:hover': { bgcolor: isActive ? color + '28' : 'action.hover' }, transition: 'all 0.12s',
                }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                  <Typography variant="caption" noWrap sx={{ fontSize: '0.78rem', fontWeight: isActive ? 700 : 400, color: isActive ? color : 'text.primary', flex: 1 }}>
                    {proj}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>{count}</Typography>
                </Box>
              )
            })}
          </Box>
        </Drawer>

        {/* Board columns */}
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <CircularProgress />
          </Box>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCorners}
            onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <Box sx={{
              display: 'flex', gap: 1.5, p: 2,
              overflowX: 'auto', overflowY: 'hidden', flex: 1,
              alignItems: 'flex-start',
              '&::-webkit-scrollbar': { height: 6 },
              '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'divider' },
            }}>
              {EMPLOYEES.map(emp => (
                <EmployeeColumn key={emp.id} employee={emp}
                  tasks={tasksForEmployee(emp.id)}
                  commentCounts={commentCounts}
                  onAddTask={openNewTask}
                  onOpenTask={openEditTask}
                  onMarkDone={handleMarkDone}
                />
              ))}
            </Box>
            <DragOverlay>
              {activeTask && <TaskCard task={activeTask} commentCount={commentCounts[activeTask.id] || 0} onClick={() => {}} />}
            </DragOverlay>
          </DndContext>
        )}
      </Box>

      <TaskDialog open={dialogOpen} task={editingTask} defaultEmployeeId={defaultEmpId}
        onClose={() => setDialogOpen(false)} onSaved={handleTaskSaved} onDeleted={handleTaskDeleted} />

      <Snackbar open={snack.open} autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.sev} variant="filled"
          onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
