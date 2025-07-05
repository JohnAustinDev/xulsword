import C from '../../../constant.ts';
import { clone, diff, ofClass } from '../../../common.ts';
import log from '../../log.ts';
import { G } from '../../G.ts';

import type { ConfigType } from '../../../type.ts';
import type { StyleType } from '../../style.ts';
import type ChooseFontWin from './chooseFontWin.tsx';
import type { ChooseFontWinState, ColorType } from './chooseFontWin.tsx';

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

// Return a partial chooseFont state (just the C.ConfigTemplate props) that will
// display the values of a particular module style (or the module default style).
export function styleToState(
  style: StyleType,
  module: string | 'default',
): Partial<ChooseFontWinState> {
  const state: Partial<ChooseFontWinState> =
    module === 'default' ? {} : { module };
  if (module && style) {
    Object.entries(C.ConfigTemplate).forEach((entry) => {
      const skey = entry[0] as keyof ChooseFontWinState;
      const ckey = entry[0] as keyof ConfigType;
      if (entry[1].CSS) {
        const config = style.module?.[module];
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
            state[skey] = color as any;
          } else if (skey in sliders) {
            const lkey = skey as keyof typeof sliders;
            const { min, max, unit } = sliders[lkey];
            let p = Number(v.replace(unit, '')) || min + (max - min) / 2;
            p = 100 * ((p - min) / (max - min));
            state[skey] = p as any;
          } else state[skey] = v as any;
        } else {
          state[skey] = startingState[skey] as any;
        }
      }
    });
  }
  return state;
}

// Return an updated StyleType from a chooseFont state according to the state's
// checkbox directives. The resulting style can be saved to state or prefs, or
// applied to texts as a preview. Checkbox directives are: removeModuleUserStyles,
// removeAllUserStyles, and makeDefault. If removeAllUserStyles is checked, then
// all module StyleType configs (including 'default') will be removed.
export function stateToStyle(state: ChooseFontWinState): StyleType {
  const {
    makeDefault,
    removeModuleUserStyles,
    removeAllUserStyles,
    module,
    style: oldstyle,
  } = state;

  const style: StyleType = clone(oldstyle);
  function updateModuleStyle(modname: string | 'default', unset = false) {
    if (unset) {
      delete style.module[modname];
    } else {
      const config = {} as ConfigType;
      Object.entries(C.ConfigTemplate).forEach((entry) => {
        const skey = entry[0] as keyof ChooseFontWinState;
        const ckey = entry[0] as keyof ConfigType;
        if (entry[1].CSS) {
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
      });
      style.module[modname] = config;
    }
  }
  if (removeAllUserStyles) {
    style.module = {};
  } else if (makeDefault) {
    updateModuleStyle('default');
    if (module) updateModuleStyle(module, true);
  } else if (module && removeModuleUserStyles) {
    updateModuleStyle(module, true);
  } else if (module) {
    updateModuleStyle(module);
  }
  return style;
}

// Set a state property value and then do stateToStyle() to update state.style as well.
// If value is undefined, the value type is assumed to be boolean and will be toggled.
export function setStateValue(
  this: ChooseFontWin,
  key: 'coloropen' | 'backgroundopen',
): void;
export function setStateValue<K extends keyof ChooseFontWinState>(
  this: ChooseFontWin,
  key: K,
  value: ChooseFontWinState[K],
): void;
export function setStateValue<K extends keyof ChooseFontWinState>(
  this: ChooseFontWin,
  key: K,
  value?: ChooseFontWinState[K],
): void {
  this.setState((prevState: ChooseFontWinState) => {
    const newState = { ...prevState };
    if (typeof value === 'undefined')
      newState[key as 'coloropen' | 'backgroundopen'] = !newState[key];
    else newState[key] = value;
    const s: Partial<ChooseFontWinState> = {
      [key]: newState[key],
      style: stateToStyle(newState),
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
        Number(n),
      );
      const a = Number.isNaN(ax) ? 1 : ax;
      return Number.isNaN(r) ? null : { r, g, b, a };
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
            const { module } = state;
            const style = stateToStyle(state);
            if (module && !diff(style.module.default, style.module[module])) {
              delete style.module[module];
            }
            log.debug(`ChooseFont style: `, style);
            G.Prefs.setComplexValue('style', style, 'style');
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
          const onPicker = ofClass(['chrome-picker'], target);
          if (!onPicker) this.setStateValue(`${currentTarget.id}open`);
          break;
        }
        default:
          throw Error(
            `Unhandled chooseFontH click on id '${currentTarget.id}'`,
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
          // When one of these becomes checked, a clone of the previous style
          // is saved as its state value, and all other inputs become disabled.
          // Then the user only has the choice to either apply the new style or
          // restore the saved style by unchecking the checkbox.
          this.setState(
            (
              prevState0: ChooseFontWinState,
            ): Partial<ChooseFontWinState> | null => {
              const prevState = { ...prevState0 };
              if (prevState.module) {
                let style;
                if (!prevState[targid]) {
                  prevState[targid] = prevState.style;
                  style = stateToStyle(prevState);
                } else {
                  style = prevState[targid] as StyleType;
                  prevState[targid] = null;
                }
                return {
                  [targid]: prevState[targid],
                  style,
                  ...styleToState(
                    style,
                    targid === 'makeDefault' && prevState[targid]
                      ? 'default'
                      : prevState.module,
                  ),
                };
              }
              return null;
            },
          );
          break;
        }
        case 'module': {
          const select = target as HTMLSelectElement;
          this.setState((prevState: ChooseFontWinState) => {
            return styleToState(prevState.style, select.value);
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
