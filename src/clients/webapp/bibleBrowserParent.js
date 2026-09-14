/* eslint-disable no-var */
function getIframeHeightMode(iframe) {
  return iframe.classList.contains('fixed-height')
    ? 'fixed-height'
    : 'auto-height';
}

function sendIframeHeightMode(iframe) {
  if (iframe.contentWindow) {
    iframe.contentWindow.postMessage(
      { type: 'iframeHeightMode', mode: getIframeHeightMode(iframe) },
      '*',
    );
  }
}

function findSourceIframe(source) {
  var iframes = document.getElementsByTagName('iframe');
  for (var i = 0; i < iframes.length; i++) {
    if (iframes[i].contentWindow && source === iframes[i].contentWindow) {
      return iframes[i];
    }
  }
  return null;
}

window.addEventListener('message', function (e) {
  if (!e.data) return;
  var iframe;
  if (e.data.type === 'iframeHeight') {
    iframe = findSourceIframe(e.source);
    if (iframe && !iframe.classList.contains('fixed-height')) {
      if (e.data.height === -1) {
        iframe.style.height = '';
      } else {
        iframe.style.height = 10 + e.data.height + 'px';
      }
    }
  } else if (e.data.type === 'iframeHeightModeRequest') {
    iframe = findSourceIframe(e.source);
    if (iframe) sendIframeHeightMode(iframe);
  }
});

// Tell each iframe which height mode to use. The message is sent now, and again
// whenever an iframe (re)loads, since the iframe may not be listening yet. An
// iframe may also request its mode with an 'iframeHeightModeRequest' message.
(function () {
  function init(iframe) {
    if (iframe.dataset.xsHeightMode) return;
    iframe.dataset.xsHeightMode = 'true';
    iframe.addEventListener('load', function () {
      sendIframeHeightMode(iframe);
    });
    sendIframeHeightMode(iframe);
  }
  function initAll() {
    var iframes = document.getElementsByTagName('iframe');
    for (var i = 0; i < iframes.length; i++) init(iframes[i]);
  }
  initAll();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  }
})();
