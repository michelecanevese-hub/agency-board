export const EMPLOYEES = [
  { id: 'michele',    name: 'Michele Canevese',     role: 'Presidente Massimo' },
  { id: 'alessandro', name: 'Alessandro Carella',   role: 'Brand Design' },
  { id: 'aldo',       name: 'Aldo Goccione',        role: 'Fantasista' },
  { id: 'nicolo',     name: 'Nicolò Aversa',        role: 'Web Development' },
  { id: 'marco',      name: 'Marco Candrian',       role: 'Art Director | Motion' },
  { id: 'valentina',  name: 'Valentina Quagliotto', role: 'Editorial Design | Social' },
  { id: 'lorena',     name: 'Lorena Lauran',        role: 'Web Development' },
  { id: 'cosimo',     name: 'Cosimo Scatigno',      role: 'Motion Graphics' },
  { id: 'stage',      name: 'Stage',                role: 'Generalist' },
]

export const WORK_STATUSES = [
  { value: 'in_progress', label: 'In Progress', color: '#42A5F5' },
  { value: 'standby',     label: 'Standby',     color: '#FF9800' },
]

export const WORK_STATUS_MAP = Object.fromEntries(WORK_STATUSES.map(s => [s.value, s]))

// Legacy priority kept for old tasks that still have it
export const PRIORITIES = [
  { value: 'low',    label: 'Bassa',  color: '#4caf50' },
  { value: 'medium', label: 'Media',  color: '#ff9800' },
  { value: 'high',   label: 'Alta',   color: '#f44336' },
]
export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map(p => [p.value, p]))

export function stringToColor(str) {
  const palette = [
    '#5C6BC0','#42A5F5','#26A69A','#66BB6A',
    '#FFA726','#EF5350','#AB47BC','#EC407A',
    '#8D6E63','#78909C',
  ]
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash)
  return palette[Math.abs(hash) % palette.length]
}

export function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}
