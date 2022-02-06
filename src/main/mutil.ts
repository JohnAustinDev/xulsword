/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint import/prefer-default-export: off, import/no-mutable-exports: off */

export function jsdump(msg: string | Error) {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  )
    // eslint-disable-next-line no-console
    console.log(msg);
}
