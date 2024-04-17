import { GBuilder, GCallType } from '../type.ts';
import G from '../main/mgServer.ts';

// Handle global variable calls from renderer processes
export default function handleGlobal(
  win: number,
  args: GCallType
) {
  let ret = null;
  const name: string = args.shift();
  const m: string | null = args.shift();
  const { includeCallingWindow } = GBuilder;
  if (name in GBuilder) {
    const gBuilder = GBuilder as any;
    const g = G as any;
    if (gBuilder[name] === 'getter') {
      ret = g[name];
    } else if (typeof gBuilder[name] === 'function') {
      ret = g[name](...args);
    } else if (m && typeof gBuilder[name] === 'object') {
      if (gBuilder[name][m] === 'getter') {
        ret = g[name][m];
      } else if (typeof gBuilder[name][m] === 'function') {
        if (
          includeCallingWindow.includes(
            name as typeof includeCallingWindow[number]
          ) &&
          typeof args[g[name][m].length] === 'undefined'
        ) {
          args[g[name][m].length] = win;
        }
        ret = g[name][m](...args);
      } else {
        throw Error(`Unhandled method type for ${name}.${m}`);
      }
    } else {
      throw Error(`Unhandled global ${name} ipc type: ${gBuilder[name]}`);
    }
  } else {
    throw Error(`Unhandled global ipc request: ${name}`);
  }

  return ret;
}
