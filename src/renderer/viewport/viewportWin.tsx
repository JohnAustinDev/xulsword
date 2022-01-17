/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import { render } from 'react-dom';
import i18next from 'i18next';
import { compareObjects, deepClone } from '../../common';
import C from '../../constant';
import i18nInit from '../i18n';
import { jsdump } from '../rutil';
import { handle, xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import { Hbox, Vbox } from '../libxul/boxes';
import Viewport from './viewport';
import G from '../rg';
import xulswordHandlerH from '../xulsword/xulswordHandler';
import '../global-htm.css';
import '../xulsword/xulsword.css';

import type { StateDefault } from '../../type';
import type { MouseWheel } from '../xulsword/xulswordHandler';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

export type ViewportWinProps = XulProps;

// The following state values are not stored in Prefs, but take
// default values in Xulsword constructor.
const stateNoPref: any = {
  vpreset: 0,
};
Object.entries(JSON.parse(window.shell.process.argv().pop())).forEach(
  (entry) => {
    const [name, value] = entry;
    stateNoPref[name] = value;
  }
);

export type ViewportWinState = typeof stateNoPref & StateDefault;

export default class ViewportWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  xulswordHandler: any;

  mouseWheel: MouseWheel;

  lastSetPrefs: { [i: string]: any };

  versification: string | undefined;

  v11nmod: string | undefined;

  constructor(props: ViewportWinProps) {
    super(props);

    this.state = {
      ...stateNoPref,
      ...this.getStatePrefs(),
    };

    // Listener for set-window-states IPC channel requesting we set state from prefs.
    window.ipc.renderer.on('set-window-states', (prefs: string | string[]) => {
      const state = this.getStatePrefs(prefs);
      const lng = G.Prefs.getCharPref(C.LOCALEPREF);
      if (lng !== i18next.language) {
        i18next.changeLanguage(lng, (err) => {
          if (err) throw Error(err);
          G.reset();
          this.setState(state);
        });
      } else {
        this.setState(state);
      }
    });

    this.getStatePrefs = this.getStatePrefs.bind(this);
    this.updateGlobalState = this.updateGlobalState.bind(this);
    this.closeMenupopups = this.closeMenupopups.bind(this);

    this.xulswordHandler = xulswordHandlerH.bind(this);
    this.lastSetPrefs = {};
    this.versification = undefined;
    this.v11nmod = undefined;
    this.mouseWheel = { TO: 0, atext: null, count: 0 };
  }

  // Return values of state Prefs. If prefsToGet is undefined, all state prefs
  // will be returned. NOTE: The whole initial pref object (after the id) is
  // returned if any of its descendants is requested.
  getStatePrefs = (prefsToGet?: string | string[]): { [i: string]: any } => {
    const { id } = this.props as ViewportWinProps;
    const store = G.Prefs.getStore();
    if (!id || !store) {
      return {};
    }
    let prefs: undefined | string[];
    if (prefsToGet) {
      if (!Array.isArray(prefsToGet)) prefs = [prefsToGet];
      else {
        prefs = prefsToGet;
      }
      prefs = prefs.map((p) => {
        return p.split('.')[1];
      });
    }
    const state: any = {};
    Object.entries(store).forEach((entry) => {
      const [canid, value] = entry;
      if (canid === id && typeof value === 'object') {
        Object.entries(value).forEach((entry2) => {
          const [s, v] = entry2;
          if (
            !(s in stateNoPref) &&
            (prefs === undefined || prefs.includes(s))
          ) {
            state[s] = v;
          }
        });
      }
    });

    return state;
  };

  // Compare state s to the previously set Prefs and do nothing if there
  // were no changes. Otherwise, if this component has an id, persist its
  // latest state changes to Prefs (except those in stateNoPersist) and
  // then setGlobalMenuFromPrefs()
  updateGlobalState = (s: ViewportWinState) => {
    const { id } = this.props as ViewportWinProps;
    if (!id) return;
    let prefsChanged = false;
    Object.entries(s).forEach((entry) => {
      const [name, value] = entry;
      const type = typeof value;
      const pref = `${id}.${name}`;
      const lastval =
        pref in this.lastSetPrefs ? this.lastSetPrefs[pref] : undefined;
      const thisval = type === 'object' ? deepClone(value) : value;
      if (!(name in stateNoPref) && !compareObjects(lastval, thisval)) {
        if (type === 'string') {
          G.Prefs.setCharPref(pref, value as string);
        } else if (type === 'number') {
          G.Prefs.setIntPref(pref, value as number);
        } else if (type === 'boolean') {
          G.Prefs.setBoolPref(pref, value as boolean);
        } else {
          G.Prefs.setComplexValue(pref, value);
        }
        this.lastSetPrefs[pref] = thisval;
        prefsChanged = true;
      }
    });
    if (prefsChanged) G.setGlobalMenuFromPrefs();
  };

  closeMenupopups = () => {
    let reset = 0;
    Array.from(document.getElementsByClassName('tabs')).forEach((t) => {
      if (t.classList.contains('open')) reset += 1;
    });
    if (reset) {
      this.setState((prevState) => {
        let { vpreset } = prevState as ViewportWinState;
        if (reset) vpreset += 1;
        return { vpreset };
      });
    }
  };

  render() {
    const state = this.state as ViewportWinState;
    const {
      book,
      chapter,
      verse,
      show,
      place,
      tabs,
      modules,
      ilModules,
      mtModules,
      keys,
      numDisplayedWindows,
      selection,
      flagScroll,
      isPinned,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      vpreset,
    } = state;

    jsdump(
      `Rendering ViewportWin ${JSON.stringify({
        ...state,
        tabs: 'not-printed',
      })}`
    );

    const { xulswordHandler } = this;
    let { versification } = this;

    this.updateGlobalState(state);

    // Get versification of chooser and history menu
    this.v11nmod = modules.find((m: string, i: number) => {
      return i < numDisplayedWindows && m && G.Tab[m].isVerseKey;
    });
    versification = this.v11nmod ? G.Tab[this.v11nmod].v11n : undefined;

    return (
      <Vbox
        {...this.props}
        {...handle('onClick', this.closeMenupopups, this.props)}
      >
        <Hbox flex="1">
          <Viewport
            key={[vpreset, showChooser].join('.')}
            id="main-viewport"
            xulswordHandler={xulswordHandler}
            book={book}
            chapter={chapter}
            verse={verse}
            tabs={tabs}
            modules={modules}
            ilModules={ilModules}
            mtModules={mtModules}
            show={show}
            place={place}
            keys={keys}
            selection={selection}
            flagScroll={flagScroll}
            isPinned={isPinned}
            noteBoxHeight={noteBoxHeight}
            maximizeNoteBox={maximizeNoteBox}
            showChooser={false}
            numDisplayedWindows={numDisplayedWindows}
            ownWindow
            versification={versification}
          />
        </Hbox>
      </Vbox>
    );
  }
}
ViewportWin.defaultProps = defaultProps;
ViewportWin.propTypes = propTypes;

function loadedXUL() {
  jsdump('RUNNING loadedXUL()!');
  window.ipc.renderer.send('did-finish-render');
}

function unloadXUL() {
  jsdump('RUNNING unloadXUL()!');
}

i18nInit(['xulsword'])
  .then(() =>
    render(
      // Must have the same id as Xulsword component so state will be shared.
      <ViewportWin id="xulsword" pack="start" height="100%" />,
      document.getElementById('root')
    )
  )
  .then(() => loadedXUL())
  .catch((e: string | Error) => jsdump(e));

// window.ipc.renderer.on('resize', () => {if (ViewPort) ViewPort.resize()});

window.ipc.renderer.on('close', () => unloadXUL());
