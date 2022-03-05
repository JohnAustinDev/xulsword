/* eslint-disable import/no-duplicates */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ofClass } from '../../common';
import G from '../rg';
import type { ConfigType } from '../../type';
import type { StyleType } from '../style';
import type ChooseFontWin from './chooseFont';
import type { ChooseFontWinState } from './chooseFont';

function setModuleStyle(
  style: Partial<StyleType>,
  key: string | 'default',
  state?: ChooseFontWinState
) {
  if (!('module' in style) || !style.module) style.module = {};
  if (!(key in style.module) || !style.module[key]) style.module[key] = {};
  ['fontFamily', 'fontSize', 'lineHeight'].forEach((p) => {
    const skey = p as keyof ChooseFontWinState;
    const ckey = p as keyof ConfigType;
    const config = style.module && style.module[key];
    if (config) {
      if (!state) {
        if (ckey in config) delete config[ckey];
      } else {
        config[ckey] = (state[skey] || null) as any;
      }
    }
  });
}

export function getModuleStyle(state: ChooseFontWinState) {
  const { restoreDefault, makeDefault, restoreAllDefaults, module } = state;
  let style = G.Prefs.getComplexValue('style') as Partial<StyleType>;
  if (!style) style = {};
  if (restoreAllDefaults) {
    // TODO! ARE YOU SURE DIALOG
    style.module = {};
  } else if (makeDefault) {
    setModuleStyle(style, 'default', state);
  } else if (module && restoreDefault) {
    setModuleStyle(style, module);
  } else if (module) {
    setModuleStyle(style, module, state);
  }
  return style;
}

export default function handler(this: ChooseFontWin, e: React.SyntheticEvent) {
  const state = this.state as ChooseFontWinState;
  const target = e.target as HTMLElement;
  const currentTarget = e.currentTarget as HTMLElement;
  switch (e.type) {
    case 'click': {
      switch (currentTarget.id) {
        case 'cancel': {
          G.Data.readAndDelete('stylesheetData');
          G.globalReset();
          window.ipc.renderer.send('window', 'close');
          break;
        }
        case 'ok': {
          G.Prefs.setComplexValue('style', getModuleStyle(state));
          G.Data.readAndDelete('stylesheetData');
          G.globalReset();
          window.ipc.renderer.send('window', 'close');
          break;
        }
        case 'background':
        case 'color': {
          const menu = ofClass(['menu'], target);
          if (!menu) {
            this.setState((prevState: ChooseFontWinState) => {
              const key = `${currentTarget.id}open` as keyof ChooseFontWinState;
              return { [key]: !prevState[key] };
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
            return { [targid]: !prevState[targid] };
          });
          break;
        }
        case 'module':
        case 'fontFamily':
        case 'fontSize':
        case 'lineHeight': {
          const select = target as HTMLSelectElement;
          this.setState({ [targid]: select.value });
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
