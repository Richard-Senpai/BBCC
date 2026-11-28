'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Eye,
  Edit3,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Type,
  ImageIcon,
  Columns,
  Video,
  Link2,
  Upload,
  AlignLeft,
  AlignRight,
  ArrowUpToLine,
  ExternalLink,
} from 'lucide-react'
import {
  getLessonWithBlocks,
  saveLessonContent,
  uploadCourseMedia,
} from '@/lib/actions/admin'
import {
  compressAndResizeImage,
  extractYouTubeVideoId,
  validateButtonLinkUrl,
} from '@/lib/course-editor-utils'
import { RichTextEditor } from './RichTextEditor'
import { LessonBlockRenderer } from '@/components/courses/LessonBlockRenderer'
import type {
  CourseLesson,
  CourseBlock,
  CourseBlockType,
  RichTextBlockContent,
  ImageTextBlockContent,
  ImageBlockContent,
  VideoBlockContent,
  LinkBlockContent,
} from '@/lib/types'

interface LessonContentEditorModalProps {
  courseId: string
  lessonId: string | null
  isOpen: boolean
  onClose: () => void
  onLessonSaved?: () => void
  allLessons?: CourseLesson[]
  onSelectLesson?: (lessonId: string) => void
}

type SaveState = 'saved' | 'saving' | 'failed' | 'unsaved'

export function LessonContentEditorModal({
  courseId,
  lessonId,
  isOpen,
  onClose,
  onLessonSaved,
  allLessons = [],
  onSelectLesson,
}: LessonContentEditorModalProps) {
  const [lesson, setLesson] = useState<CourseLesson | null>(null)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [blocks, setBlocks] = useState<CourseBlock[]>([])

  const [isLoading, setIsLoading] = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null)

  // Stale-reference guards
  const currentLessonIdRef = useRef<string | null>(lessonId)
  const isDirtyRef = useRef(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const currentDataRef = useRef<{
    lessonId: string | null
    title: string
    summary: string
    blocks: CourseBlock[]
  }>({
    lessonId,
    title: '',
    summary: '',
    blocks: [],
  })

  // Keep refs synchronized
  useEffect(() => {
    currentLessonIdRef.current = lessonId
    currentDataRef.current.lessonId = lessonId
  }, [lessonId])

  useEffect(() => {
    currentDataRef.current.title = title
    currentDataRef.current.summary = summary
    currentDataRef.current.blocks = blocks
  }, [title, summary, blocks])

  // ─────────────────────────────────────────────────────────
  // AUTOSAVE & FLUSH LOGIC
  // ─────────────────────────────────────────────────────────

  const executeSave = useCallback(async () => {
    const activeLessonId = currentLessonIdRef.current
    if (!activeLessonId) return

    const { title: curTitle, summary: curSummary, blocks: curBlocks } = currentDataRef.current

    if (!curTitle || !curTitle.trim()) {
      setSaveState('failed')
      setSaveError('Lesson title cannot be empty')
      return
    }

    // Check for any link blocks with invalid schemes before saving
    for (const b of curBlocks) {
      if (b.type === 'link') {
        const raw = typeof b.content?.url === 'string' ? b.content.url.trim() : ''
        if (raw) {
          const val = validateButtonLinkUrl(raw)
          if (!val.valid) {
            setSaveState('failed')
            setSaveError(val.error || 'That link isn’t a valid web address')
            return
          }
        }
      }
    }

    setSaveState('saving')
    setSaveError(null)

    try {
      const res = await saveLessonContent({
        lessonId: activeLessonId,
        title: curTitle,
        summary: curSummary,
        blocks: curBlocks.map((b, index) => {
          const contentCopy = { ...(b.content || {}) }
          if (b.type === 'link' && typeof contentCopy.url === 'string') {
            const trimmed = contentCopy.url.trim()
            if (trimmed) {
              contentCopy.url = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
            }
          }
          return {
            id: b.id.startsWith('temp_') ? undefined : b.id,
            position: index + 1,
            type: b.type,
            content: contentCopy,
            required: Boolean(b.required),
          }
        }),
      })

      if (res.success && res.blocks) {
        setSaveState('saved')
        isDirtyRef.current = false
        // Update local blocks with assigned DB UUIDs
        setBlocks(res.blocks)
        if (onLessonSaved) onLessonSaved()
      } else {
        setSaveState('failed')
        setSaveError(res.error || 'Failed to save changes')
      }
    } catch (err) {
      setSaveState('failed')
      setSaveError(err instanceof Error ? err.message : 'Network error saving changes')
    }
  }, [onLessonSaved])

  const scheduleAutosave = useCallback(() => {
    isDirtyRef.current = true
    setSaveState('unsaved')

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(() => {
      executeSave()
    }, 1200)
  }, [executeSave])

  const flushSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }
    if (isDirtyRef.current) {
      await executeSave()
    }
  }, [executeSave])

  // Flush on tab close or navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        flushSave()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [flushSave])

  // ─────────────────────────────────────────────────────────
  // LOAD LESSON & BLOCKS
  // ─────────────────────────────────────────────────────────

  const loadLesson = useCallback(async (idToLoad: string) => {
    setIsLoading(true)
    setSaveError(null)

    try {
      const res = await getLessonWithBlocks(idToLoad)
      if (res.success && res.lesson) {
        setLesson(res.lesson)
        setTitle(res.lesson.title || '')
        setSummary(res.lesson.summary || '')
        setBlocks(res.blocks || [])
        isDirtyRef.current = false
        setSaveState('saved')
      } else {
        setSaveError(res.error || 'Failed to load lesson')
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error loading lesson')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen && lessonId) {
      loadLesson(lessonId)
    }
  }, [isOpen, lessonId, loadLesson])

  const handleClose = async () => {
    await flushSave()
    onClose()
  }

  const handleSwitchLesson = async (nextId: string) => {
    if (nextId === lessonId) return
    await flushSave()
    if (onSelectLesson) onSelectLesson(nextId)
  }

  // ─────────────────────────────────────────────────────────
  // BLOCK EDIT OPERATIONS
  // ─────────────────────────────────────────────────────────

  const handleAddBlock = (type: CourseBlockType) => {
    let initialContent: Record<string, unknown> = {}

    switch (type) {
      case 'rich_text':
        initialContent = { html: '' } as RichTextBlockContent
        break
      case 'image_text':
        initialContent = {
          image_url: '',
          storage_path: null,
          alt_text: '',
          caption: '',
          image_position: 'left',
          html: '',
        } as ImageTextBlockContent
        break
      case 'image':
        initialContent = {
          image_url: '',
          storage_path: null,
          alt_text: '',
          caption: '',
        } as ImageBlockContent
        break
      case 'video':
        initialContent = {
          video_id: '',
          original_url: '',
          title: '',
          start_seconds: null,
        } as VideoBlockContent
        break
      case 'link':
        initialContent = {
          url: '',
          label: 'Open Resource',
          description: '',
        } as LinkBlockContent
        break
    }

    const newBlock: CourseBlock = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      lesson_id: lessonId || '',
      position: blocks.length + 1,
      type,
      content: initialContent,
      required: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    setBlocks((prev) => [...prev, newBlock])
    scheduleAutosave()
  }

  const handleUpdateBlockContent = (blockId: string, partialContent: Record<string, unknown>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, content: { ...b.content, ...partialContent } } : b))
    )
    scheduleAutosave()
  }

  const handleToggleBlockRequired = (blockId: string, required: boolean) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, required } : b)))
    scheduleAutosave()
  }

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === blocks.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const nextBlocks = [...blocks]
    const temp = nextBlocks[index]
    nextBlocks[index] = nextBlocks[targetIndex]
    nextBlocks[targetIndex] = temp

    // Re-index position property
    const reindexed = nextBlocks.map((b, i) => ({ ...b, position: i + 1 }))
    setBlocks(reindexed)
    scheduleAutosave()
  }

  const handleDuplicateBlock = (block: CourseBlock) => {
    const blockIndex = blocks.findIndex((b) => b.id === block.id)
    if (blockIndex === -1) return

    const duplicated: CourseBlock = {
      ...block,
      id: `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      position: blockIndex + 2,
      content: JSON.parse(JSON.stringify(block.content)),
    }

    const nextBlocks = [...blocks]
    nextBlocks.splice(blockIndex + 1, 0, duplicated)
    const reindexed = nextBlocks.map((b, i) => ({ ...b, position: i + 1 }))
    setBlocks(reindexed)
    scheduleAutosave()
  }

  const handleDeleteBlock = (blockId: string) => {
    if (!window.confirm('Delete this content block? This action cannot be undone.')) {
      return
    }

    const nextBlocks = blocks.filter((b) => b.id !== blockId).map((b, i) => ({ ...b, position: i + 1 }))
    setBlocks(nextBlocks)
    scheduleAutosave()
  }

  // ─────────────────────────────────────────────────────────
  // IMAGE UPLOADER HANDLER
  // ─────────────────────────────────────────────────────────

  const handleImageFileSelected = async (blockId: string, file: File) => {
    setUploadingBlockId(blockId)
    setSaveError(null)

    try {
      // 1. Client-side compress and resize (max 1600px wide, quality 0.85)
      const { blob, fileName } = await compressAndResizeImage(file)

      // 2. Upload via Server Action
      const formData = new FormData()
      formData.append('file', blob, fileName)
      formData.append('courseId', courseId)

      const res = await uploadCourseMedia(formData)

      if (res.success && res.url) {
        handleUpdateBlockContent(blockId, {
          image_url: res.url,
          storage_path: res.storagePath,
        })
      } else {
        alert(res.error || 'Failed to upload image. Please check bucket permissions.')
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error processing image')
    } finally {
      setUploadingBlockId(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-stone-950/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-none sm:rounded-2xl w-full max-w-4xl h-full sm:h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ── Top Header Bar ───────────────────────────────── */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {lesson && (
              <span className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 shrink-0">
                Lesson {lesson.position}
              </span>
            )}

            {/* Lesson switcher dropdown if other lessons exist */}
            {allLessons.length > 1 && (
              <select
                value={lessonId || ''}
                onChange={(e) => handleSwitchLesson(e.target.value)}
                className="text-xs font-semibold bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-lg px-2.5 py-1 outline-none cursor-pointer"
              >
                {allLessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    Lesson {l.position}: {l.title}
                  </option>
                ))}
              </select>
            )}

            {/* Autosave Status Pill */}
            <div className="flex items-center gap-1.5 text-xs font-medium">
              {saveState === 'saving' && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving…</span>
                </span>
              )}
              {saveState === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Saved</span>
                </span>
              )}
              {saveState === 'failed' && (
                <div className="flex items-center gap-1 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-md border border-red-200 dark:border-red-900/50">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-medium truncate max-w-[120px] sm:max-w-[280px]" title={saveError || 'Save failed'}>
                    {saveError || 'Save failed'}
                  </span>
                  <button
                    type="button"
                    onClick={executeSave}
                    className="font-bold underline hover:opacity-85 cursor-pointer ml-1 text-red-700 dark:text-red-300 shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}
              {saveState === 'unsaved' && (
                <span className="text-stone-400 dark:text-stone-500">Unsaved changes</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Preview Toggle */}
            <div className="inline-flex rounded-lg border border-stone-300 dark:border-stone-700 p-0.5 bg-stone-100 dark:bg-stone-800">
              <button
                type="button"
                onClick={() => setPreviewMode(false)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                  !previewMode
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Editor</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode(true)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                  previewMode
                    ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-2xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200 dark:hover:bg-stone-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Main Scrollable Body ─────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-400">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-600 dark:text-amber-500" />
              <p className="text-sm font-medium">Loading lesson content from database…</p>
            </div>
          ) : previewMode ? (
            /* ── PREVIEW MODE ─────────────────────────────── */
            <div className="space-y-6">
              <div className="border-b border-stone-200 dark:border-stone-800 pb-5 max-w-3xl mx-auto">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  Lesson {lesson?.position} Preview
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 mt-1">
                  {title || 'Untitled Lesson'}
                </h1>
                {summary && (
                  <p className="text-base text-stone-600 dark:text-stone-400 mt-2 font-normal leading-relaxed">
                    {summary}
                  </p>
                )}
              </div>

              <LessonBlockRenderer blocks={blocks} isMemberView={false} />
            </div>
          ) : (
            /* ── EDITOR MODE ──────────────────────────────── */
            <div className="max-w-3xl mx-auto space-y-8">
              {/* Error banner if save failed */}
              {saveError && (
                <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{saveError}</span>
                  </div>
                  <button
                    type="button"
                    onClick={executeSave}
                    className="font-bold underline cursor-pointer shrink-0"
                  >
                    Retry Save
                  </button>
                </div>
              )}

              {/* Lesson Metadata: Title & Summary */}
              <div className="p-5 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 space-y-4 shadow-2xs">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
                    Lesson Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value)
                      scheduleAutosave()
                    }}
                    placeholder="e.g. Foundation of Covenant Consecration"
                    className="bbcc-input font-semibold text-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
                    Lesson Summary / Overview (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={summary}
                    onChange={(e) => {
                      setSummary(e.target.value)
                      scheduleAutosave()
                    }}
                    placeholder="A brief 1-2 sentence description shown in the course outline..."
                    className="bbcc-input text-sm resize-none"
                  />
                </div>
              </div>

              {/* ── Ordered List of Content Blocks ───────────── */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-stone-700 dark:text-stone-300">
                    Content Blocks ({blocks.length})
                  </h3>
                  <span className="text-xs text-stone-400 dark:text-stone-500">
                    Autosaves automatically
                  </span>
                </div>

                {blocks.length === 0 ? (
                  <div className="py-12 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-2xl text-center space-y-3">
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      No content blocks yet. Add your first block below to begin.
                    </p>
                  </div>
                ) : (
                  blocks.map((block, index) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      index={index}
                      totalBlocks={blocks.length}
                      onUpdateContent={(content) => handleUpdateBlockContent(block.id, content)}
                      onToggleRequired={(req) => handleToggleBlockRequired(block.id, req)}
                      onMove={(dir) => handleMoveBlock(index, dir)}
                      onDuplicate={() => handleDuplicateBlock(block)}
                      onDelete={() => handleDeleteBlock(block.id)}
                      onUploadImage={(file) => handleImageFileSelected(block.id, file)}
                      isUploading={uploadingBlockId === block.id}
                    />
                  ))
                )}

                {/* ── Add Block Selector ────────────────────── */}
                <div className="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/70 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                    + Add New Content Block
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <AddBlockButton
                      icon={<Type className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                      label="Rich Text"
                      onClick={() => handleAddBlock('rich_text')}
                    />
                    <AddBlockButton
                      icon={<Columns className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                      label="Image + Text"
                      onClick={() => handleAddBlock('image_text')}
                    />
                    <AddBlockButton
                      icon={<ImageIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                      label="Full Image"
                      onClick={() => handleAddBlock('image')}
                    />
                    <AddBlockButton
                      icon={<Video className="w-4 h-4 text-red-600 dark:text-red-500" />}
                      label="YouTube"
                      onClick={() => handleAddBlock('video')}
                    />
                    <AddBlockButton
                      icon={<Link2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                      label="Link Button"
                      onClick={() => handleAddBlock('link')}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950 flex items-center justify-between shrink-0">
          <div className="text-xs text-stone-500 dark:text-stone-400">
            {blocks.length} {blocks.length === 1 ? 'block' : 'blocks'} in this lesson
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="px-5 py-2 text-xs font-semibold rounded-xl bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 transition shadow-xs cursor-pointer"
          >
            Done Editing
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SUBCOMPONENT: BLOCK CARD
// ─────────────────────────────────────────────────────────────

interface BlockCardProps {
  block: CourseBlock
  index: number
  totalBlocks: number
  onUpdateContent: (content: Record<string, unknown>) => void
  onToggleRequired: (required: boolean) => void
  onMove: (direction: 'up' | 'down') => void
  onDuplicate: () => void
  onDelete: () => void
  onUploadImage: (file: File) => void
  isUploading: boolean
}

function BlockCard({
  block,
  index,
  totalBlocks,
  onUpdateContent,
  onToggleRequired,
  onMove,
  onDuplicate,
  onDelete,
  onUploadImage,
  isUploading,
}: BlockCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const blockTypeNames: Record<CourseBlockType, string> = {
    rich_text: 'Rich Text',
    image_text: 'Image + Text',
    image: 'Full Width Image',
    video: 'YouTube Video',
    link: 'Link Button',
  }

  return (
    <div className="border border-stone-200 dark:border-stone-800 rounded-2xl bg-white dark:bg-stone-900 shadow-2xs overflow-hidden transition-all hover:border-stone-300 dark:hover:border-stone-700">
      {/* ── Card Header with Reorder & Actions ─────────────── */}
      <div className="px-4 py-2.5 bg-stone-50 dark:bg-stone-950/60 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2 select-none">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
            {blockTypeNames[block.type]}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          {/* Mobile-Friendly Up / Down Buttons */}
          <button
            type="button"
            title="Move Up"
            disabled={index === 0}
            onClick={() => onMove('up')}
            className="p-1.5 rounded-md text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            title="Move Down"
            disabled={index === totalBlocks - 1}
            onClick={() => onMove('down')}
            className="p-1.5 rounded-md text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-800 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 bg-stone-200 dark:border-stone-800 mx-1" />

          {/* Duplicate Block */}
          <button
            type="button"
            title="Duplicate Block"
            onClick={onDuplicate}
            className="p-1.5 rounded-md text-stone-600 dark:text-stone-400 hover:text-stone-950 dark:hover:text-white hover:bg-stone-200 dark:hover:bg-stone-800 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {/* Delete Block */}
          <button
            type="button"
            title="Delete Block"
            onClick={onDelete}
            className="p-1.5 rounded-md text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Block Body Content ─────────────────────────────── */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* 1. Rich Text Block */}
        {block.type === 'rich_text' && (
          <RichTextEditor
            value={(block.content as RichTextBlockContent)?.html || ''}
            onChange={(html) => onUpdateContent({ html })}
            placeholder="Write your lesson text, scriptures, or lists here..."
          />
        )}

        {/* 2. Image + Text Block */}
        {block.type === 'image_text' && (
          <div className="space-y-4">
            {/* Position Picker & Upload Button */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 text-xs">
                <span className="font-semibold text-stone-600 dark:text-stone-400 mr-1">
                  Image Position:
                </span>
                {(['left', 'right', 'top'] as const).map((pos) => {
                  const currentPos = (block.content as ImageTextBlockContent)?.image_position || 'left'
                  const isSelected = currentPos === pos
                  return (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => onUpdateContent({ image_position: pos })}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold capitalize flex items-center gap-1 transition cursor-pointer ${
                        isSelected
                          ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-transparent hover:bg-stone-200'
                      }`}
                    >
                      {pos === 'left' && <AlignLeft className="w-3 h-3" />}
                      {pos === 'right' && <AlignRight className="w-3 h-3" />}
                      {pos === 'top' && <ArrowUpToLine className="w-3 h-3" />}
                      <span>{pos}</span>
                    </button>
                  )
                })}
              </div>

              {/* Upload Action */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onUploadImage(f)
                  }}
                />
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {isUploading
                      ? 'Compressing & Uploading…'
                      : (block.content as ImageTextBlockContent)?.image_url
                      ? 'Replace Image'
                      : 'Upload Image (Max 5MB)'}
                  </span>
                </button>
              </div>
            </div>

            {/* Image Preview & Caption fields */}
            {(block.content as ImageTextBlockContent)?.image_url && (
              <div className="p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-950/40 flex flex-col sm:flex-row gap-4 items-center">
                <img
                  src={(block.content as ImageTextBlockContent).image_url}
                  alt={(block.content as ImageTextBlockContent).alt_text || 'Uploaded image'}
                  className="w-24 h-24 object-cover rounded-lg border border-stone-200 dark:border-stone-800 shrink-0"
                />
                <div className="flex-1 w-full space-y-2">
                  <input
                    type="text"
                    value={(block.content as ImageTextBlockContent).alt_text || ''}
                    onChange={(e) => onUpdateContent({ alt_text: e.target.value })}
                    placeholder="Image alt text (accessibility description)..."
                    className="bbcc-input text-xs"
                  />
                  <input
                    type="text"
                    value={(block.content as ImageTextBlockContent).caption || ''}
                    onChange={(e) => onUpdateContent({ caption: e.target.value })}
                    placeholder="Optional image caption..."
                    className="bbcc-input text-xs"
                  />
                </div>
              </div>
            )}

            {/* Rich text beside / below image */}
            <RichTextEditor
              value={(block.content as ImageTextBlockContent)?.html || ''}
              onChange={(html) => onUpdateContent({ html })}
              placeholder="Write text to display beside the image..."
            />
          </div>
        )}

        {/* 3. Full-Width Image Block */}
        {block.type === 'image' && (
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) onUploadImage(f)
              }}
            />

            {(block.content as ImageBlockContent)?.image_url ? (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-950">
                  <img
                    src={(block.content as ImageBlockContent).image_url}
                    alt={(block.content as ImageBlockContent).alt_text || 'Full image'}
                    className="w-full max-h-[400px] object-cover"
                  />
                  <button
                    type="button"
                    disabled={isUploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-stone-900/80 hover:bg-stone-900 text-white text-xs font-semibold backdrop-blur-xs transition cursor-pointer"
                  >
                    {isUploading ? 'Uploading…' : 'Replace Image'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={(block.content as ImageBlockContent).alt_text || ''}
                    onChange={(e) => onUpdateContent({ alt_text: e.target.value })}
                    placeholder="Image alt text (accessibility description)..."
                    className="bbcc-input text-xs"
                  />
                  <input
                    type="text"
                    value={(block.content as ImageBlockContent).caption || ''}
                    onChange={(e) => onUpdateContent({ caption: e.target.value })}
                    placeholder="Optional image caption..."
                    className="bbcc-input text-xs"
                  />
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="py-12 border-2 border-dashed border-stone-300 dark:border-stone-700 hover:border-amber-500 dark:hover:border-amber-400 rounded-xl text-center space-y-2 cursor-pointer transition bg-stone-50 dark:bg-stone-950/30"
              >
                <Upload className="w-6 h-6 mx-auto text-stone-400 dark:text-stone-500" />
                <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                  {isUploading ? 'Compressing and uploading image…' : 'Tap to upload a full-width image (Max 5MB)'}
                </p>
                <p className="text-[11px] text-stone-400">
                  Automatically resized to 1600px max width and compressed to WebP
                </p>
              </div>
            )}
          </div>
        )}

        {/* 4. YouTube Video Block */}
        {block.type === 'video' && (
          <VideoBlockEditor
            content={block.content as VideoBlockContent}
            onUpdate={onUpdateContent}
          />
        )}

        {/* 5. Link Button Block */}
        {block.type === 'link' && (
          <LinkBlockEditor
            content={block.content as LinkBlockContent}
            required={Boolean(block.required)}
            onUpdate={onUpdateContent}
            onToggleRequired={onToggleRequired}
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SUBCOMPONENT: VIDEO BLOCK EDITOR
// ─────────────────────────────────────────────────────────────

function VideoBlockEditor({
  content,
  onUpdate,
}: {
  content: VideoBlockContent
  onUpdate: (c: Record<string, unknown>) => void
}) {
  const [urlInput, setUrlInput] = useState(content.original_url || '')
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleUrlChange = (value: string) => {
    setUrlInput(value)

    if (!value.trim()) {
      setValidationError(null)
      onUpdate({
        video_id: '',
        original_url: '',
      })
      return
    }

    const res = extractYouTubeVideoId(value)
    if (res.videoId) {
      setValidationError(null)
      onUpdate({
        video_id: res.videoId,
        original_url: value.trim(),
        start_seconds: res.startSeconds ?? content.start_seconds ?? null,
      })
    } else {
      setValidationError(res.error || 'Please enter a valid YouTube link.')
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
          Paste YouTube Link <span className="text-red-500">*</span>
        </label>
        <input
          type="url"
          value={urlInput}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
          className={`bbcc-input text-xs ${
            validationError ? 'border-red-500 focus:border-red-500' : ''
          }`}
        />
        {validationError && (
          <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{validationError}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
            Video Title (Optional)
          </label>
          <input
            type="text"
            value={content.title || ''}
            onChange={(e) => onUpdate({ title: e.target.value })}
            placeholder="e.g. Day 1 Teaching: The Nature of Devotion"
            className="bbcc-input text-xs"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
            Start Time in Seconds (Optional)
          </label>
          <input
            type="number"
            min={0}
            value={content.start_seconds ?? ''}
            onChange={(e) => {
              const val = e.target.value ? parseInt(e.target.value, 10) : null
              onUpdate({ start_seconds: val })
            }}
            placeholder="e.g. 45 (starts video at 0:45)"
            className="bbcc-input text-xs"
          />
        </div>
      </div>

      {/* Live Inline Preview if valid */}
      {content.video_id && (
        <div className="pt-2">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block mb-2">
            Embedded Preview (YouTube Privacy-Enhanced)
          </span>
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-md border border-stone-200 dark:border-stone-800">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(content.video_id)}${
                content.start_seconds ? `?start=${content.start_seconds}` : ''
              }`}
              title={content.title || 'YouTube video preview'}
              loading="lazy"
              allowFullScreen
              className="absolute inset-0 w-full h-full border-0"
            />
          </div>
          <div className="flex justify-end pt-1">
            <a
              href={`https://www.youtube.com/watch?v=${encodeURIComponent(content.video_id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
            >
              <span>Watch on YouTube</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SUBCOMPONENT: LINK BUTTON BLOCK EDITOR
// ─────────────────────────────────────────────────────────────

function LinkBlockEditor({
  content,
  required,
  onUpdate,
  onToggleRequired,
}: {
  content: LinkBlockContent
  required: boolean
  onUpdate: (c: Record<string, unknown>) => void
  onToggleRequired: (req: boolean) => void
}) {
  const [urlError, setUrlError] = useState<string | null>(null)

  const handleUrlBlur = () => {
    const raw = (content.url || '').trim()
    if (!raw) {
      setUrlError('URL is required')
      return
    }
    const val = validateButtonLinkUrl(raw)
    if (!val.valid) {
      setUrlError(val.error || 'That link isn’t a valid web address.')
    } else {
      setUrlError(null)
      if (val.normalizedUrl && val.normalizedUrl !== content.url) {
        onUpdate({ url: val.normalizedUrl })
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
            Button Label <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={content.label || ''}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="e.g. Take the Module 1 Assessment"
            className="bbcc-input text-xs font-semibold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
            Destination URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            value={content.url || ''}
            onChange={(e) => {
              onUpdate({ url: e.target.value })
              setUrlError(null)
            }}
            onBlur={handleUrlBlur}
            placeholder="https://forms.google.com/..."
            className={`bbcc-input text-xs ${urlError ? 'border-red-500' : ''}`}
          />
          {urlError && <p className="mt-1 text-xs text-red-600 font-medium">{urlError}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-1">
          Short Description (Optional)
        </label>
        <input
          type="text"
          value={content.description || ''}
          onChange={(e) => onUpdate({ description: e.target.value })}
          placeholder="Briefly explain what members will do when opening this link..."
          className="bbcc-input text-xs"
        />
      </div>

      {/* Required Checkbox with Honest Labelling */}
      <div className="pt-2 border-t border-stone-200 dark:border-stone-800">
        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => onToggleRequired(e.target.checked)}
            className="mt-0.5 rounded border-stone-300 dark:border-stone-700 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
          />
          <div className="text-xs">
            <span className="font-bold text-stone-900 dark:text-stone-100 block">
              Required before completing this lesson
            </span>
            <span className="text-stone-500 dark:text-stone-400 block mt-0.5">
              Member must confirm they&apos;ve done this by tapping &quot;I&apos;ve done this&quot; (not verified by the app).
            </span>
          </div>
        </label>
      </div>
    </div>
  )
}

function AddBlockButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-amber-500 dark:hover:border-amber-400 hover:shadow-2xs active:scale-95 transition cursor-pointer text-stone-800 dark:text-stone-200"
    >
      {icon}
      <span className="text-xs font-semibold text-center">{label}</span>
    </button>
  )
}
