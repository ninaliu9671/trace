'use client'
import ReactMarkdown from 'react-markdown'

interface MarkdownEditorProps {
  content: string
  onChange: (value: string) => void
  mode: 'edit' | 'preview'
  locked: boolean
  onSwitchToEdit?: () => void
}

export default function MarkdownEditor({
  content, onChange, mode, locked, onSwitchToEdit,
}: MarkdownEditorProps) {
  if (mode === 'edit') {
    return (
      <textarea
        value={content}
        onChange={e => onChange(e.target.value)}
        readOnly={locked}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 480,
          padding: '24px',
          fontSize: 13,
          fontFamily: '"JetBrains Mono", "Courier New", monospace',
          lineHeight: 1.8,
          color: '#1A1A1A',
          background: locked ? '#F8F7F4' : '#FFFFFF',
          border: 'none',
          outline: 'none',
          resize: 'none',
          boxSizing: 'border-box',
        }}
      />
    )
  }

  return (
    <div style={{ padding: '24px', fontSize: 14, lineHeight: 1.8, color: '#1A1A1A', maxWidth: 720 }}>
      <MarkdownPreview content={content} onPlaceholderClick={onSwitchToEdit} />
    </div>
  )
}

function MarkdownPreview({
  content,
  onPlaceholderClick,
}: {
  content: string
  onPlaceholderClick?: () => void
}) {
  const segments = splitAnnotations(content)

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'ai-guess') {
          return (
            <div key={i} style={{
              borderLeft: '2.5px solid #F59E0B',
              background: '#FFFBEB',
              padding: '8px 14px',
              margin: '12px 0',
              borderRadius: '0 6px 6px 0',
              fontSize: 13,
              color: '#92400E',
              lineHeight: 1.7,
            }}>
              <span style={{ fontWeight: 500 }}>✦ AI 推测 · </span>
              {seg.text}
            </div>
          )
        }

        if (seg.type === 'placeholder') {
          return (
            <div
              key={i}
              onClick={onPlaceholderClick}
              style={{
                borderLeft: '2.5px solid #F87171',
                background: '#FFF0F0',
                padding: '8px 14px',
                margin: '12px 0',
                borderRadius: '0 6px 6px 0',
                fontSize: 13,
                color: '#B91C1C',
                lineHeight: 1.7,
                cursor: onPlaceholderClick ? 'pointer' : 'default',
              }}
            >
              <span style={{ fontWeight: 500 }}>⚠ 请补充：</span>
              {seg.text}
            </div>
          )
        }

        return (
          <div key={i} className="markdown-body">
            <ReactMarkdown>{seg.text}</ReactMarkdown>
          </div>
        )
      })}

      <style>{`
        .markdown-body h1 { font-size: 20px; font-weight: 600; margin: 24px 0 12px; color: #1A1A1A; }
        .markdown-body h2 { font-size: 17px; font-weight: 600; margin: 20px 0 10px; color: #1A1A1A; border-bottom: 1px solid #F0EDE8; padding-bottom: 6px; }
        .markdown-body h3 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; color: #1A1A1A; }
        .markdown-body p  { margin: 8px 0; color: #1A1A1A; }
        .markdown-body ul, .markdown-body ol { padding-left: 20px; margin: 8px 0; }
        .markdown-body li { margin: 4px 0; }
        .markdown-body strong { font-weight: 600; }
        .markdown-body blockquote { border-left: 3px solid #E8E4DD; padding-left: 12px; color: #6B6B6B; margin: 12px 0; }
        .markdown-body code { font-family: "JetBrains Mono", monospace; font-size: 12px; background: #F4F3F0; padding: 1px 4px; border-radius: 3px; }
        .markdown-body pre { background: #F4F3F0; padding: 12px; border-radius: 6px; overflow-x: auto; }
        .markdown-body pre code { background: none; padding: 0; }
        .markdown-body hr { border: none; border-top: 1px solid #F0EDE8; margin: 20px 0; }
      `}</style>
    </>
  )
}

type Segment =
  | { type: 'text'; text: string }
  | { type: 'ai-guess'; text: string }
  | { type: 'placeholder'; text: string }

function splitAnnotations(content: string): Segment[] {
  const pattern = /<!--\s*(ai-guess|placeholder):\s*([\s\S]*?)\s*-->/g
  const segments: Segment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim()
      if (text) segments.push({ type: 'text', text })
    }
    segments.push({ type: match[1] as 'ai-guess' | 'placeholder', text: match[2].trim() })
    lastIndex = match.index + match[0].length
  }

  const tail = content.slice(lastIndex).trim()
  if (tail) segments.push({ type: 'text', text: tail })

  return segments
}
