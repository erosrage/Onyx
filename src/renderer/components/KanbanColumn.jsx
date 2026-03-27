import React, { useState } from 'react'
import KanbanCard from './KanbanCard'

export default function KanbanColumn({ column, files, cardData, onOpenFile, onMoveCard, onReorderColumn }) {
  const [isCardTarget, setIsCardTarget] = useState(false)
  const [isColTarget, setIsColTarget] = useState(false)

  const isColDrag = (e) => e.dataTransfer.types.includes('application/onyx-kanban-col')

  const handleDragOver = (e) => {
    e.preventDefault()
    if (isColDrag(e)) setIsColTarget(true)
    else setIsCardTarget(true)
  }

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsCardTarget(false)
      setIsColTarget(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsCardTarget(false)
    setIsColTarget(false)
    const colId = e.dataTransfer.getData('application/onyx-kanban-col')
    if (colId) { onReorderColumn(colId, column.id); return }
    const filePath = e.dataTransfer.getData('application/onyx-kanban-card')
    if (filePath) onMoveCard(filePath, column.id)
  }

  const handleColDragStart = (e) => {
    e.dataTransfer.setData('application/onyx-kanban-col', column.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col rounded-xl"
      style={{
        width: 240,
        minWidth: 240,
        background: isCardTarget ? 'var(--accent-light)' : 'var(--glass-bg)',
        border: isColTarget ? '2px dashed var(--accent-light)' : isCardTarget ? '1px solid var(--accent-glow)' : '1px solid var(--glass-border)',
        transition: 'background 0.15s, border-color 0.15s',
        padding: '10px 10px 6px',
        maxHeight: '100%',
      }}
    >
      {/* Column header — drag handle for reordering */}
      <div
        draggable
        onDragStart={handleColDragStart}
        className="flex items-center justify-between mb-3 flex-shrink-0"
        style={{ cursor: 'grab', userSelect: 'none' }}
        title="Drag to reorder column"
      >
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--text-dim)', fontSize: 10, letterSpacing: 1, opacity: 0.5 }}>⠿</span>
          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
            {column.label}
          </span>
        </div>
        <span
          className="text-[10px] font-mono px-1.5 py-px rounded"
          style={{ background: 'var(--glass-bg-strong)', color: 'var(--text-dim)' }}
        >
          {files.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto pr-0.5" style={{ minHeight: 60 }}>
        {files.length === 0 ? (
          <div
            className="flex items-center justify-center rounded-lg text-xs"
            style={{
              height: 60,
              border: '1px dashed var(--glass-border)',
              color: 'var(--text-dim)',
            }}
          >
            Drop notes here
          </div>
        ) : (
          files.map(file => (
            <KanbanCard
              key={file.path}
              file={file}
              cardData={cardData[file.path]}
              onOpenFile={onOpenFile}
              isDone={column.id === 'done'}
              onDragStart={e => {
                e.dataTransfer.setData('application/onyx-kanban-card', file.path)
                e.dataTransfer.effectAllowed = 'move'
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
