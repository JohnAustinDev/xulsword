window.addEventListener('message', (e) => {
  if (e.data.type === 'iframeHeight') {
    const f = Array.from(document.getElementsByTagName('iframe')).find(
      (x) =>
        e.source === x.contentWindow &&
        !x.classList.contains('fixed-height'),
    );
    if (f)
      f.style.height = e.data.height === -1 ? '' : 10 + e.data.height + 'px';
  }
});
