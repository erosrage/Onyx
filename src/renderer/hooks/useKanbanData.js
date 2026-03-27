import { useState, useEffect, useCallback } from 'react'

const STATUS_RE = /#status\/([a-zA-Z0-9_-]+)/

export const DEFAULT_COLUMNS = [
  { id: 'inbox',       label: 'Inbox' },
  { id: 'todo',        label: 'To Do' },
  { id: 'in-progress', label: 'In Progress' },
  { id: 'done',        label: 'Done' },
]

export function parseStatus(content) {
  const match = content.match(STATUS_RE)
  return match?.[1] ?? null
}

export function parseExcerpt(content) {
  const lines = content.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('#')) continue
    if (/^#[a-zA-Z]/.test(trimmed)) continue
    if (trimmed.startsWith('---')) continue
    const cleaned = trimmed.replace(/#status\/[a-zA-Z0-9_-]+/g, '').trim()
    if (cleaned) return cleaned.length > 80 ? cleaned.slice(0, 80) + '…' : cleaned
  }
  return ''
}

export function parseTags(content) {
  const tags = []
  const re = /#([a-zA-Z][a-zA-Z0-9_-]*)/g
  let m
  while ((m = re.exec(content)) !== null) {
    if (!m[1].startsWith('status/') && m[1] !== 'status') tags.push(m[1])
  }
  return [...new Set(tags)]
}

export function writeStatus(content, newCol) {
  if (STATUS_RE.test(content)) return content.replace(STATUS_RE, `#status/${newCol}`)
  if (/^# .+/m.test(content)) return content.replace(/^(# .+\n?)/, `$1#status/${newCol}\n`)
  return `#status/${newCol}\n${content}`
}

export function buildColumnsMap(columnDefs, files, cardData) {
  const firstId = columnDefs[0]?.id ?? 'inbox'
  const map = {}
  for (const col of columnDefs) map[col.id] = []

  for (const file of files) {
    const status = cardData[file.path]?.status ?? null
    const colId = (status && columnDefs.some(c => c.id === status)) ? status : firstId
    if (!map[colId]) map[colId] = []
    map[colId].push(file)
  }
  return map
}

export default function useKanbanData(scopedFiles, showKanban) {
  const [cardData, setCardData] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!showKanban || scopedFiles.length === 0) return
    let cancelled = false
    setLoading(true)

    Promise.all(
      scopedFiles.map(f =>
        window.electronAPI.readFile(f.path).then(res => ({
          path: f.path,
          content: res.success ? res.content : '',
        }))
      )
    ).then(results => {
      if (cancelled) return
      const map = {}
      for (const { path, content } of results) {
        map[path] = {
          status: parseStatus(content),
          excerpt: parseExcerpt(content),
          tags: parseTags(content),
          content,
        }
      }
      setCardData(map)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [scopedFiles, showKanban])

  const moveCard = useCallback(async (filePath, toColumn) => {
    const current = cardData[filePath]
    if (!current || current.status === toColumn) return

    setCardData(prev => ({ ...prev, [filePath]: { ...prev[filePath], status: toColumn } }))
    const newContent = writeStatus(current.content, toColumn)
    await window.electronAPI.writeFile(filePath, newContent)
    setCardData(prev => ({ ...prev, [filePath]: { ...prev[filePath], content: newContent } }))
  }, [cardData])

  return { cardData, loading, moveCard }
}
