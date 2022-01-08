/* eslint-disable import/no-cycle */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import { render } from 'react-dom';
import { Translation } from 'react-i18next';
import i18next from 'i18next';
import { StateDefault } from '../../type';
import { compareObjects, deepClone, dString } from '../../common';
import C from '../../constant';
import i18nInit from '../i18n';
import {
  convertDotString,
  dotString2LocaleString,
  dotStringLoc2ObjectLoc,
  jsdump,
} from '../rutil';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import Button from '../libxul/button';
import { Hbox, Vbox } from '../libxul/boxes';
import Menupopup from '../libxul/menupopup';
import Bookselect from '../libxul/bookselect';
import Spacer from '../libxul/spacer';
import Textbox from '../libxul/textbox';
import Viewport from '../viewport/viewport';
import G from '../rg';
import handlerX from './xulswordH';
import xulswordHandlerX from './xulswordHandler';
import '../global-htm.css';
import './xulsword.css';

export const defaultProps = {
  ...xulDefaultProps,
};

export const propTypes = {
  ...xulPropTypes,
};

export type XulswordProps = XulProps;

// The following state values are not stored in Prefs, but take
// default values in Xulsword constructor.
export const stateNoPref = {
  historyMenupopup: undefined,
  bsreset: 0,
  vpreset: 0,
  searchDisabled: true,
};

export type XulswordState = typeof stateNoPref & StateDefault;

const maxHistoryMenuLength = 20;

export default class Xulsword extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  handler: any;

  xulswordHandler: any;

  historyTO: NodeJS.Timeout | undefined;

  mouseWheel: { TO: number; atext: HTMLElement | null; count: number };

  lastSetPrefs: { [i: string]: any };

  versification: string | undefined;

  v11nmod: string | undefined;

  constructor(props: XulswordProps) {
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
    this.historyMenu = this.historyMenu.bind(this);
    this.addHistory = this.addHistory.bind(this);
    this.setHistory = this.setHistory.bind(this);
    this.closeMenupopups = this.closeMenupopups.bind(this);

    this.handler = handlerX.bind(this);
    this.xulswordHandler = xulswordHandlerX.bind(this);
    this.lastSetPrefs = {};
    this.versification = undefined;
    this.v11nmod = undefined;
    this.mouseWheel = { TO: 0, atext: null, count: 0 };
  }

  // Return values of state Prefs. If prefsToGet is undefined, all state prefs
  // will be returned. NOTE: The whole initial pref object (after the id) is
  // returned if any of its descendants is requested.
  getStatePrefs = (prefsToGet?: string | string[]): { [i: string]: any } => {
    const { id } = this.props as XulswordProps;
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
  // then setGlobalMenuFromPrefs() which in turn notifies other windows.
  updateGlobalState = (s: XulswordState) => {
    const { id } = this.props as XulswordProps;
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

  // Build and return a history menupopup
  historyMenu = (menuVersification: string) => {
    const { history, historyIndex } = this.state as XulswordState;
    let is = historyIndex - Math.round(maxHistoryMenuLength / 2);
    if (is < 0) is = 0;
    let ie = is + maxHistoryMenuLength;
    if (ie > history.length) ie = history.length;
    const items = history.slice(is, ie);
    if (!items || !items.length) return null;
    return (
      <Menupopup>
        {items.map((loc, i) => {
          const cloc = convertDotString(loc, menuVersification);
          const index = i + is;
          const selected = index === historyIndex ? 'selected' : '';
          return (
            <div
              className={selected}
              onClick={(e) => {
                this.setHistory(index, true);
                e.stopPropagation();
              }}
              key={`${selected}${index}${loc}`}
            >
              {dotString2LocaleString(cloc, true)}
            </div>
          );
        })}
      </Menupopup>
    );
  };

  // Insert a history entry at the current historyIndex.
  addHistory = (menuVersification: string, add?: string): void => {
    const { book, chapter, verse, history, historyIndex } = this
      .state as XulswordState;
    if (!book) return;
    let location = add as string;
    if (!location) {
      location = [book, chapter, verse, verse, menuVersification].join('.');
    }
    // Don't record multiple entries for the same chapter.
    if (history[historyIndex]) {
      const current = convertDotString(
        history[historyIndex],
        menuVersification
      ).split('.');
      const newloc = location.split('.');
      current.splice(2, 2);
      newloc.splice(2, 2);
      if (current.toString() === newloc.toString()) return;
    }

    this.setState((prevState: XulswordState) => {
      prevState.history.splice(prevState.historyIndex, 0, location);
      if (prevState.history.length > maxHistoryMenuLength) {
        prevState.history.pop();
      }
      return { history: prevState.history };
    });
  };

  // Set location to history[index] and move history[index]
  // to history[0] if promote is true.
  setHistory = (index: number, promote = false): void => {
    const { history: h } = this.state as XulswordState;
    if (index < 0 || index > h.length - 1 || index > maxHistoryMenuLength)
      return;
    this.setState((prevState: XulswordState) => {
      const { history, modules } = prevState as XulswordState;
      if (!modules[0]) return {};
      const newLocation = convertDotString(
        history[index],
        G.Tab[modules[0]].v11n
      );
      const { book, chapter, verse } = dotStringLoc2ObjectLoc(newLocation);
      if (promote) {
        const targ = history.splice(index, 1);
        history.splice(0, 0, targ[0]);
      }
      return {
        history,
        historyIndex: promote ? 0 : index,
        historyMenupopup: undefined,
        book,
        chapter,
        verse,
        selection: '',
      };
    });
  };

  closeMenupopups = () => {
    const { historyMenupopup } = this.state as XulswordState;
    let reset = 0;
    Array.from(document.getElementsByClassName('tabs')).forEach((t) => {
      if (t.classList.contains('open')) reset += 1;
    });
    if (reset || historyMenupopup) {
      this.setState((prevState) => {
        let { vpreset } = prevState as XulswordState;
        if (reset) vpreset += 1;
        return { vpreset, historyMenupopup: undefined };
      });
    }
  };

  render() {
    const state = this.state as XulswordState;
    const {
      book,
      chapter,
      verse,
      historyMenupopup,
      history,
      historyIndex,
      show,
      place,
      searchDisabled,
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
      bsreset,
      vpreset,
    } = state;
    let { versification } = this;

    jsdump(
      `Rendering Xulsword ${JSON.stringify({
        ...state,
        tabs: '',
        historyMenupopup: !!historyMenupopup,
      })}`
    );

    const { handler, xulswordHandler } = this;

    this.updateGlobalState(state);

    // Get versification of chooser and history menu
    this.v11nmod = modules.find((m, i) => {
      return i < numDisplayedWindows && m && G.Tab[m].isVerseKey;
    });
    versification = this.v11nmod ? G.Tab[this.v11nmod].v11n : undefined;

    // Add page to history after a short delay
    if (versification) {
      if (this.historyTO) clearTimeout(this.historyTO);
      this.historyTO = setTimeout(() => {
        return versification ? this.addHistory(versification) : null;
      }, 1000);
    }

    const navdisabled =
      !versification || isPinned.every((p, i) => i >= numDisplayedWindows || p);

    return (
      <Translation>
        {(t) => (
          <Vbox {...this.props} onClick={this.closeMenupopups}>
            <Hbox id="main-controlbar" className="controlbar">
              <Spacer width="17px" orient="vertical" />

              <Vbox id="navigator-tool" pack="start">
                <Hbox id="historyButtons" align="center">
                  <Button
                    id="back"
                    flex="40%"
                    onClick={handler}
                    disabled={
                      navdisabled ||
                      !history.length ||
                      historyIndex === history.length - 1
                    }
                    label={t('history.back.label')}
                    tooltip={t('history.back.tooltip')}
                  />
                  <Button
                    id="historymenu"
                    type="menu"
                    onClick={handler}
                    disabled={navdisabled || history.length <= 1}
                    tooltip={t('history.all.tooltip')}
                  >
                    {historyMenupopup}
                  </Button>
                  <Button
                    id="forward"
                    dir="reverse"
                    flex="40%"
                    onClick={handler}
                    disabled={navdisabled || historyIndex === 0}
                    label={t('history.forward.label')}
                    tooltip={t('history.forward.tooltip')}
                  />
                </Hbox>

                <Hbox id="player" pack="start" align="center" hidden>
                  <audio controls onEnded={handler} onCanPlay={handler} />
                  <Button
                    id="closeplayer"
                    onClick={handler}
                    label={t('closeCmd.label')}
                  />
                </Hbox>

                <Hbox id="textnav" align="center">
                  <Bookselect
                    id="book"
                    sizetopopup="none"
                    flex="1"
                    book={book}
                    trans={t('configuration.default_modules')}
                    disabled={navdisabled}
                    key={`bk${book}${bsreset}`}
                    onChange={handler}
                  />
                  <Textbox
                    id="chapter"
                    width="50px"
                    maxLength="3"
                    pattern={/^[0-9]+$/}
                    value={dString(chapter.toString())}
                    timeout="600"
                    disabled={navdisabled}
                    key={`ch${chapter}`}
                    onChange={handler}
                    onClick={handler}
                  />
                  <Vbox width="28px">
                    <Button
                      id="nextchap"
                      disabled={navdisabled}
                      onClick={handler}
                    />
                    <Button
                      id="prevchap"
                      disabled={navdisabled}
                      onClick={handler}
                    />
                  </Vbox>
                  <Textbox
                    id="verse"
                    key={`vs${verse}`}
                    width="50px"
                    maxLength="3"
                    pattern={/^[0-9]+$/}
                    value={dString(verse.toString())}
                    timeout="600"
                    disabled={navdisabled}
                    onChange={handler}
                    onClick={handler}
                  />
                  <Vbox width="28px">
                    <Button
                      id="nextverse"
                      disabled={navdisabled}
                      onClick={handler}
                    />
                    <Button
                      id="prevverse"
                      disabled={navdisabled}
                      onClick={handler}
                    />
                  </Vbox>
                </Hbox>
              </Vbox>

              <Spacer flex="14%" orient="vertical" />

              <Hbox id="search-tool">
                <Vbox>
                  <Textbox
                    id="searchText"
                    type="search"
                    maxLength="24"
                    onChange={handler}
                    onKeyDown={handler}
                    tooltip={t('searchbox.tooltip')}
                  />
                  <Button
                    id="searchButton"
                    orient="horizontal"
                    dir="reverse"
                    disabled={searchDisabled}
                    onClick={handler}
                    label={t('searchBut.label')}
                    tooltip={t('search.tooltip')}
                  />
                </Vbox>
              </Hbox>

              <Spacer flex="14%" orient="vertical" />

              <Hbox id="optionButtons" align="start">
                <Button
                  id="hdbutton"
                  orient="vertical"
                  checked={show.headings}
                  onClick={handler}
                  label={t('headingsButton.label')}
                  tooltip={t('headingsButton.tooltip')}
                />
                <Button
                  id="fnbutton"
                  orient="vertical"
                  checked={show.footnotes}
                  onClick={handler}
                  label={t('notesButton.label')}
                  tooltip={t('notesButton.tooltip')}
                />
                <Button
                  id="crbutton"
                  orient="vertical"
                  checked={show.crossrefs}
                  onClick={handler}
                  label={t('crossrefsButton.label')}
                  tooltip={t('crossrefsButton.tooltip')}
                />
                <Button
                  id="dtbutton"
                  orient="vertical"
                  checked={show.dictlinks}
                  onClick={handler}
                  label={t('dictButton.label')}
                  tooltip={t('dictButton.tooltip')}
                />
              </Hbox>

              <Spacer id="rightSpacer" flex="72%" orient="vertical" />
            </Hbox>

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
                showChooser={showChooser}
                numDisplayedWindows={numDisplayedWindows}
                ownWindow={false}
                versification={versification}
              />
            </Hbox>
          </Vbox>
        )}
      </Translation>
    );
  }
}
Xulsword.defaultProps = defaultProps;
Xulsword.propTypes = propTypes;

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
      <Xulsword id="xulsword" pack="start" height="100%" />,
      document.getElementById('root')
    )
  )
  .then(() => loadedXUL())
  .catch((e: string | Error) => jsdump(e));

// window.ipc.renderer.on('resize', () => {if (ViewPort) ViewPort.resize()});

window.ipc.renderer.on('close', () => unloadXUL());
