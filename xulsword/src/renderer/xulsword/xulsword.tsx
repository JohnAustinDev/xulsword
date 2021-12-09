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
import i18nInit from '../i18n';
import {
  convertDotString,
  dosString2LocaleString,
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
import C from '../../constant';
import { dString } from '../../common';
// eslint-disable-next-line import/no-cycle
import { xulswordHandler, handleViewport as handleVP } from './handlers';
import '../global-htm.css';
import './xulsword.css';

export const defaultProps = {
  ...xulDefaultProps,
};

export const propTypes = {
  ...xulPropTypes,
};

export type XulswordProps = XulProps;

// Default values for these keys must be set in the default Pref file
// or an error will likely be thrown.
export interface StateDefault {
  book: string;
  chapter: number;
  verse: number;
  lastverse: number;

  history: string[];
  historyIndex: number;

  showHeadings: boolean;
  showFootnotes: boolean;
  showCrossRefs: boolean;
  showDictLinks: boolean;
  showVerseNums: boolean;
  showStrongs: boolean;
  showMorph: boolean;
  showUserNotes: boolean;
  showHebCantillation: boolean;
  showHebVowelPoints: boolean;
  showRedWords: boolean;

  tabs: string[][];
  modules: (string | undefined)[];
  ilModules: (string | undefined)[];
  mtModules: (string | undefined)[];
  keys: string[];

  flagHilight: number[];
  flagScroll: number[];
  isPinned: boolean[];
  noteBoxHeight: number[];
  maximizeNoteBox: number[];
  showChooser: boolean;

  chooser: 'bible' | 'genbook' | 'none';
  numDisplayedWindows: number;
}

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

  handleViewport: any;

  historyTO: NodeJS.Timeout | undefined;

  lastSetPrefs: { [i: string]: any };

  constructor(props: XulswordProps) {
    super(props);

    this.state = {
      ...stateNoPref,
      ...this.getStatePrefs(),
    };

    // Listener for G.setStateFromPrefs()
    window.ipc.renderer.on('setStateFromPrefs', (prefs: string | string[]) => {
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

    this.handler = xulswordHandler.bind(this);
    this.handleViewport = handleVP.bind(this);
    this.lastSetPrefs = {};
  }

  // Return values of state Prefs.
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
    }
    const state: any = {};
    const entries = Object.entries(store);
    entries.forEach((entry) => {
      const [fullPref, value] = entry;
      const prefId = fullPref.substring(0, id.length);
      if (
        prefId === id &&
        fullPref.substring(id.length, id.length + 1) === '.'
      ) {
        const prefName = fullPref.substring(id.length + 1);
        if (
          !(prefName in stateNoPref) &&
          (prefs === undefined || prefs.includes(fullPref))
        ) {
          state[prefName] = value;
        }
      }
    });
    return state;
  };

  // Compare state s to the previously set Prefs and do nothing if there
  // were no changes. Otherwise, if this component has an id, persist its
  // latest state changes to Prefs (except those in stateNoPersist) and
  // then setGlobalMenuFromPrefs()
  updateGlobalState = (s: XulswordState) => {
    const { id } = this.props as XulswordProps;
    if (!id) return;
    let prefsChanged = false;
    const entries = Object.entries(s);
    entries.forEach((entry) => {
      const [name, value] = entry;
      const fullPref = `${id}.${name}`;
      const laststr =
        fullPref in this.lastSetPrefs ? this.lastSetPrefs[fullPref] : undefined;
      let thisstr;
      if (value !== undefined) thisstr = value.toString();
      if (!(name in stateNoPref) && laststr !== thisstr) {
        const type = typeof value;
        if (type === 'string') {
          G.Prefs.setCharPref(fullPref, value as string);
        } else if (type === 'number') {
          G.Prefs.setIntPref(fullPref, value as number);
        } else if (type === 'boolean') {
          G.Prefs.setBoolPref(fullPref, value as boolean);
        } else {
          G.Prefs.setComplexValue(fullPref, value);
        }
        this.lastSetPrefs[fullPref] = value.toString();
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
              {dosString2LocaleString(cloc, true)}
            </div>
          );
        })}
      </Menupopup>
    );
  };

  // Insert a history entry at the current historyIndex.
  addHistory = (menuVersification: string, add?: string): void => {
    const { book, chapter, verse, lastverse, history, historyIndex } = this
      .state as XulswordState;
    if (!book) return;
    let location = add as string;
    if (!location) {
      location = [
        book,
        chapter,
        verse,
        lastverse,
        G.LibSword.getVerseSystem(menuVersification),
      ].join('.');
    }
    // Don't record again if previous bk.ch.vs is same as current history index
    const prev = history[historyIndex]
      ? convertDotString(
          history[historyIndex],
          G.LibSword.getVerseSystem(menuVersification)
        )
      : null;
    if (prev) {
      const pre = prev.split('.');
      const loc = location.split('.');
      pre.pop();
      loc.pop();
      if (pre.toString() === loc.toString()) return;
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
        G.LibSword.getVerseSystem(modules[0])
      );
      const { book, chapter, verse, lastverse } =
        dotStringLoc2ObjectLoc(newLocation);
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
        lastverse,
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
      lastverse,
      historyMenupopup,
      history,
      historyIndex,
      showHeadings,
      showFootnotes,
      showCrossRefs,
      showDictLinks,
      searchDisabled,
      tabs,
      modules,
      ilModules,
      mtModules,
      keys,
      numDisplayedWindows,
      flagHilight,
      flagScroll,
      isPinned,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      chooser,
      bsreset,
      vpreset,
    } = state;

    jsdump(
      `Rendering Xulsword ${JSON.stringify({
        ...state,
        historyMenupopup: !!historyMenupopup,
      })}`
    );

    const { handler, handleViewport } = this;

    this.updateGlobalState(state);

    // Get versification of chooser and history menu
    const v11nmod = modules.find((m, i) => {
      return (
        i < numDisplayedWindows &&
        m &&
        (G.Tab[m].modType === C.BIBLE || G.Tab[m].modType === C.COMMENTARY)
      );
    });
    const versification = v11nmod
      ? G.LibSword.getVerseSystem(v11nmod)
      : undefined;

    // Add page to history after a short delay
    if (versification) {
      if (this.historyTO) clearTimeout(this.historyTO);
      this.historyTO = setTimeout(() => {
        this.addHistory(versification);
      }, 1000);
    }

    const minWidth =
      (chooser !== 'none' && showChooser ? 300 : 0) + 200 * numDisplayedWindows;

    return (
      <Translation>
        {(t) => (
          <Vbox
            {...this.props}
            onClick={this.closeMenupopups}
            style={{ minWidth: `${minWidth}px` }}
          >
            <Hbox id="main-controlbar" className="controlbar">
              <Spacer width="17px" orient="vertical" />

              <Vbox id="navigator-tool" pack="start">
                <Hbox id="historyButtons" align="center">
                  <Button
                    id="back"
                    flex="40%"
                    onClick={handler}
                    disabled={
                      !versification ||
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
                    disabled={!versification || history.length <= 1}
                    tooltip={t('history.all.tooltip')}
                  >
                    {historyMenupopup}
                  </Button>
                  <Button
                    id="forward"
                    dir="reverse"
                    flex="40%"
                    onClick={handler}
                    disabled={!versification || historyIndex === 0}
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
                    disabled={!versification}
                    key={`bk${book}${bsreset}`}
                    onChange={handler}
                  />
                  <Textbox
                    id="chapter"
                    width="50px"
                    maxLength="3"
                    pattern={/^[0-9]+$/}
                    value={dString(chapter.toString())}
                    timeout="300"
                    disabled={!versification}
                    key={`ch${chapter}`}
                    onChange={handler}
                    onClick={handler}
                  />
                  <Vbox width="28px">
                    <Button
                      id="nextchap"
                      disabled={!versification}
                      onClick={handler}
                    />
                    <Button
                      id="prevchap"
                      disabled={!versification}
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
                    timeout="300"
                    disabled={!versification}
                    onChange={handler}
                    onClick={handler}
                  />
                  <Vbox width="28px">
                    <Button
                      id="nextverse"
                      disabled={!versification}
                      onClick={handler}
                    />
                    <Button
                      id="prevverse"
                      disabled={!versification}
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
                  checked={showHeadings}
                  onClick={handler}
                  label={t('headingsButton.label')}
                  tooltip={t('headingsButton.tooltip')}
                />
                <Button
                  id="fnbutton"
                  orient="vertical"
                  checked={showFootnotes}
                  onClick={handler}
                  label={t('notesButton.label')}
                  tooltip={t('notesButton.tooltip')}
                />
                <Button
                  id="crbutton"
                  orient="vertical"
                  checked={showCrossRefs}
                  onClick={handler}
                  label={t('crossrefsButton.label')}
                  tooltip={t('crossrefsButton.tooltip')}
                />
                <Button
                  id="dtbutton"
                  orient="vertical"
                  checked={showDictLinks}
                  onClick={handler}
                  label={t('dictButton.label')}
                  tooltip={t('dictButton.tooltip')}
                />
              </Hbox>

              <Spacer id="rightSpacer" flex="72%" orient="vertical" />
            </Hbox>

            <Hbox flex="1">
              <Viewport
                key={vpreset}
                id="main-viewport"
                handler={handleViewport}
                book={book}
                chapter={chapter}
                verse={verse}
                lastverse={lastverse}
                tabs={tabs}
                modules={modules}
                ilModules={ilModules}
                mtModules={mtModules}
                keys={keys}
                flagHilight={flagHilight}
                flagScroll={flagScroll}
                isPinned={isPinned}
                noteBoxHeight={noteBoxHeight}
                maximizeNoteBox={maximizeNoteBox}
                showChooser={showChooser}
                chooser={chooser}
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
