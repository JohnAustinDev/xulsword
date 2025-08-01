/* eslint-disable no-var */
window.addEventListener('message', function (e) {
  if (e.data.type === 'iframeHeight') {
    var iframes = document.getElementsByTagName('iframe');
    var foundIframe = null;

    for (var i = 0; i < iframes.length; i++) {
      var iframe = iframes[i];
      if (
        iframe.contentWindow &&
        e.source === iframe.contentWindow &&
        !iframe.classList.contains('fixed-height')
      ) {
        foundIframe = iframe;
        break;
      }
    }

    if (foundIframe) {
      if (e.data.height === -1) {
        foundIframe.style.height = '';
      } else {
        foundIframe.style.height = 10 + e.data.height + 'px';
      }
    }
  }
});
