export function jsdump(msg: string | Error) {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_PROD === 'true'
  )
    console.log(msg);
}

export function other() {
  const foo = 'bar';
}
