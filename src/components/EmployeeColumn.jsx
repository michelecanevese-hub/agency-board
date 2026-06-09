import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import {
  Box, Typography, Avatar, Button, Chip, Paper,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import TaskCard from './TaskCard'
import { getInitials, stringToColor } from '../lib/constants'

export default function EmployeeColumn({ employee, tasks, commentCounts, onAddTask, onOpenTask }) {
  const { setNodeRef, isOver } = useDroppable({ id: employee.id })
  const avatarColor = stringToColor(employee.name)

  return (
    <Box
      sx={{
        width: 260,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Column header */}
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          mb: 1,
          borderRadius: 2,
          background: theme => theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(0,0,0,0.03)',
          borderBottom: `2px solid ${avatarColor}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 32, height: 32, bgcolor: avatarColor, fontSize: '0.75rem', fontWeight: 700 }}>
            {getInitials(employee.name)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap sx={{ fontSize: '0.78rem', lineHeight: 1.2 }}>
              {employee.name.split(' ')[0]} {employee.name.split(' ')[1]}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {employee.role}
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
          <Chip
            label={`${tasks.length} task`}
            size="small"
            sx={{ height: 18, fontSize: '0.62rem', bgcolor: avatarColor + '22', color: avatarColor }}
          />
          <Button
            size="small"
            startIcon={<AddIcon sx={{ fontSize: '14px !important' }} />}
            onClick={() => onAddTask(employee.id)}
            sx={{ fontSize: '0.68rem', py: 0.2, px: 0.8, minWidth: 0 }}
          >
            Aggiungi
          </Button>
        </Box>
      </Paper>

      {/* Drop zone — always has ref so empty columns accept drops */}
      <Box
        ref={setNodeRef}
        sx={{
          flex: 1,
          minHeight: 120,
          borderRadius: 2,
          border: '2px dashed',
          borderColor: isOver ? 'primary.main' : 'transparent',
          bgcolor: isOver ? 'primary.main' + '11' : 'transparent',
          transition: 'all 0.15s',
          p: 0.5,
          overflowY: 'auto',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-thumb': { borderRadius: 2, bgcolor: 'divider' },
        }}
      >
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              commentCount={commentCounts[task.id] || 0}
              onClick={onOpenTask}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              border: '1.5px dashed',
              borderColor: isOver ? 'primary.main' : 'divider',
              borderRadius: 2,
              bgcolor: isOver ? 'primary.main' + '08' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            <Typography variant="caption" color={isOver ? 'primary.main' : 'text.disabled'}>
              {isOver ? 'Rilascia qui' : 'Nessun task'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
