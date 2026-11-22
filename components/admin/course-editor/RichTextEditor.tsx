'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link as LinkIcon,
  Unlink,
  RemoveFormatting,
  Pilcrow,
} from 'lucide-react'
import { sanitizeHtml, sanitizeLinkUrl } from '@/lib/sanitize'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Write lesson text here...',
  minHeight = '140px',
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalUpdate = useRef(false)
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const savedSelection = useRef<Range | null>(null)

  // Initialize and synchronize HTML from prop (only when external changes happen)
  useEffect(() => {
    if (!editorRef.current) return
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }

    const currentHtml = editorRef.current.innerHTML
    const sanitizedIncoming = sanitizeHtml(value || '')

    if (currentHtml !== sanitizedIncoming) {
      editorRef.current.innerHTML = sanitizedIncoming
    }
  }, [value])

  const handleInput = useCallback(() => {
    if (!editorRef.current) return
    isInternalUpdate.current = true
    const rawHtml = editorRef.current.innerHTML

    // If completely empty or just <br>, normalize to empty string
    if (rawHtml === '<br>' || rawHtml === '<p><br></p>' || rawHtml.trim() === '') {
      onChange('')
      return
    }

    const clean = sanitizeHtml(rawHtml)
    onChange(clean)
  }, [onChange])

  const executeCommand = useCallback(
    (command: string, arg: string | undefined = undefined) => {
      if (!editorRef.current) return
      editorRef.current.focus()
      document.execCommand(command, false, arg)
      handleInput()
    },
    [handleInput]
  )

  const saveCurrentSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedSelection.current = sel.getRangeAt(0).cloneRange()
    }
  }

  const restoreSavedSelection = () => {
    if (savedSelection.current && window.getSelection) {
      const sel = window.getSelection()
      if (sel) {
        sel.removeAllRanges()
        sel.addRange(savedSelection.current)
      }
    }
  }

  const handleOpenLinkModal = () => {
    saveCurrentSelection()
    setLinkUrl('')
    setLinkError(null)
    setIsLinkModalOpen(true)
  }

  const handleApplyLink = () => {
    const clean = sanitizeLinkUrl(linkUrl)
    if (!clean) {
      setLinkError('Please enter a valid link starting with http://, https://, or mailto:')
      return
    }

    setIsLinkModalOpen(false)
    restoreSavedSelection()
    executeCommand('createLink', clean)
  }

  return (
    <div className="border border-stone-300 dark:border-stone-700 rounded-xl overflow-hidden bg-white dark:bg-stone-900 shadow-2xs focus-within:border-amber-500 dark:focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-500/15 transition">
      {/* ── Toolbar ────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 p-1.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 overflow-x-auto select-none">
        <ToolbarButton
          icon={<Pilcrow className="w-4 h-4" />}
          title="Paragraph"
          onClick={() => executeCommand('formatBlock', '<p>')}
        />
        <ToolbarButton
          icon={<Heading2 className="w-4 h-4" />}
          title="Heading 2"
          onClick={() => executeCommand('formatBlock', '<h2>')}
        />
        <ToolbarButton
          icon={<Heading3 className="w-4 h-4" />}
          title="Heading 3"
          onClick={() => executeCommand('formatBlock', '<h3>')}
        />

        <div className="w-px h-5 bg-stone-300 dark:bg-stone-700 mx-1" />

        <ToolbarButton
          icon={<Bold className="w-4 h-4" />}
          title="Bold (Ctrl+B)"
          onClick={() => executeCommand('bold')}
        />
        <ToolbarButton
          icon={<Italic className="w-4 h-4" />}
          title="Italic (Ctrl+I)"
          onClick={() => executeCommand('italic')}
        />

        <div className="w-px h-5 bg-stone-300 dark:bg-stone-700 mx-1" />

        <ToolbarButton
          icon={<List className="w-4 h-4" />}
          title="Bullet List"
          onClick={() => executeCommand('insertUnorderedList')}
        />
        <ToolbarButton
          icon={<ListOrdered className="w-4 h-4" />}
          title="Numbered List"
          onClick={() => executeCommand('insertOrderedList')}
        />
        <ToolbarButton
          icon={<Quote className="w-4 h-4" />}
          title="Blockquote (Scripture)"
          onClick={() => executeCommand('formatBlock', '<blockquote>')}
        />

        <div className="w-px h-5 bg-stone-300 dark:bg-stone-700 mx-1" />

        <ToolbarButton
          icon={<LinkIcon className="w-4 h-4" />}
          title="Insert Link"
          onClick={handleOpenLinkModal}
        />
        <ToolbarButton
          icon={<Unlink className="w-4 h-4" />}
          title="Remove Link"
          onClick={() => executeCommand('unlink')}
        />
        <ToolbarButton
          icon={<RemoveFormatting className="w-4 h-4" />}
          title="Clear Formatting"
          onClick={() => executeCommand('removeFormat')}
        />
      </div>

      {/* ── ContentEditable Area ───────────────────────────── */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onBlur={handleInput}
        style={{ minHeight }}
        data-placeholder={placeholder}
        className="course-prose p-4 outline-none text-stone-900 dark:text-stone-100 font-sans focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-stone-400 dark:empty:before:text-stone-500 empty:before:pointer-events-none"
      />

      {/* ── Link Modal Dialog ──────────────────────────────── */}
      {isLinkModalOpen && (
        <div className="p-3 border-t border-stone-200 dark:border-stone-800 bg-amber-50/50 dark:bg-stone-950 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="url"
            value={linkUrl}
            autoFocus
            onChange={(e) => {
              setLinkUrl(e.target.value)
              setLinkError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleApplyLink()
              } else if (e.key === 'Escape') {
                setIsLinkModalOpen(false)
              }
            }}
            placeholder="https://example.com or mailto:pastor@bbcc.org"
            className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 outline-none focus:border-amber-500"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyLink}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white transition cursor-pointer"
            >
              Add Link
            </button>
            <button
              type="button"
              onClick={() => setIsLinkModalOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 dark:hover:bg-stone-700 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {linkError && (
            <p className="w-full text-xs text-red-600 dark:text-red-400 font-medium">
              {linkError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ToolbarButton({
  icon,
  title,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => {
        // Prevent losing editor selection on button click
        e.preventDefault()
        onClick()
      }}
      className="p-1.5 rounded-md text-stone-700 dark:text-stone-300 hover:text-stone-950 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-800 active:scale-95 transition-all cursor-pointer"
    >
      {icon}
    </button>
  )
}
