/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import C from '../../constant';
import { clone, ofClass } from '../../common';
import G from '../rg';

import type { ConfigType } from '../../type';
import type { StyleType } from '../style';
import type ChooseFontWin from './chooseFont';
import type { ChooseFontWinState, ColorType } from './chooseFont';

export const startingState = {
  module: '' as string | null, // will be initialized by windowArguments()
  fonts: [] as string[], // will be initialized by getSystemFonts() Promise
  style: G.Prefs.getComplexValue('style', 'style') as StyleType,

  coloropen: false as boolean,
  backgroundopen: false as boolean,

  makeDefault: null as StyleType | null,
  removeModuleUserStyles: null as StyleType | null,
  removeAllUserStyles: null as StyleType | null,

  ruSureDialog: null as ((yes: boolean) => void) | null,

  // These are initial (unset) user style setting values:
  fontFamily: '' as string, // Shows text: 'Choose...'
  color: null as ColorType | null, // will be grey
  background: null as ColorType | null, // will be grey
  fontSize: 50, // percent on slider
  lineHeight: 50, // percent on slider
};

const sliders = {
  fontSize: { min: 0.8, max: 1.2, steps: 16, unit: 'em' },
  lineHeight: { min: 1, max: 1.8, steps: 16, unit: '' },
} as const;

// Return new CSS states that correspond to a particular module's
// user style. This is used to update ChooseFontWinState to display
// the values of a module's user styles.
export function extractModuleStyleState(
  module: string,
  style: StyleType
): Partial<ChooseFontWinState> {
  const s: Partial<ChooseFontWinState> = { module };
  if (module && style) {
    Object.entries(C.ConfigTemplate).forEach((entry) => {
      const skey = entry[0] as keyof ChooseFontWinState;
      const ckey = entry[0] as keyof ConfigType;
      if (entry[1].CSS) {
        const config = style.module && style.module[module];
        const v = config && ckey in config ? config[ckey] : null;
        if (v) {
          const match =
            typeof v === 'string' &&
            v.match(/^rgba\((\d+), (\d+), (\d+), (\d+)\)/);
          if (match) {
            const color: ColorType = {
              r: Number(match[1]),
              g: Number(match[2]),
              b: Number(match[3]),
              a: Number(match[4]),
            };
            s[skey] = color as any;
          } else if (skey in sliders) {
            const lkey = skey as keyof typeof sliders;
            const { min, max, unit } = sliders[lkey];
            let p = Number(v.replace(unit, '')) || min + (max - min) / 2;
            p = 100 * ((p - min) / (max - min));
            s[skey] = p as any;
          } else s[skey] = v as any;
        } else {
          s[skey] = startingState[skey] as any;
        }
      }
    });
  }
  return s;
}

// Return an updated StyleType by applying a state's CSS properties and
// checkbox directives to a clone of its style property. The resulting style
// can be saved to state or prefs, or applied to texts as a preview. Checkbox
// directives are: removeModuleUserStyles, removeAllUserStyles, and makeDefault.
// If removeAllUserStyles is checked, then all module StyleType configs
// (including 'default') will be removed.
export function getStyleFromState(state: ChooseFontWinState): StyleType {
  const {
    makeDefault,
    removeModuleUserStyles,
    removeAllUserStyles,
    module,
    style,
  } = state;
  const newstyle = (style ? clone(style) : {}) as StyleType;
  function updateModuleStyle(modname: string | 'default', unset = false) {
    if (!('module' in newstyle) || !newstyle.module) newstyle.module = {};
    if (!(modname in newstyle.module) || !newstyle.module[modname])
      newstyle.module[modname] = {};
    Object.entries(C.ConfigTemplate).forEach((entry) => {
      const skey = entry[0] as keyof ChooseFontWinState;
      const ckey = entry[0] as keyof ConfigType;
      if (entry[1].CSS) {
        const config = newstyle.module && newstyle.module[modname];
        if (config && typeof config === 'object') {
          if (unset) {
            if (newstyle.module) delete newstyle.module[modname];
          } else {
            let v = (state[skey] || null) as any;
            if (v && typeof v === 'object' && 'r' in v)
              v = `rgba(${v.r}, ${v.g}, ${v.b}, ${v.a})`;
            if (Object.keys(sliders).includes(skey)) {
              const lkey = skey as keyof typeof sliders;
              const { min, max, steps, unit } = sliders[lkey];
              const vpercent = Math.round((v * steps) / 100) / steps;
              v = [min + vpercent * (max - min), unit].join('');
            }
            config[ckey] = v;
          }
        }
      }
    });
  }
  if (removeAllUserStyles) {
    if ('module' in newstyle) delete newstyle.module;
  } else if (makeDefault) {
    updateModuleStyle('default');
  } else if (module && removeModuleUserStyles) {
    updateModuleStyle(module, true);
  } else if (module) {
    updateModuleStyle(module);
  }
  return newstyle;
}

// Set a state value and also update state's style according to the result. If
// value is undefined, the value type is assumed to be boolean and will be toggled.
export function setStateValue(
  this: ChooseFontWin,
  key: keyof ChooseFontWinState,
  value?: ChooseFontWinState
) {
  this.setState((prevState: ChooseFontWinState) => {
    const newState = clone(prevState) as any;
    if (value === undefined) newState[key] = !newState[key];
    else newState[key] = value;
    const s: Partial<ChooseFontWinState> = {
      [key]: newState[key],
      style: getStyleFromState(newState),
    };
    return s;
  });
}

export function computedStyle(module: string | null, key: string) {
  const st = document.getElementById('styleTest');
  if (st && module) {
    st.className = `cs-${module}`;
    const cs = getComputedStyle(st);
    if (key === 'fontFamily' && cs.fontFamily) {
      return cs.fontFamily;
    }
    if (key === 'color' || key === 'background') {
      const rgbaRE = /(\d+),\s*(\d+),\s*(\d+)(,\s*(\d+))?/;
      const skey: keyof CSSStyleDeclaration =
        key === 'color' ? key : `${key}Color`;
      const [, r, g, b, , ax] = (cs[skey].match(rgbaRE) || []).map((n) =>
        Number(n)
      );
      const a = ax || 1;
      return !Number.isNaN(Number(r)) ? { r, g, b, a } : null;
    }
  }
  return null;
}

export function preclose() {
  G.Data.readAndDelete('stylesheetData');
  G.Window.reset('dynamic-stylesheet-reset', 'all');
}

export default function handler(this: ChooseFontWin, e: React.SyntheticEvent) {
  const state = this.state as ChooseFontWinState;
  const target = e.target as HTMLElement;
  const currentTarget = e.currentTarget as HTMLElement;
  switch (e.type) {
    case 'click': {
      switch (currentTarget.id) {
        case 'cancel': {
          preclose();
          G.Window.close();
          break;
        }
        case 'ok': {
          const okConfirmed = () => {
            G.Prefs.setComplexValue('style', getStyleFromState(state), 'style');
            preclose();
            G.Window.close();
          };
          const { removeAllUserStyles } = state;
          if (removeAllUserStyles) {
            const s: Partial<ChooseFontWinState> = {
              ruSureDialog: (yes: boolean) => {
                if (yes) okConfirmed();
                this.setState({ ruSureDialog: null });
              },
            };
            this.setState(s);
          } else okConfirmed();
          break;
        }
        case 'background':
        case 'color': {
          const menu = ofClass(['menu'], target);
          if (!menu) this.setStateValue(`${currentTarget.id}open`);
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
        case 'removeModuleUserStyles':
        case 'removeAllUserStyles':
        case 'makeDefault': {
          // When one of these becomes checked, a clone of the current style
          // is saved as its state value, and all other inputs become disabled.
          // Then the user has the choice to either save the new style or restore
          // the saved style by unchecking the checkbox.
          this.setState((prevState: ChooseFontWinState) => {
            const newState = clone(prevState) as ChooseFontWinState;
            let newStyle;
            const cbvalue = newState[targid];
            if (!cbvalue) {
              newState[targid] = newState.style;
              newStyle = getStyleFromState(newState);
            } else {
              newStyle = cbvalue;
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
        case 'fontFamily': {
          const select = target as HTMLSelectElement;
          this.setStateValue(targid, select.value);
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
