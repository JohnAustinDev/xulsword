import DOMPurify from 'dompurify';

// Kept apart from common.ts so that bundles which never sanitize HTML (such as
// widgets) do not pull in dompurify.

// External http(s) links (such as those in module conf About text) must never
// replace xulsword's own content, which would leave no way back. So open them
// in a new browser tab or window (Electron sends these to the system browser).
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (
    node.nodeName === 'A' &&
    /^https?:\/\//i.test(node.getAttribute('href') || '')
  ) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

// This function should always be used when writing to innerHTML.
export function sanitizeHTML<T extends string | HTMLElement>(
  parentOrHtml: T,
  html?: string,
): T {
  const sanitize = (s?: string): string => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    return DOMPurify.sanitize(s || '', { USE_PROFILES: { html: true } });
  };
  if (typeof parentOrHtml === 'string') {
    return sanitize(parentOrHtml) as T;
  }
  parentOrHtml.innerHTML = sanitize(html);
  return parentOrHtml;
}
