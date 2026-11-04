// Click-zoom for libsword images, which are rendered as:
// <div class="image-viewport"><div class="scroll-container"><img></div></div>
// Used by both text panels and popups.

// On pointerenter, show a zoom-in cursor if the image is shrunk to fit.
export function imageZoomCursor(viewport: HTMLElement) {
  const img = viewport.getElementsByTagName('img')[0] as
    HTMLImageElement | undefined;
  if (
    img &&
    !img.style.cursor &&
    img.width < img.naturalWidth &&
    window.getComputedStyle(img, null).cursor !== 'not-allowed'
  ) {
    img.style.cursor = 'zoom-in';
  }
}

// On pointerdown, toggle the image between its fit and natural size.
export function imageZoomToggle(viewport: HTMLElement, ep: PointerEvent) {
  // When pointerType isn't mouse it usually means that pinch zoom is
  // available, so let that be used instead of click-zoom.
  if (ep.pointerType !== 'mouse') return;
  // When an image-viewport is clicked, the viewport's current width and height
  // will become fixed and it will be made the relative ancestor of the scroll-
  // container, which will become absolutely positioned. The image is resized
  // to its natural width and height and the scroll-container top and left are
  // set to (Xn, Yn) such that the image pixel that was under the cursor when
  // it was clicked will remain under the cursor after the image is resized to
  // its natural size. If clicked again, the image and viewport are returned
  // to their CSS determined size and position.
  // Xn = X - Xi(Wn/Wi)
  // WHERE:
  // Xn = CSS left value of the image container with respect to viewport
  // X = X coordinate of the cursor within the viewport
  // Xi = X coordinate of the cursor within the fit image (which may be
  //   narrower than the viewport if its height is limited)
  // Wn = Width of the natural image
  // Wi = Width of the fit image
  // (and likewise for Yn)
  const scrollcn = viewport.firstChild as HTMLDivElement;
  const img = scrollcn?.firstChild as HTMLImageElement | undefined;
  let expandShrink: boolean | undefined;
  if (img && ['zoom-in', 'zoom-out'].includes(img.style.cursor)) {
    const vbox = viewport.getBoundingClientRect();
    const ibox = img.getBoundingClientRect();
    const scrollcnS = window.getComputedStyle(scrollcn, null);
    if (scrollcnS.position === 'absolute') {
      expandShrink = img.style.width !== `${img.naturalWidth}px`;
    } else if (img.width < img.naturalWidth) {
      expandShrink = true;
      const viewportS = window.getComputedStyle(viewport, null);
      const vph = viewportS.height;
      const vpw = viewportS.width;
      viewport.style.height = vph;
      viewport.style.width = vpw;
      viewport.style.position = 'relative';
      viewport.style.overflow = 'visible';
      scrollcn.style.position = 'absolute';
    }
    if (expandShrink !== undefined) {
      if (expandShrink) {
        const scale = img.naturalWidth / ibox.width;
        const top = ep.clientY - vbox.top - (ep.clientY - ibox.top) * scale;
        const left = ep.clientX - vbox.left - (ep.clientX - ibox.left) * scale;
        scrollcn.style.top = `${top}px`;
        scrollcn.style.left = `${left}px`;
        img.style.width = `${img.naturalWidth}px`;
        img.style.maxWidth = 'unset';
        img.style.maxHeight = 'unset';
        img.style.cursor = 'zoom-out';
      } else {
        viewport.style.height = '';
        viewport.style.width = '';
        viewport.style.position = '';
        viewport.style.overflow = '';
        scrollcn.style.position = '';
        scrollcn.style.top = '';
        scrollcn.style.left = '';
        img.style.width = '';
        img.style.maxWidth = '';
        img.style.maxHeight = '';
        img.style.cursor = 'zoom-in';
      }
    } else img.style.cursor = '';
  }
}
