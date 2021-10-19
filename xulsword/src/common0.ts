/* eslint-disable import/prefer-default-export */

export function jsdump(msg: string | Error) {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  )
    // eslint-disable-next-line no-console
    console.log(msg);
}

export function setBodyClass(name: string) {
  const R = window.ipc.renderer;

  document.getElementsByTagName('body')[0].classList.add(name);

  if (R.sendSync('global', 'ProgramConfig', 'direction') === 'rtl') {
    document.getElementsByTagName('body')[0].classList.add('chromedir-rtl');
  }
}
