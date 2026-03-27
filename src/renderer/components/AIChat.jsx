import React, { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const GLASS_BORDER = 'rgba(255, 255, 255, 0.07)'

export default function AIChat({ config, currentNote }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastUsage, setLastUsage] = useState(null)
  const [injectNote, setInjectNote] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const provider = config?.provider || 'anthropic'
    const apiKey = config?.apiKeys?.[provider]
    if (!apiKey) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `No API key configured for ${provider}. Please add one in the settings panel.`,
        error: true,
      }])
      return
    }

    const userMsg = { role: 'user', content: text }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    let systemPrompt = null
    if (injectNote && currentNote) {
      systemPrompt = `The user is working on the following note. Use it as context when answering:\n\n---\n${currentNote}\n---`
    }

    try {
      const result = await window.aiAPI.send({
        provider,
        model: config?.model,
        messages: nextMessages.map(m => ({ role: m.role, content: m.content })),
        apiKey,
        systemPrompt,
      })

      if (result.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: result.error, error: true }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: result.content }])
        if (result.usage) setLastUsage(result.usage)
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: e.message, error: true }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
    setLastUsage(null)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: `1px solid ${GLASS_BORDER}` }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#6b7280]">
            {config?.provider === 'openai' ? 'OpenAI' : 'Anthropic'} / {config?.model || 'default'}
          </span>
          {currentNote && (
            <button
              onClick={() => setInjectNote(v => !v)}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded transition-all"
              style={injectNote
                ? { background: 'rgba(124,58,237,0.18)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }
                : { color: '#6b7280', border: `1px solid ${GLASS_BORDER}` }
              }
              title="Include current note as context"
            >
              Inject note
            </button>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-[#6b7280] hover:text-[#e2e4f0] transition-colors px-1.5 py-0.5 rounded"
            style={{ border: `1px solid ${GLASS_BORDER}` }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl opacity-10 mb-3">💬</div>
              <p className="text-[#6b7280] text-sm">Start a conversation</p>
              {currentNote && (
                <p className="text-[#6b7280]/60 text-xs mt-1">Enable "Inject note" to include your current note as context</p>
              )}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[85%] px-3 py-2 rounded-xl text-sm"
              style={msg.role === 'user'
                ? {
                    background: 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(109,40,217,0.35))',
                    border: '1px solid rgba(124,58,237,0.3)',
                    color: '#e2e4f0',
                  }
                : msg.error
                ? {
                    background: 'rgba(243,139,168,0.1)',
                    border: '1px solid rgba(243,139,168,0.2)',
                    color: '#f38ba8',
                  }
                : {
                    background: 'rgba(0,0,0,0.2)',
                    backdropFilter: 'blur(12px)',
                    border: `1px solid ${GLASS_BORDER}`,
                    color: '#e2e4f0',
                  }
              }
            >
              {msg.role === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div
              className="px-3 py-2 rounded-xl text-sm"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: `1px solid ${GLASS_BORDER}`,
              }}
            >
              <span className="text-[#6b7280] animate-pulse">Thinking...</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Usage footer */}
      {lastUsage && (
        <div
          className="px-3 py-1 flex-shrink-0 flex items-center gap-3"
          style={{ borderTop: `1px solid ${GLASS_BORDER}` }}
        >
          {lastUsage.input_tokens != null && (
            <span className="text-xs text-[#6b7280]/50 font-mono">
              in: {lastUsage.input_tokens} / out: {lastUsage.output_tokens}
            </span>
          )}
          {lastUsage.prompt_tokens != null && (
            <span className="text-xs text-[#6b7280]/50 font-mono">
              in: {lastUsage.prompt_tokens} / out: {lastUsage.completion_tokens}
            </span>
          )}
        </div>
      )}

      {/* Input area */}
      <div
        className="px-3 py-3 flex-shrink-0"
        style={{ borderTop: `1px solid ${GLASS_BORDER}` }}
      >
        <div
          className="flex gap-2 rounded-xl p-2"
          style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... (Enter to send, Shift+Enter for newline)"
            rows={2}
            className="flex-1 bg-transparent text-[#e2e4f0] text-sm resize-none focus:outline-none placeholder-[#6b7280]/50"
            style={{ minHeight: '2.5rem', maxHeight: '8rem' }}
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="self-end px-3 py-1.5 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 2px 8px rgba(124,58,237,0.3)' }}
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
