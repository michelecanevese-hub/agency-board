import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Card, CardContent, Typography, Chip, Box,
  IconButton, Tooltip,
} from '@mui/material'
import EditIcon from '@mui/icons-material/EditOutlined'
import ChatBubbleIcon from '@mui/icons-material/ChatBubbleOutline'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { format, isPast, isWithinInterval, addDays } from 'date-fns'
import { it } from 'date-fns/locale'
import { WORK_STATUS_MAP, stringToColor } from '../lib/constants'

export default function TaskCard({ task, commentCount = 0, onClick, onMarkDone }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  const ws = WORK_STATUS_MAP[task.work_status] || WORK_STATUS_MAP['in_progress']
  const projectColor = task.project_name ? stringToColor(task.project_name) : '#78909C'

  const dueDate = task.due_date ? new Date(task.due_date + 'T00:00:00') : null
  const isOverdue = dueDate && isPast(dueDate)
  const isSoon    = dueDate && !isOverdue && isWithinInterval(dueDate, {
    start: new Date(), end: addDays(new Date(), 2),
  })

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      elevation={isDragging ? 8 : 1}
      sx={{
        mb: 1,
        borderLeft: `3px solid ${ws.color}`,
        '&:hover .task-actions': { opacity: 1 },
        position: 'relative',
      }}
    >
      <CardContent sx={{ p: '10px !important' }}>
        {task.project_name && (
          <Chip label={task.project_name} size="small" sx={{
            bgcolor: projectColor + '22', color: projectColor,
            border: `1px solid ${projectColor}44`,
            mb: 0.75, maxWidth: '100%', height: 20, fontSize: '0.65rem',
          }} />
        )}

        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3, mb: 0.5 }}>
          {task.title}
        </Typography>

        {task.description && (
          <Typography variant="caption" color="text.secondary" sx={{
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', lineHeight: 1.4, mb: 0.75, fontSize: '0.7rem',
          }}>
            {task.description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Chip label={ws.label} size="small" sx={{
              bgcolor: ws.color + '22', color: ws.color, height: 18, fontSize: '0.62rem',
            }} />
            {dueDate && (
              <Chip label={format(dueDate, 'd MMM', { locale: it })} size="small" sx={{
                bgcolor: isOverdue ? '#f4433622' : isSoon ? '#ff980022' : 'action.hover',
                color:   isOverdue ? '#f44336'   : isSoon ? '#ff9800'   : 'text.secondary',
                border: (isOverdue || isSoon) ? `1px solid ${isOverdue ? '#f44336' : '#ff9800'}44` : 'none',
                height: 18, fontSize: '0.62rem',
              }} />
            )}
          </Box>

          <Box className="task-actions" sx={{ display: 'flex', opacity: 0, transition: 'opacity 0.15s' }}
            onPointerDown={e => e.stopPropagation()}>
            {commentCount > 0 && (
              <Tooltip title={`${commentCount} note`}>
                <Box sx={{ display: 'flex', alignItems: 'center', mr: 0.5 }}>
                  <ChatBubbleIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ ml: 0.3, color: 'text.secondary' }}>{commentCount}</Typography>
                </Box>
              </Tooltip>
            )}
            <Tooltip title="Segna come svolto">
              <IconButton size="small" color="success"
                onClick={e => { e.stopPropagation(); onMarkDone(task) }} sx={{ p: 0.4 }}>
                <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Apri / modifica">
              <IconButton size="small" onClick={e => { e.stopPropagation(); onClick(task) }} sx={{ p: 0.4 }}>
                <EditIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
