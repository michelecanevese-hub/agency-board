import { useState, useEffect } from 'react'
import {
  Box, AppBar, Toolbar, Typography, IconButton, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Chip, Avatar, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import RestoreIcon from '@mui/icons-material/Restore'
import { format, differenceInDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { EMPLOYEES, stringToColor, getInitials } from '../lib/constants'

export default function ArchivePage({ onBack, mode, onToggleMode }) {
  const [tasks,    setTasks]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [confirm,  setConfirm]  = useState(null)  // task to delete

  useEffect(() => { loadArchive() }, [])

  async function loadArchive() {
    setLoading(true)
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('status', 'done')
      .order('completed_at', { ascending: false })
    setTasks(data || [])
    setLoading(false)
  }

  async function handleRestore(task) {
    await supabase.from('tasks').update({ status: 'active', completed_at: null }).eq('id', task.id)
    setTasks(prev => prev.filter(t => t.id !== task.id))
  }

  async function handleDelete(task) {
    await supabase.from('comments').delete().eq('task_id', task.id)
    await supabase.from('tasks').delete().eq('id', task.id)
    setTasks(prev => prev.filter(t => t.id !== task.id))
    setConfirm(null)
  }

  async function handleDeleteAll() {
    if (!confirm === 'all') return
    for (const t of tasks) {
      await supabase.from('comments').delete().eq('task_id', t.id)
      await supabase.from('tasks').delete().eq('id', t.id)
    }
    setTasks([])
    setConfirm(null)
  }

  function daysInArchive(completedAt) {
    if (!completedAt) return 0
    return differenceInDays(new Date(), new Date(completedAt))
  }

  function expiryColor(days) {
    if (days > 80) return '#f44336'
    if (days > 60) return '#ff9800'
    return 'text.secondary'
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <AppBar position="static" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar variant="dense" sx={{ gap: 1 }}>
          <Tooltip title="Torna alla bacheca">
            <IconButton size="small" onClick={onBack}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
            Housedada — Archivio
          </Typography>
          <Box sx={{ flex: 1 }} />
          {tasks.length > 0 && (
            <Button size="small" color="error" startIcon={<DeleteOutlineIcon />}
              onClick={() => setConfirm('all')} sx={{ fontSize: '0.75rem' }}>
              Svuota archivio
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 2 } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>
        ) : tasks.length === 0 ? (
          <Box sx={{ textAlign: 'center', pt: 10 }}>
            <Typography variant="h6" color="text.disabled" fontWeight={400}>Archivio vuoto</Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
              I task contrassegnati come svolti appariranno qui.
            </Typography>
          </Box>
        ) : (
          <>
            <Alert severity="info" sx={{ mb: 2, fontSize: '0.8rem' }}>
              I task vengono eliminati automaticamente dopo 90 giorni dall'archiviazione.
            </Alert>
            <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: 'divider' }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ '& th': { fontWeight: 700, fontSize: '0.75rem' } }}>
                    <TableCell>Task</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Progetto</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Assegnato a</TableCell>
                    <TableCell>Completato</TableCell>
                    <TableCell>Giorni</TableCell>
                    <TableCell align="right">Azioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tasks.map(task => {
                    const emp = EMPLOYEES.find(e => e.id === task.employee_id)
                    const empColor = emp ? stringToColor(emp.name) : '#78909C'
                    const days = daysInArchive(task.completed_at)
                    return (
                      <TableRow key={task.id} sx={{ '&:last-child td': { border: 0 } }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500} sx={{ fontSize: '0.82rem' }}>
                            {task.title}
                          </Typography>
                          {task.description && (
                            <Typography variant="caption" color="text.secondary" sx={{
                              display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
                              overflow: 'hidden', fontSize: '0.7rem',
                            }}>
                              {task.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          {task.project_name ? (
                            <Chip label={task.project_name} size="small" sx={{
                              bgcolor: stringToColor(task.project_name) + '22',
                              color: stringToColor(task.project_name),
                              height: 18, fontSize: '0.65rem',
                            }} />
                          ) : '—'}
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                          {emp ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Avatar sx={{ width: 22, height: 22, bgcolor: empColor, fontSize: '0.6rem' }}>
                                {getInitials(emp.name)}
                              </Avatar>
                              <Typography variant="caption">{emp.name.split(' ')[0]}</Typography>
                            </Box>
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {task.completed_at
                              ? format(new Date(task.completed_at), 'd MMM yyyy', { locale: it })
                              : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" sx={{ color: expiryColor(days), fontWeight: days > 60 ? 700 : 400 }}>
                            {days}g
                            {days > 80 && ' ⚠'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Ripristina task">
                            <IconButton size="small" onClick={() => handleRestore(task)} sx={{ p: 0.5 }}>
                              <RestoreIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Elimina definitivamente">
                            <IconButton size="small" color="error" onClick={() => setConfirm(task)} sx={{ p: 0.5 }}>
                              <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Box>

      {/* Confirm delete dialog */}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {confirm === 'all' ? 'Svuota archivio' : 'Elimina task'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {confirm === 'all'
              ? `Eliminare definitivamente tutti i ${tasks.length} task archiviati? L'azione è irreversibile.`
              : `Eliminare definitivamente "${confirm?.title}"? L'azione è irreversibile.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Annulla</Button>
          <Button color="error" variant="contained"
            onClick={() => confirm === 'all' ? handleDeleteAll() : handleDelete(confirm)}>
            Elimina
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
