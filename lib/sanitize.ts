/**
 * BBCC Sanitize Utility
 *
 * Provides strict allowlist-based HTML sanitization for rich text content.
 * Designed to execute cleanly in both Browser (client-side render) and Node.js (server-side save).
 *
 * Rules:
 * - Allowlisted tags only: p, h2, h3, strong, b, em, i, u, s, strike, ul, ol, li, blockquote, a, br, hr, span
 * - Dangerous tags (script, style, iframe, object, embed, etc.) are stripped completely along with their content
 * - All 'on*' event handlers (onclick, onerror, onload, etc.) are removed
 * - All inline 'style' and dangerous attributes are removed
 * - Links ('a' tag) must have href starting with 'http://', 'https://', or 'mailto:'
 * - Links automatically receive target="_blank" and rel="noopener noreferrer"
 */

const ALLOWED_TAGS = new Set([
  'p',
  'h2',
  'h3',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'strike',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'br',
  'hr',
  'span',
])

const DANGEROUS_TAGS_REGEX = /<(script|style|iframe|object|embed|applet|form|input|button|svg|math|base|link|meta)[\s\S]*?<\/\1>/gi
const DANGEROUS_SELF_CLOSING_REGEX = /<(script|style|iframe|object|embed|applet|form|input|button|svg|math|base|link|meta)[\s\S]*?>/gi

/**
 * Validates and cleans link URL.
 * Only http://, https://, and mailto: are permitted.
 * Rejects javascript:, data:, vbscript:, and invalid schemes.
 */
export function sanitizeLinkUrl(url: string): string | null {
  if (!url) return null
  const trimmed = url.trim()

  // Disallow javascript:, data:, vbscript: or encoded variants
  const lower = trimmed.toLowerCase()
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return null
  }

  // Must match http://, https://, or mailto:
  if (/^(https?:\/\/|mailto:)/i.test(trimmed)) {
    return trimmed
  }

  return null
}

/**
 * Sanitizes an HTML string on the client using browser DOM implementation.
 */
function sanitizeInBrowser(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return ''

  const parser = new DOMParser()
  const doc = parser.parseFromString(dirtyHtml, 'text/html')

  function cleanNode(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tagName = el.tagName.toLowerCase()

      // 1. If not allowed, replace with text content or unwrap
      if (!ALLOWED_TAGS.has(tagName)) {
        // Disallowed tag: remove completely if dangerous, else unwrap
        if (
          ['script', 'style', 'iframe', 'object', 'embed', 'form', 'svg', 'math'].includes(
            tagName
          )
        ) {
          el.remove()
          return
        }

        const parent = el.parentNode
        if (parent) {
          while (el.firstChild) {
            parent.insertBefore(el.firstChild, el)
          }
          el.remove()
        }
        return
      }

      // 2. Strip disallowed attributes
      const attrs = Array.from(el.attributes)
      for (const attr of attrs) {
        const attrName = attr.name.toLowerCase()

        if (tagName === 'a') {
          if (attrName === 'href') {
            const cleanUrl = sanitizeLinkUrl(attr.value)
            if (cleanUrl) {
              el.setAttribute('href', cleanUrl)
              el.setAttribute('target', '_blank')
              el.setAttribute('rel', 'noopener noreferrer')
            } else {
              el.removeAttribute('href')
            }
          } else if (attrName !== 'target' && attrName !== 'rel') {
            el.removeAttribute(attr.name)
          }
        } else {
          // Remove all attributes on other tags
          el.removeAttribute(attr.name)
        }
      }

      // Clean all child nodes recursively
      Array.from(el.childNodes).forEach(cleanNode)
    }
  }

  Array.from(doc.body.childNodes).forEach(cleanNode)
  return doc.body.innerHTML
}

/**
 * Sanitizes an HTML string in Node.js (SSR / Server Actions).
 * Uses robust regex token parsing without external binary dependencies.
 */
function sanitizeInNode(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return ''

  // 1. Strip dangerous tags with their contents
  let html = dirtyHtml
    .replace(DANGEROUS_TAGS_REGEX, '')
    .replace(DANGEROUS_SELF_CLOSING_REGEX, '')

  // 2. Process all remaining HTML tags
  html = html.replace(/<\/?([a-zA-Z0-9]+)(\s+[^>]*)?>/gi, (match, rawTag, rawAttrs) => {
    const tag = rawTag.toLowerCase()
    const isClosing = match.startsWith('</')

    if (!ALLOWED_TAGS.has(tag)) {
      return '' // Strip tag
    }

    if (isClosing) {
      return `</${tag}>`
    }

    // For self-closing tags (br, hr)
    if (tag === 'br' || tag === 'hr') {
      return `<${tag} />`
    }

    // For <a> tags, extract and sanitize href
    if (tag === 'a') {
      const hrefMatch = (rawAttrs || '').match(/href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i)
      const rawUrl = hrefMatch ? hrefMatch[1] || hrefMatch[2] || hrefMatch[3] : null
      const cleanUrl = rawUrl ? sanitizeLinkUrl(rawUrl) : null

      if (cleanUrl) {
        return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">`
      } else {
        return `<a>`
      }
    }

    // All other allowed tags: return clean tag with no attributes
    return `<${tag}>`
  })

  return html
}

/**
 * Universal HTML Sanitizer
 * Executes browser DOM sanitization on client, regex token parser on server.
 */
export function sanitizeHtml(dirtyHtml: string): string {
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    return sanitizeInBrowser(dirtyHtml)
  }
  return sanitizeInNode(dirtyHtml)
}
