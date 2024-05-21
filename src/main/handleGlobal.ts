import { GBuilder, GCallType, GITypeMain as GIMainType, GType } from '../type.ts';
import { JSON_stringify } from '../common.ts';

// Handle global variable calls from renderer processes
export default function handleGlobal(
  GX: GType | GIMainType,
  win: number,
  acall: GCallType,
  trusted = false, // internetSafe or not?
) {
  let ret = null;
  const [name, m, args] = acall;
  const { includeCallingWindow } = GBuilder;
  let allow = false;
  const is = name && GBuilder.internetSafe.find((x) => x[0] === name);
  if (trusted) allow = true;
  else if (is && !m && is[1].length === 0) allow = true;
  else if (is && (is[1] as any).includes(m)) allow = true;
  if (name && name in GBuilder && allow) {
    const gBuilder = GBuilder as any;
    const gx = GX as any;
    if (!Array.isArray(args) && gBuilder[name] === 'getter') {
      ret = gx[name];
    } else if (Array.isArray(args) && typeof gBuilder[name] === 'function') {
      ret = gx[name](...args);
    } else if (m && typeof gBuilder[name] === 'object') {
      if (!Array.isArray(args) && gBuilder[name][m] === 'getter') {
        ret = gx[name][m];
      } else if (Array.isArray(args) && typeof gBuilder[name][m] === 'function') {
        if (
          Array.isArray(args) &&
          includeCallingWindow.includes(name as any) &&
          typeof args[gx[name][m].length] === 'undefined'
        ) {
          args[gx[name][m].length] = win;
        }
        ret = gx[name][m](...args);
      } else {
        throw Error(`Unhandled global ipc method: ${JSON_stringify(acall)}`);
      }
    } else {
      throw Error(`Unhandled global ipc type ${gBuilder[name]}: ${JSON_stringify(acall)}`);
    }
  } else {
    throw Error(`Disallowed global ipc request: ${JSON_stringify(acall)}`);
  }

  return ret;
}

export type CallBatch = (calls: (GCallType | null)[]) => (any | null)[];

// All batch calls are considered anonymous-window and are untrusted.
export function callBatch(
  GX: GType | GIMainType,
  calls: Parameters<CallBatch>[0]
): ReturnType<CallBatch> {
  const resp: any[] = [];

  calls.forEach((c: (GCallType | null)) => {
    if (c === null) resp.push(null);
    else resp.push(handleGlobal(GX, -1, c, false));
  });

  return resp;
}
