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
  ToggleButtonGroup, ToggleButton, Badge,
} from '@mui/material'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoutIcon from '@mui/icons-material/Logout'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import SearchIcon from '@mui/icons-material/Search'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import MenuIcon from '@mui/icons-material/Menu'
import ClearIcon from '@mui/icons-material/Clear'
import { supabase } from '../lib/supabase'
import { EMPLOYEES, PRIORITIES, stringToColor } from '../lib/constants'
import EmployeeColumn from './EmployeeColumn'
import TaskCard from './TaskCard'
import TaskDialog from './TaskDialog'

const DRAWER_WIDTH = 220

export default function Board({ onLogout, mode, onToggleMode }) {
  const [tasks,          setTasks]          = useState([])
  const [commentCounts,  setCommentCounts]  = useState({})
  const [loading,        setLoading]        = useState(true)
  const [activeTask,     setActiveTask]     = useState(null)
  const [dialogOpen,     setDialogOpen]     = useState(false)
  const [editingTask,    setEditingTask]    = useState(null)
  const [defaultEmpId,   setDefaultEmpId]   = useState(null)
  const [snack,          setSnack]          = useState({ open: false, msg: '', sev: 'success' })
  const [drawerOpen,     setDrawerOpen]     = useState(true)
  const [filterProject,  setFilterProject]  = useState(null)   // string | null
  const [filterPriority, setFilterPriority] = useState([])     // array of priority values
  const [searchQuery,    setSearchQuery]    = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

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

  // ── Derived data ──────────────────────────────────────────────
  const allProjects = useMemo(() => {
    const names = [...new Set(tasks.map(t => t.project_name).filter(Boolean))].sort()
    return names
  }, [tasks])

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterProject && t.project_name !== filterProject) return false
      if (filterPriority.length > 0 && !filterPriority.includes(t.priority)) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const inTitle   = t.title?.toLowerCase().includes(q)
        const inDesc    = t.description?.toLowerCase().includes(q)
        const inProject = t.project_name?.toLowerCase().includes(q)
        if (!inTitle && !inDesc && !inProject) return false
      }
      return true
    })
  }, [tasks, filterProject, filterPriority, searchQuery])

  const tasksForEmployee = useCallback(
    (empId) => filteredTasks.filter(t => t.employee_id === empId),
    [filteredTasks]
  )

  const activeFilterCount = (filterProject ? 1 : 0) + filterPriority.length + (searchQuery.trim() ? 1 : 0)

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

  // ── Render ────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      {/* ── AppBar ── */}
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

          {/* Priority filter toggle */}
          <ToggleButtonGroup
            size="small"
            value={filterPriority}
            onChange={(_, val) => setFilterPriority(val)}
            sx={{ mr: 1 }}
          >
            {PRIORITIES.map(p => (
              <ToggleButton
                key={p.value}
                value={p.value}
                sx={{
                  fontSize: '0.65rem',
                  py: 0.3,
                  px: 1,
                  fontWeight: 600,
                  color: p.color,
                  borderColor: p.color + '44',
                  '&.Mui-selected': {
                    bgcolor: p.color + '22',
                    color: p.color,
                    borderColor: p.color,
                  },
                }}
              >
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {/* Search */}
          <TextField
            size="small"
            placeholder="Cerca task…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            sx={{ width: 200 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                </InputAdornment>
              ),
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

          {/* Active filter indicator */}
          {activeFilterCount > 0 && (
            <Chip
              label={`${activeFilterCount} filtri attivi`}
              size="small"
              onDelete={() => { setFilterProject(null); setFilterPriority([]); setSearchQuery('') }}
              sx={{ fontSize: '0.68rem', height: 22 }}
            />
          )}

          <Box sx={{ flex: 1 }} />

          <Tooltip title={mode === 'dark' ? 'Tema chiaro' : 'Tema scuro'}>
            <IconButton onClick={onToggleMode} size="small">
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Esci">
            <IconButton onClick={onLogout} size="small">
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* ── Body: sidebar + board ── */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <Drawer
          variant="persistent"
          open={drawerOpen}
          sx={{
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
          }}
        >
          <Box sx={{ p: 1.5, overflowY: 'auto', flex: 1 }}>
            <Typography variant="caption" color="text.secondary"
              sx={{ fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', px: 0.5, mb: 1, display: 'block' }}>
              Progetti
            </Typography>

            {/* All projects option */}
            <Box
              onClick={() => setFilterProject(null)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                px: 1, py: 0.7, borderRadius: 1.5, cursor: 'pointer', mb: 0.5,
                bgcolor: filterProject === null ? 'primary.main' + '18' : 'transparent',
                color: filterProject === null ? 'primary.main' : 'text.secondary',
                '&:hover': { bgcolor: 'action.hover' },
                transition: 'all 0.12s',
              }}
            >
              <FolderOutlinedIcon sx={{ fontSize: 15 }} />
              <Typography variant="caption" sx={{ fontWeight: filterProject === null ? 700 : 400, fontSize: '0.78rem' }}>
                Tutti i progetti
              </Typography>
              <Box sx={{ flex: 1 }} />
              <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                {tasks.length}
              </Typography>
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
                <Box
                  key={proj}
                  onClick={() => setFilterProject(isActive ? null : proj)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    px: 1, py: 0.7, borderRadius: 1.5, cursor: 'pointer', mb: 0.3,
                    bgcolor: isActive ? color + '18' : 'transparent',
                    '&:hover': { bgcolor: isActive ? color + '28' : 'action.hover' },
                    transition: 'all 0.12s',
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }} />
                  <Typography variant="caption" noWrap
                    sx={{ fontSize: '0.78rem', fontWeight: isActive ? 700 : 400, color: isActive ? color : 'text.primary', flex: 1 }}>
                    {proj}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                    {count}
                  </Typography>
                </Box>
              )
            })}
          </Box>
        </Drawer>

        {/* Board */}
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <CircularProgress />
          </Box>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                p: 2,
                overflowX: 'auto',
                overflowY: 'hidden',
                flex: 1,
                alignItems: 'flex-start',
                '&::-webkit-scrollbar': { height: 6 },
                '&::-webkit-scrollbar-thumb': { borderRadius: 3, bgcolor: 'divider' },
              }}
            >
              {EMPLOYEES.map(emp => (
                <EmployeeColumn
                  key={emp.id}
                  employee={emp}
                  tasks={tasksForEmployee(emp.id)}
                  commentCounts={commentCounts}
                  onAddTask={openNewTask}
                  onOpenTask={openEditTask}
                />
              ))}
            </Box>

            <DragOverlay>
              {activeTask && (
                <TaskCard
                  task={activeTask}
                  commentCount={commentCounts[activeTask.id] || 0}
                  onClick={() => {}}
                />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </Box>

      {/* Task dialog */}
      <TaskDialog
        open={dialogOpen}
        task={editingTask}
        defaultEmployeeId={defaultEmpId}
        onClose={() => setDialogOpen(false)}
        onSaved={handleTaskSaved}
        onDeleted={handleTaskDeleted}
      />

      {/* Snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={3000}
        onClose={() => setSnack(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.sev} variant="filled" onClose={() => setSnack(s => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
