import { useState, useEffect, useCallback } from 'react'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import {
  Box, AppBar, Toolbar, Typography, IconButton,
  Tooltip, Snackbar, Alert, CircularProgress,
} from '@mui/material'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoutIcon from '@mui/icons-material/Logout'
import { supabase } from '../lib/supabase'
import { EMPLOYEES } from '../lib/constants'
import EmployeeColumn from './EmployeeColumn'
import TaskCard from './TaskCard'
import TaskDialog from './TaskDialog'

export default function Board({ onLogout, mode, onToggleMode }) {
  const [tasks,         setTasks]         = useState([])
  const [commentCounts, setCommentCounts] = useState({})
  const [loading,       setLoading]       = useState(true)
  const [activeTask,    setActiveTask]    = useState(null)
  const [dialogOpen,    setDialogOpen]    = useState(false)
  const [editingTask,   setEditingTask]   = useState(null)
  const [defaultEmpId,  setDefaultEmpId]  = useState(null)
  const [snack,         setSnack]         = useState({ open: false, msg: '', sev: 'success' })

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => {
    loadTasks()
    loadCommentCounts()

    // Realtime subscription
    const channel = supabase
      .channel('tasks-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => loadTasks())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => loadCommentCounts())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function loadTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('position', { ascending: true })
    if (!error) setTasks(data || [])
    setLoading(false)
  }

  async function loadCommentCounts() {
    const { data } = await supabase
      .from('comments')
      .select('task_id')
    if (data) {
      const counts = {}
      data.forEach(({ task_id }) => { counts[task_id] = (counts[task_id] || 0) + 1 })
      setCommentCounts(counts)
    }
  }

  // ── Helpers ───────────────────────────────────────────────────
  const tasksForEmployee = useCallback(
    (empId) => tasks.filter(t => t.employee_id === empId),
    [tasks]
  )

  function findEmployeeOfTask(taskId) {
    return tasks.find(t => t.id === taskId)?.employee_id
  }

  // ── Drag & Drop ───────────────────────────────────────────────
  function handleDragStart({ active }) {
    setActiveTask(tasks.find(t => t.id === active.id) || null)
  }

  async function handleDragEnd({ active, over }) {
    setActiveTask(null)
    if (!over || active.id === over.id) return

    const fromEmp = findEmployeeOfTask(active.id)
    // over.id can be either a task id or an employee id (dropped on empty column)
    const toEmp = EMPLOYEES.find(e => e.id === over.id)?.id || findEmployeeOfTask(over.id)

    if (!toEmp) return

    setTasks(prev => {
      let next = [...prev]
      const activeIdx = next.findIndex(t => t.id === active.id)
      if (fromEmp !== toEmp) {
        // Moving to a different column
        next[activeIdx] = { ...next[activeIdx], employee_id: toEmp }
      } else {
        // Reordering within column
        const overIdx = next.findIndex(t => t.id === over.id)
        next = arrayMove(next, activeIdx, overIdx)
      }
      // Recompute positions
      const empTasks = next.filter(t => t.employee_id === toEmp)
      empTasks.forEach((t, i) => { const idx = next.findIndex(x => x.id === t.id); next[idx].position = i * 1000 })
      return next
    })

    // Persist
    const moved = tasks.find(t => t.id === active.id)
    if (moved && fromEmp !== toEmp) {
      await supabase.from('tasks').update({ employee_id: toEmp }).eq('id', active.id)
    }
    // Update positions for involved column
    const updated = tasks.filter(t => t.employee_id === toEmp)
    for (let i = 0; i < updated.length; i++) {
      await supabase.from('tasks').update({ position: i * 1000 }).eq('id', updated[i].id)
    }
  }

  // ── Dialog ────────────────────────────────────────────────────
  function openNewTask(empId) {
    setEditingTask(null)
    setDefaultEmpId(empId)
    setDialogOpen(true)
  }

  function openEditTask(task) {
    setEditingTask(task)
    setDefaultEmpId(task.employee_id)
    setDialogOpen(true)
  }

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
      {/* AppBar */}
      <AppBar position="static" color="default" elevation={0}
        sx={{ borderBottom: 1, borderColor: 'divider', backdropFilter: 'blur(8px)' }}>
        <Toolbar variant="dense">
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 800, letterSpacing: '-0.02em' }}>
            Agency Board
          </Typography>
          <Tooltip title={mode === 'dark' ? 'Tema chiaro' : 'Tema scuro'}>
            <IconButton onClick={onToggleMode} size="small">
              {mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
          <Tooltip title="Esci">
            <IconButton onClick={onLogout} size="small" sx={{ ml: 0.5 }}>
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

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
