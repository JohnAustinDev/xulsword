import DOMPurify from 'dompurify';

// Kept apart from common.ts so that bundles which never sanitize HTML (such as
// widgets) do not pull in dompurify.

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
