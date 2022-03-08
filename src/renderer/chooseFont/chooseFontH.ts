/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import C from '../../constant';
import { deepClone, ofClass } from '../../common';
import G from '../rg';

import type { ConfigType } from '../../type';
import type { StyleType } from '../style';
import type ChooseFontWin from './chooseFont';
import type { ChooseFontWinState, ColorType } from './chooseFont';

export const startingState = {
  module: '' as string | null, // will be initialized by windowArgument()
  fonts: [], // will be initialized by getSystemFonts() Promise
  style: G.Prefs.getComplexValue('style') as StyleType,

  coloropen: false as boolean,
  backgroundopen: false as boolean,

  makeDefault: null as StyleType | null,
  restoreDefault: null as StyleType | null,
  restoreAllDefaults: null as StyleType | null,

  // Empty is a valid value for each selector insuring the user sees
  // actual user preference style settings (which may be empty).
  fontFamily: '' as string,
  fontSize: '' as string,
  lineHeight: '' as string,
  color: null as ColorType | null,
  background: null as ColorType | null,
};

// Return new CSS state corresponding to a module's style.
export function extractModuleStyleState(
  module: string,
  style: Partial<StyleType>
): Partial<ChooseFontWinState> {
  const s: Partial<ChooseFontWinState> = { module };
  if (module && style) {
    Object.entries(C.ConfigTemplate).forEach((entry) => {
      const skey = entry[0] as keyof ChooseFontWinState;
      const ckey = entry[0] as keyof ConfigType;
      if (entry[1].CSS) {
        const config = style.module && style.module[module];
        const v = (config && ckey in config ? config[ckey] : null) as
          | string
          | null;
        if (v) {
          const match = v.match(/^rgba\((\d+), (\d+), (\d+), (\d+)\)/);
          if (match) {
            const color: ColorType = {
              r: Number(match[1]),
              g: Number(match[2]),
              b: Number(match[3]),
              a: Number(match[4]),
            };
            s[skey] = color as any;
          } else s[skey] = v as any;
        } else {
          s[skey] = startingState[skey] as any;
        }
      }
    });
  }
  return s;
}

// Set or clear the CSS config props/values of a clone of the StyleType
// module object of the passed state. Then return the modified clone. If
// restoreAllDefaults is checked, then all module StyleType configs
// (including 'default') will be cleared.
export function getStyleFromState(state: ChooseFontWinState) {
  const { restoreDefault, makeDefault, restoreAllDefaults, module, style } =
    state;
  const newstyle = style ? deepClone(style) : {};
  function updateModuleStyle(modname: string | 'default', unset = false) {
    if (!('module' in newstyle) || !newstyle.module) newstyle.module = {};
    if (!(modname in newstyle.module) || !newstyle.module[modname])
      newstyle.module[modname] = {};
    Object.entries(C.ConfigTemplate).forEach((entry) => {
      const skey = entry[0] as keyof ChooseFontWinState;
      const ckey = entry[0] as keyof ConfigType;
      if (entry[1].CSS) {
        const config = newstyle.module && newstyle.module[modname];
        if (typeof config === 'object') {
          if (unset) {
            if (ckey in config) config[ckey] = startingState[skey];
          } else {
            let v = (state[skey] || null) as any;
            if (v && typeof v === 'object' && 'r' in v)
              v = `rgba(${v.r}, ${v.g}, ${v.b}, ${v.a})`;
            config[ckey] = v;
          }
        }
      }
    });
  }
  if (restoreAllDefaults) {
    // TODO! ARE YOU SURE DIALOG
    Object.keys(newstyle.module).forEach((m) => {
      updateModuleStyle(m, true);
    });
  } else if (makeDefault) {
    updateModuleStyle('default');
  } else if (module && restoreDefault) {
    updateModuleStyle(module, true);
  } else if (module) {
    updateModuleStyle(module);
  }
  return newstyle;
}

export default function handler(this: ChooseFontWin, e: React.SyntheticEvent) {
  const state = this.state as ChooseFontWinState;
  const target = e.target as HTMLElement;
  const currentTarget = e.currentTarget as HTMLElement;
  switch (e.type) {
    case 'click': {
      switch (currentTarget.id) {
        case 'cancel': {
          window.ipc.renderer.send('window', 'close');
          break;
        }
        case 'ok': {
          G.Prefs.setComplexValue('style', getStyleFromState(state));
          window.ipc.renderer.send('window', 'close');
          break;
        }
        case 'background':
        case 'color': {
          const key = `${currentTarget.id}open` as keyof ChooseFontWinState;
          const menu = ofClass(['menu'], target);
          if (!menu) {
            this.setState((prevState: ChooseFontWinState) => {
              const newState = deepClone(prevState);
              newState[key] = !newState[key];
              const s: Partial<ChooseFontWinState> = {
                [key]: newState[key],
                style: getStyleFromState(newState),
              };
              return s;
            });
          }
          break;
        }
        default:
          throw Error(
            `Unhandled chooseFontH click on id '${currentTarget.id}'`
          );
      }
      break;
    }
    case 'change': {
      const targid = currentTarget.id as keyof ChooseFontWinState;
      switch (targid) {
        case 'restoreDefault':
        case 'makeDefault':
        case 'restoreAllDefaults': {
          this.setState((prevState: ChooseFontWinState) => {
            const newState = deepClone(prevState) as ChooseFontWinState;
            let newStyle;
            if (!newState[targid]) {
              newState[targid] = newState.style;
              newStyle = getStyleFromState(newState);
            } else {
              newStyle = newState[targid];
              newState[targid] = null;
            }
            const s: Partial<ChooseFontWinState> = {
              [targid]: newState[targid],
              style: newStyle,
              ...extractModuleStyleState(newState.module || '', newStyle),
            };
            return s;
          });
          break;
        }
        case 'module': {
          const select = target as HTMLSelectElement;
          this.setState((prevState: ChooseFontWinState) => {
            return extractModuleStyleState(select.value, prevState.style);
          });
          break;
        }
        case 'fontFamily':
        case 'fontSize':
        case 'lineHeight': {
          const select = target as HTMLSelectElement;
          this.setState((prevState: ChooseFontWinState) => {
            const newState = deepClone(prevState);
            newState[targid] = select.value;
            const s: Partial<ChooseFontWinState> = {
              [targid]: newState[targid],
              style: getStyleFromState(newState),
            };
            return s;
          });
          break;
        }
        default:
          throw Error(`Unhandled chooseFontH change on id '${target.id}'`);
      }
      break;
    }
    default:
      throw Error(`Unhandled chooseFontH event type ${e.type}`);
  }
}
