import { GBuilder, GCallType } from '../type.ts';
import G from '../main/mgServer.ts';
import { JSON_stringify } from '../common.ts';

// Handle global variable calls from renderer processes
export default function handleGlobal(
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
    const g = G as any;
    if (typeof args === 'undefined' && gBuilder[name] === 'getter') {
      ret = g[name];
    } else if (typeof args !== 'undefined' &&
      typeof gBuilder[name] === 'function') {
      ret = g[name](...args);
    } else if (m && typeof gBuilder[name] === 'object') {
      if (typeof args === 'undefined' && gBuilder[name][m] === 'getter') {
        ret = g[name][m];
      } else if (Array.isArray(args) && typeof gBuilder[name][m] === 'function') {
        if (
          typeof args !== 'undefined' &&
          includeCallingWindow.includes(
            name as typeof includeCallingWindow[number]
          ) &&
          typeof args[g[name][m].length] === 'undefined'
        ) {
          args[g[name][m].length] = win;
        }
        ret = g[name][m](...args);
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
