import { useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import StatusBadge from './StatusBadge.jsx'

const TYPE_COLORS = {
  coding: '#6366f1',
  ops: '#f59e0b',
  qa: '#10b981',
  general: '#71717a',
  research: '#8b5cf6',
}

const STATUS_COLOR = {
  todo: '#71717a',
  assigned: '#58a6ff',
  in_progress: '#58a6ff',
  running: '#58a6ff',
  done: '#3fb950',
  completed: '#3fb950',
  qa: '#d29922',
  failed: '#f85149',
}

const AGENT_EMOJI = {
  neo: '\u{1F576}\uFE0F',
  alpha: '\u{1F9E0}',
  beta: '\u26A1',
  mu: '\u{1F527}',
}

const GHERKIN_KEYWORDS = /^(Given|When|Then|And|But|Scenario|Background|Feature|Scenario Outline|Examples)\b/

function getAgentEmoji(agent) {
  if (!agent) return '\u{1F916}'
  return AGENT_EMOJI[agent.toLowerCase()] || '\u{1F916}'
}

function formatDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return iso
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatShortDate(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d)) return null
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/* -- Gherkin-aware Markdown -------------------------------- */
function processGherkin(text) {
  if (!text) return text
  const lines = text.split('\n')
  const result = []
  let inGherkin = false
  let gherkinBlock = []

  function flushGherkin() {
    if (gherkinBlock.length > 0) {
      result.push('%%%GHERKIN_START%%%')
      gherkinBlock.forEach(l => result.push(l))
      result.push('%%%GHERKIN_END%%%')
      gherkinBlock = []
    }
    inGherkin = false
  }

  for (const line of lines) {
    const trimmed = line.trimStart()
    if (GHERKIN_KEYWORDS.test(trimmed)) {
      inGherkin = true
      gherkinBlock.push(line)
    } else if (inGherkin && (trimmed === '' || trimmed.startsWith('|') || trimmed.startsWith('#'))) {
      gherkinBlock.push(line)
    } else {
      flushGherkin()
      result.push(line)
    }
  }
  flushGherkin()
  return result.join('\n')
}

function GherkinBlock({ text }) {
  const lines = text.split('\n').filter(l => l.trim() !== '')
  return (
    <div className="rounded-lg px-4 py-3 my-2 border-l-4 border-[#3fb950] font-mono text-sm" style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)' }}>
      {lines.map((line, i) => {
        const trimmed = line.trimStart()
        const match = trimmed.match(GHERKIN_KEYWORDS)
        if (match) {
          const keyword = match[1]
          const rest = trimmed.slice(keyword.length)
          return (
            <div key={i} className="py-0.5">
              <span className="font-bold" style={{ color: '#3fb950' }}>{keyword}</span>
              <span className="text-[#a1a1aa]">{rest}</span>
            </div>
          )
        }
        return <div key={i} className="py-0.5 text-[#a1a1aa] pl-4">{line}</div>
      })}
    </div>
  )
}

function DescriptionWithGherkin({ text }) {
  const processed = processGherkin(text)
  const parts = processed.split(/(%%%GHERKIN_START%%%[\s\S]*?%%%GHERKIN_END%%%)/)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('%%%GHERKIN_START%%%')) {
          const inner = part.replace('%%%GHERKIN_START%%%\n', '').replace('\n%%%GHERKIN_END%%%', '').replace('%%%GHERKIN_START%%%', '').replace('%%%GHERKIN_END%%%', '')
          return <GherkinBlock key={i} text={inner} />
        }
        if (part.trim() === '') return null
        return (
          <div key={i} className="prose prose-invert prose-sm max-w-none text-[#8b949e] [&_a]:text-[#58a6ff] [&_code]:bg-white/10 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-white/5 [&_pre]:rounded-lg [&_pre]:p-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
          </div>
        )
      })}
    </>
  )
}

/* -- Horizontal Timeline ---------------------------------- */
const TIMELINE_STEPS = [
  { key: 'created', label: 'Created', statuses: ['todo', 'assigned', 'in_progress', 'running', 'done', 'completed', 'failed', 'qa'] },
  { key: 'assigned', label: 'Assigned', statuses: ['assigned', 'in_progress', 'running', 'done', 'completed', 'failed', 'qa'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress', 'running', 'done', 'completed', 'failed', 'qa'] },
  { key: 'done', label: 'Done', statuses: ['done', 'completed', 'failed', 'qa'] },
  { key: 'qa', label: 'QA', statuses: ['qa', 'completed'] },
  { key: 'completed', label: 'Completed', statuses: ['completed'] },
]

function getStepTime(task, stepKey) {
  if (stepKey === 'created') return task.created_at || task.createdAt
  if (stepKey === 'completed' || stepKey === 'done') return task.completed_at || task.completedAt
  if (stepKey === 'assigned' || stepKey === 'in_progress' || stepKey === 'qa') return task.updated_at || task.updatedAt
  return null
}

function Timeline({ task }) {
  const status = task.status || 'todo'
  const isFailed = status === 'failed'

  const steps = isFailed
    ? [...TIMELINE_STEPS.slice(0, -1), { key: 'failed', label: 'Failed', statuses: ['failed'] }]
    : TIMELINE_STEPS

  const activeIdx = steps.reduce((last, s, i) => s.statuses.includes(status) ? i : last, -1)

  return (
    <div className="flex flex-wrap gap-y-4 items-start">
      {steps.map((step, i) => {
        const isCompleted = i < activeIdx
        const isCurrent = i === activeIdx
        const isFail = step.key === 'failed'
        const color = isFail ? '#f85149' : isCompleted ? '#3fb950' : isCurrent ? (STATUS_COLOR[status] || '#58a6ff') : '#3f3f46'
        const stepTime = (isCompleted || isCurrent) ? getStepTime(task, step.key) : null

        return (
          <div key={step.key} className="flex items-start flex-1 min-w-[80px]">
            <div className="flex flex-col items-center">
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isCurrent ? 'animate-pulse' : ''}`}
                style={{
                  borderColor: color,
                  backgroundColor: (isCompleted || isCurrent) ? color : 'transparent',
                }}
              >
                {isCompleted && (
                  <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {isCurrent && !isCompleted && (
                  <div className="w-2 h-2 rounded-full bg-black/50" />
                )}
              </div>
              <span className={`text-[10px] mt-1.5 font-medium text-center leading-tight ${isCurrent ? 'text-[#e4e4e7]' : isCompleted ? 'text-[#8b949e]' : 'text-[#52525b]'}`}>
                {step.label}
              </span>
              {stepTime && (
                <span className="text-[9px] text-[#52525b] mt-0.5 text-center">{formatShortDate(stepTime)}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 flex items-center pt-2.5 px-1 min-w-[16px]">
                <div className="h-0.5 w-full rounded" style={{ backgroundColor: isCompleted ? '#3fb950' : '#3f3f46' }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* -- Syntax-Highlighted JSON ------------------------------ */
function JsonSyntax({ data, indent = 0 }) {
  const pad = '  '.repeat(indent)
  const padInner = '  '.repeat(indent + 1)

  if (data === null) return <span style={{ color: '#f85149' }}>null</span>
  if (typeof data === 'boolean') return <span style={{ color: '#f85149' }}>{String(data)}</span>
  if (typeof data === 'number') return <span style={{ color: '#d29922' }}>{String(data)}</span>
  if (typeof data === 'string') return <span style={{ color: '#3fb950' }}>"{data}"</span>

  if (Array.isArray(data)) {
    if (data.length === 0) return <span style={{ color: '#71717a' }}>[]</span>
    return (
      <span>
        <span style={{ color: '#71717a' }}>[</span>{'\n'}
        {data.map((item, i) => (
          <span key={i}>
            {padInner}<JsonSyntax data={item} indent={indent + 1} />
            {i < data.length - 1 ? <span style={{ color: '#71717a' }}>,</span> : null}{'\n'}
          </span>
        ))}
        {pad}<span style={{ color: '#71717a' }}>]</span>
      </span>
    )
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data)
    if (entries.length === 0) return <span style={{ color: '#71717a' }}>{'{}'}</span>
    return (
      <span>
        <span style={{ color: '#71717a' }}>{'{'}</span>{'\n'}
        {entries.map(([key, val], i) => (
          <span key={key}>
            {padInner}<span style={{ color: '#58a6ff' }}>"{key}"</span><span style={{ color: '#71717a' }}>: </span><JsonSyntax data={val} indent={indent + 1} />
            {i < entries.length - 1 ? <span style={{ color: '#71717a' }}>,</span> : null}{'\n'}
          </span>
        ))}
        {pad}<span style={{ color: '#71717a' }}>{'}'}</span>
      </span>
    )
  }

  return <span>{String(data)}</span>
}

/* -- JSON Result renderer --------------------------------- */
function ResultDisplay({ result }) {
  if (!result) return <p className="text-sm text-[#71717a]">No result yet</p>

  let parsed = result
  if (typeof result === 'string') {
    try { parsed = JSON.parse(result) } catch { return <p className="text-sm text-[#8b949e] whitespace-pre-wrap">{result}</p> }
  }

  if (typeof parsed !== 'object' || parsed === null)
    return <p className="text-sm text-[#8b949e] whitespace-pre-wrap">{String(parsed)}</p>

  return (
    <pre className="text-sm font-mono whitespace-pre-wrap overflow-x-auto">
      <JsonSyntax data={parsed} indent={0} />
    </pre>
  )
}

/* -- Modal ------------------------------------------------ */
function TaskDetailModal({ task, onClose, onRetry, onReassign }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!task) return null

  const typeColor = TYPE_COLORS[task.type] || TYPE_COLORS.general

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#18181b] border border-white/10 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ backgroundColor: typeColor + '20', color: typeColor }}>
                  {task.type || 'general'}
                </span>
                {task.priority != null && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#71717a]">P{task.priority}</span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-[#e4e4e7] leading-snug">{task.title || task.task}</h2>
            </div>
            <StatusBadge status={task.status} pulse={task.status === 'running' || task.status === 'in_progress'} />
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-[#71717a]">
            {task.assigned_agent && (
              <span>Agent: <span className="text-[#8b949e]">{getAgentEmoji(task.assigned_agent)} {task.assigned_agent}</span></span>
            )}
            {task.dispatched_by && <span>Dispatched by: <span className="text-[#8b949e]">{task.dispatched_by}</span></span>}
            <span>ID: <span className="text-[#8b949e] font-mono">{task.id?.slice(0, 8)}</span></span>
          </div>
        </div>

        <div className="h-px bg-white/10" />

        {/* Body */}
        <div className="p-6 space-y-6">
          {(task.description || task.prompt || task.task) && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717a] mb-2">Description</h3>
              <DescriptionWithGherkin text={task.description || task.prompt || task.task || ''} />
            </section>
          )}

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717a] mb-3">Timeline</h3>
            <Timeline task={task} />
          </section>

          {(task.result || task.error) && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717a] mb-2">
                {task.error ? 'Error' : 'Result'}
              </h3>
              {task.error ? (
                <div className="bg-[#f85149]/10 rounded-lg p-3 text-sm text-[#f85149]">{task.error}</div>
              ) : (
                <div className="bg-white/5 rounded-lg p-3">
                  <ResultDisplay result={task.result} />
                </div>
              )}
            </section>
          )}
        </div>

        <div className="h-px bg-white/10" />

        {/* Actions */}
        <div className="p-4 flex justify-end gap-2">
          <button
            onClick={() => onReassign?.(task)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-white/5 text-[#8b949e] hover:bg-white/10 transition-colors"
          >
            Reassign
          </button>
          <button
            onClick={() => onRetry?.(task)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#6366f1]/20 text-[#6366f1] hover:bg-[#6366f1]/30 transition-colors"
          >
            Retry
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-white/10 text-[#e4e4e7] hover:bg-white/15 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default TaskDetailModal
