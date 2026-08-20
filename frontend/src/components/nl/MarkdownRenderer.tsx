import { useMemo } from 'react'
import { marked } from 'marked'

interface MarkdownRendererProps {
  content: string
}

// Configure marked once
marked.setOptions({
  breaks: true,
  gfm: true,
})

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const html = useMemo(() => {
    try {
      // marked.parse returns a string when used synchronously (no callback)
      return marked.parse(content) as string
    } catch {
      // Fallback: escape and return as plain text
      return escapeHtml(content)
    }
  }, [content])

  return (
    <div
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
