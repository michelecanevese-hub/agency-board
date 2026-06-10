import { useState, useEffect, useRef } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, TextField, Button, MenuItem, Select, FormControl,
  InputLabel, Chip, Typography, Divider, Avatar, IconButton,
  Tabs, Tab, CircularProgress, Tooltip, Autocomplete,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteIcon from '@mui/icons-material/DeleteOutline'
import SendIcon from '@mui/icons-material/Send'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { supabase } from '../lib/supabase'
import { EMPLOYEES, WORK_STATUSES, stringToColor, getInitials } from '../lib/constants'

export default function TaskDialog({ task, open, onClose, onSaved, onDeleted, defaultEmployeeId }) {
  const isNew = !task?.id

  const [title,       setTitle]       = useState('')
  const [description, setDescription] = useState('')
  const [projectName, setProjectName] = useState('')
  const [workStatus,  setWorkStatus]  = useState('in_progress')
  const [dueDate,     setDueDate]     = useState('')
  const [employeeId,  setEmployeeId]  = useState(defaultEmployeeId || EMPLOYEES[0].id)
  const [tab,         setTab]         = useState(0)
  const [comments,    setComments]    = useState([])
  const [newComment,  setNewComment]  = useState('')
  const [author,      setAuthor]      = useState(EMPLOYEES[0].id)
  const [saving,      setSaving]      = useState(false)
  const [loadingCom,  setLoadingCom]  = useState(false)
  const [projects,    setProjects]    = useState([])
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setTitle(task?.title || '')
    setDescription(task?.description || '')
    setProjectName(task?.project_name || '')
    setWorkStatus(task?.work_status || 'in_progress')
    setDueDate(task?.due_date || '')
    setEmployeeId(task?.employee_id || defaultEmployeeId || EMPLOYEES[0].id)
    setTab(0)
    setComments([])
    setNewComment('')
  }, [task, open])

  useEffect(() => {
    if (tab === 1 && task?.id) loadComments()
  }, [tab, task?.id])

  useEffect(() => {
    if (!open) return
    supabase.from('tasks').select('project_name').neq('project_name', null)
      .then(({ data }) => {
        const unique = [...new Set((data || []).map(r => r.project_name).filter(Boolean))]
        setProjects(unique)
      })
  }, [open])

  async function loadComments() {
    if (!task?.id) return
    setLoadingCom(true)
    const { data } = await supabase
      .from('comments').select('*').eq('task_id', task.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setLoadingCom(false)
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const payload = {
      title:        title.trim(),
      description:  description.trim() || null,
      project_name: projectName.trim() || null,
      work_status:  workStatus,
      due_date:     dueDate || null,
      employee_id:  employeeId,
    }
    let saved
    if (isNew) {
      const { data } = await supabase.from('tasks')
        .insert([{ ...payload, position: Date.now(), status: 'active' }]).select().single()
      saved = data
    } else {
      const { data } = await supabase.from('tasks')
        .update(payload).eq('id', task.id).select().single()
      saved = data
    }
    setSaving(false)
    onSaved(saved)
  }

  async function handleDelete() {
    if (!task?.id) return
    if (!confirm('Eliminare questo task?')) return
    await supabase.from('comments').delete().eq('task_id', task.id)
    await supabase.from('tasks').delete().eq('id', task.id)
    onDeleted(task.id)
  }

  async function handleSendComment() {
    if (!newComment.trim() || !task?.id) return
    const emp = EMPLOYEES.find(e => e.id === author)
    const { data } = await supabase.from('comments').insert([{
      task_id:     task.id,
      author_name: emp?.name || 'Sconosciuto',
      body:        newComment.trim(),
    }]).select().single()
    setComments(c => [...c, data])
    setNewComment('')
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography fontWeight={700}>{isNew ? 'Nuovo task' : 'Modifica task'}</Typography>
        <Box>
          {!isNew && (
            <Tooltip title="Elimina task">
              <IconButton onClick={handleDelete} size="small" color="error" sx={{ mr: 0.5 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <IconButton onClick={onClose} size="small"><CloseIcon fontSize="small" /></IconButton>
        </Box>
      </DialogTitle>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Dettagli" sx={{ fontSize: '0.8rem' }} />
        <Tab label="Note & Chat" disabled={isNew} sx={{ fontSize: '0.8rem' }} />
      </Tabs>

      <DialogContent sx={{ pt: 2 }}>
        {tab === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Titolo task"
              value={title}
              onChange={e => setTitle(e.target.value)}
              fullWidth autoFocus required
            />

            <TextField
              label="Descrizione"
              value={description}
              onChange={e => setDescription(e.target.value)}
              fullWidth multiline minRows={2} maxRows={5}
              placeholder="Aggiungi una descrizione dell'attività…"
            />

            <Autocomplete
              freeSolo options={projects} value={projectName}
              onInputChange={(_, v) => setProjectName(v)}
              renderInput={params => <TextField {...params} label="Progetto" />}
            />

            <FormControl fullWidth>
              <InputLabel>Assegnato a</InputLabel>
              <Select value={employeeId} label="Assegnato a" onChange={e => setEmployeeId(e.target.value)}>
                {EMPLOYEES.map(emp => (
                  <MenuItem key={emp.id} value={emp.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 24, height: 24, bgcolor: stringToColor(emp.name), fontSize: '0.65rem' }}>
                        {getInitials(emp.name)}
                      </Avatar>
                      {emp.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl sx={{ flex: 1 }}>
                <InputLabel>Stato lavoro</InputLabel>
                <Select value={workStatus} label="Stato lavoro" onChange={e => setWorkStatus(e.target.value)}>
                  {WORK_STATUSES.map(s => (
                    <MenuItem key={s.value} value={s.value}>
                      <Chip label={s.label} size="small"
                        sx={{ bgcolor: s.color + '22', color: s.color, fontWeight: 700 }} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Scadenza" type="date" value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                InputLabelProps={{ shrink: true }} sx={{ flex: 1 }}
              />
            </Box>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: 360 }}>
            <Box sx={{ flex: 1, overflowY: 'auto', mb: 1 }}>
              {loadingCom ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', pt: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : comments.length === 0 ? (
                <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', pt: 4 }}>
                  Ancora nessuna nota. Scrivi il primo messaggio!
                </Typography>
              ) : (
                comments.map(c => {
                  const color = stringToColor(c.author_name)
                  return (
                    <Box key={c.id} sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
                      <Avatar sx={{ width: 28, height: 28, bgcolor: color, fontSize: '0.65rem', flexShrink: 0, mt: 0.3 }}>
                        {getInitials(c.author_name)}
                      </Avatar>
                      <Box>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                          <Typography variant="caption" fontWeight={700}>{c.author_name}</Typography>
                          <Typography variant="caption" color="text.disabled">
                            {format(new Date(c.created_at), 'd MMM HH:mm', { locale: it })}
                          </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mt: 0.2 }}>
                          {c.body}
                        </Typography>
                      </Box>
                    </Box>
                  )
                })
              )}
              <div ref={bottomRef} />
            </Box>

            <Divider sx={{ mb: 1.5 }} />

            <FormControl size="small" sx={{ mb: 1 }}>
              <InputLabel>Scrivi come</InputLabel>
              <Select value={author} label="Scrivi come" onChange={e => setAuthor(e.target.value)}>
                {EMPLOYEES.map(emp => (
                  <MenuItem key={emp.id} value={emp.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 20, height: 20, bgcolor: stringToColor(emp.name), fontSize: '0.6rem' }}>
                        {getInitials(emp.name)}
                      </Avatar>
                      <Typography variant="body2">{emp.name}</Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
              <TextField
                multiline maxRows={3} fullWidth size="small"
                placeholder="Scrivi una nota…"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment() } }}
              />
              <IconButton color="primary" onClick={handleSendComment} disabled={!newComment.trim()}>
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        )}
      </DialogContent>

      {tab === 0 && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} variant="contained"
            disabled={!title.trim() || saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
            {isNew ? 'Crea task' : 'Salva modifiche'}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
}
