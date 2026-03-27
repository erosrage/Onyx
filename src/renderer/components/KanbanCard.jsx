import React from 'react'

export default function KanbanCard({ file, cardData, onOpenFile, onDragStart, isDone }) {
  const { excerpt = '', tags = [] } = cardData ?? {}
  const visibleTags = tags.slice(0, 3)
  const extraTags = tags.length > 3 ? tags.length - 3 : 0

  const breadcrumb = file.folder
    ? file.folder.split('/').slice(0, 2).join(' / ')
    : null

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => onOpenFile(file)}
      className="rounded-lg px-3 py-2.5 mb-1.5 cursor-grab active:cursor-grabbing transition-all duration-150"
      style={{
        background: 'var(--glass-bg-strong)',
        border: '1px solid var(--glass-border)',
        opacity: isDone ? 0.55 : 1,
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--glass-border-strong)'
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--glass-border)'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
        {file.name}
      </div>

      {excerpt && (
        <div className="text-xs mt-1 leading-snug" style={{ color: 'var(--text-muted)' }}>
          {excerpt}
        </div>
      )}

      {(visibleTags.length > 0 || breadcrumb) && (
        <div className="flex items-center flex-wrap gap-1 mt-2">
          {visibleTags.map(tag => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-px rounded"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent-text)' }}
            >
              #{tag}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="text-[10px] px-1.5 py-px rounded" style={{ background: 'rgba(167,139,250,0.08)', color: 'var(--accent-text)' }}>
              +{extraTags}
            </span>
          )}
          {breadcrumb && (
            <span className="text-[10px] ml-auto" style={{ color: 'var(--text-dim)' }}>
              {breadcrumb}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
