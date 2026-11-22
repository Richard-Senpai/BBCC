'use client'

import React from 'react'
import { ExternalLink, CheckCircle2, Play, AlertCircle, FileCheck2 } from 'lucide-react'
import { sanitizeHtml } from '@/lib/sanitize'
import type {
  CourseBlock,
  RichTextBlockContent,
  ImageTextBlockContent,
  ImageBlockContent,
  VideoBlockContent,
  LinkBlockContent,
} from '@/lib/types'

interface LessonBlockRendererProps {
  blocks: CourseBlock[]
  /**
   * Set true when rendered in the member view (in prompt 2),
   * enabling interactive "I've done this" confirmations for required links.
   */
  isMemberView?: boolean
  confirmedBlockIds?: Set<string>
  onConfirmBlock?: (blockId: string) => Promise<void>
  isConfirmingBlockId?: string | null
}

export function LessonBlockRenderer({
  blocks,
  isMemberView = false,
  confirmedBlockIds = new Set(),
  onConfirmBlock,
  isConfirmingBlockId,
}: LessonBlockRendererProps) {
  if (!blocks || blocks.length === 0) {
    return (
      <div className="py-12 text-center text-stone-500 dark:text-stone-400">
        <p className="text-sm italic">This lesson has no content blocks yet.</p>
      </div>
    )
  }

  // Ensure blocks are displayed in sequential position order
  const sortedBlocks = [...blocks].sort((a, b) => a.position - b.position)

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {sortedBlocks.map((block) => {
        switch (block.type) {
          case 'rich_text':
            return <RichTextBlock key={block.id} content={block.content as RichTextBlockContent} />

          case 'image_text':
            return <ImageTextBlock key={block.id} content={block.content as ImageTextBlockContent} />

          case 'image':
            return <ImageBlock key={block.id} content={block.content as ImageBlockContent} />

          case 'video':
            return <VideoBlock key={block.id} content={block.content as VideoBlockContent} />

          case 'link':
            return (
              <LinkButtonBlock
                key={block.id}
                blockId={block.id}
                content={block.content as LinkBlockContent}
                required={block.required}
                isMemberView={isMemberView}
                isConfirmed={confirmedBlockIds.has(block.id)}
                onConfirm={onConfirmBlock}
                isConfirming={isConfirmingBlockId === block.id}
              />
            )

          default:
            return null
        }
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 1. RICH TEXT BLOCK
// ─────────────────────────────────────────────────────────────

function RichTextBlock({ content }: { content: RichTextBlockContent }) {
  if (!content || !content.html) return null

  const cleanHtml = sanitizeHtml(content.html)
  if (!cleanHtml.trim()) return null

  return (
    <div
      className="course-prose text-stone-800 dark:text-stone-200 leading-relaxed text-base font-sans"
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  )
}

// ─────────────────────────────────────────────────────────────
// 2. IMAGE + TEXT BLOCK
// ─────────────────────────────────────────────────────────────

function ImageTextBlock({ content }: { content: ImageTextBlockContent }) {
  if (!content) return null

  const position = content.image_position || 'left'
  const cleanHtml = content.html ? sanitizeHtml(content.html) : ''

  // Position layouts:
  // - 'left': Image on left, text on right (desktop). On mobile, stacks top.
  // - 'right': Image on right, text on left (desktop). On mobile, stacks top.
  // - 'top': Image always on top.
  let containerClasses = 'flex flex-col gap-6 items-start'
  if (position === 'left') {
    containerClasses = 'flex flex-col sm:flex-row gap-6 items-start'
  } else if (position === 'right') {
    containerClasses = 'flex flex-col sm:flex-row-reverse gap-6 items-start'
  }

  const imageWidthClasses = position === 'top' ? 'w-full' : 'w-full sm:w-1/2 sm:shrink-0'

  return (
    <div className={containerClasses}>
      {content.image_url && (
        <figure className={imageWidthClasses}>
          <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 shadow-2xs">
            <img
              src={content.image_url}
              alt={content.alt_text || 'Course lesson illustration'}
              className="w-full h-auto object-cover max-h-[500px]"
              loading="lazy"
            />
          </div>
          {content.caption && (
            <figcaption className="mt-2 text-xs text-stone-500 dark:text-stone-400 italic text-center px-1">
              {content.caption}
            </figcaption>
          )}
        </figure>
      )}

      {cleanHtml && (
        <div
          className="course-prose flex-1 text-stone-800 dark:text-stone-200 leading-relaxed text-base font-sans min-w-0"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 3. FULL-WIDTH IMAGE BLOCK
// ─────────────────────────────────────────────────────────────

function ImageBlock({ content }: { content: ImageBlockContent }) {
  if (!content || !content.image_url) return null

  return (
    <figure className="w-full my-4">
      <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-900 shadow-xs">
        <img
          src={content.image_url}
          alt={content.alt_text || 'Course lesson illustration'}
          className="w-full h-auto object-cover max-h-[700px]"
          loading="lazy"
        />
      </div>
      {content.caption && (
        <figcaption className="mt-2 text-xs text-stone-500 dark:text-stone-400 italic text-center">
          {content.caption}
        </figcaption>
      )}
    </figure>
  )
}

// ─────────────────────────────────────────────────────────────
// 4. VIDEO BLOCK (YouTube Privacy-Enhanced Embed)
// ─────────────────────────────────────────────────────────────

function VideoBlock({ content }: { content: VideoBlockContent }) {
  if (!content || !content.video_id) return null

  // Ensure video_id is strictly alphanumeric (11 characters) to prevent attribute injection
  const safeVideoId = content.video_id.replace(/[^a-zA-Z0-9_-]/g, '')
  if (safeVideoId.length !== 11) return null

  const startParam = content.start_seconds && content.start_seconds > 0 ? `?start=${content.start_seconds}` : ''
  const embedUrl = `https://www.youtube-nocookie.com/embed/${safeVideoId}${startParam}`
  const directWatchUrl = `https://www.youtube.com/watch?v=${safeVideoId}`

  return (
    <div className="w-full my-4 space-y-2">
      {content.title && (
        <h4 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
          <Play className="w-4 h-4 text-red-600 dark:text-red-500 fill-current" />
          {content.title}
        </h4>
      )}

      {/* 16:9 Responsive aspect ratio */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-md border border-stone-200 dark:border-stone-800">
        <iframe
          src={embedUrl}
          title={content.title || 'YouTube video'}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 w-full h-full border-0"
        />
      </div>

      {/* Fallback Watch on YouTube link */}
      <div className="flex justify-end pt-1">
        <a
          href={directWatchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
        >
          <span>Watch on YouTube</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// 5. LINK BUTTON BLOCK
// ─────────────────────────────────────────────────────────────

interface LinkButtonBlockProps {
  blockId: string
  content: LinkBlockContent
  required: boolean
  isMemberView: boolean
  isConfirmed: boolean
  onConfirm?: (blockId: string) => Promise<void>
  isConfirming?: boolean
}

function LinkButtonBlock({
  blockId,
  content,
  required,
  isMemberView,
  isConfirmed,
  onConfirm,
  isConfirming = false,
}: LinkButtonBlockProps) {
  if (!content || !content.url) return null

  // Ensure URL is strictly http:// or https://
  const safeUrl = content.url.trim().startsWith('http://') || content.url.trim().startsWith('https://')
    ? content.url.trim()
    : null

  if (!safeUrl) return null

  return (
    <div className="my-6 p-5 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          {required && (
            <div className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-3 h-3" />
              <span>Required before completing this lesson</span>
            </div>
          )}
          {content.description && (
            <p className="text-sm text-stone-600 dark:text-stone-400">
              {content.description}
            </p>
          )}
        </div>

        {/* External Link Button */}
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:hover:bg-white text-white dark:text-stone-900 font-medium text-sm transition shadow-2xs shrink-0 cursor-pointer"
        >
          <span>{content.label || 'Open Resource'}</span>
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Required Confirmation Check for Members */}
      {required && (
        <div className="pt-3 border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-3">
          {isMemberView ? (
            isConfirmed ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 fill-emerald-100 dark:fill-emerald-950" />
                <span>You have confirmed completion of this external task.</span>
              </div>
            ) : (
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => onConfirm && onConfirm(blockId)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-1.5 rounded-md text-xs font-semibold text-amber-900 dark:text-amber-200 bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 transition cursor-pointer disabled:opacity-50"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>{isConfirming ? 'Confirming...' : "I've done this"}</span>
              </button>
            )
          ) : (
            <div className="text-xs text-stone-500 dark:text-stone-400 italic">
              Member confirmation required: Members must open the link and tap &quot;I&apos;ve done this&quot; to finish the lesson.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
