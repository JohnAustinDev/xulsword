/* eslint-disable import/prefer-default-export */

export function jsdump(msg: string | Error) {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  )
    // eslint-disable-next-line no-console
    console.log(msg);
}
