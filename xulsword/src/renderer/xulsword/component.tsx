/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import { Translation } from 'react-i18next';
import i18next from 'i18next';
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
import Toolbox from '../libxul/toolbox';
import Viewport from '../viewport/viewport';
import G from '../rg';
import C from '../../constant';
import { xulswordHandler, handleViewport as handleVP } from './handlers';
import './xulsword.css';

const defaultProps = {
  ...xulDefaultProps,
  i18n: undefined,
};

const propTypes = {
  ...xulPropTypes,
};

interface XulswordProps extends XulProps {
  i18n: typeof i18next;
}

// Default values for these keys must be set in the default Pref file
// or an error will be thrown.
interface StateDefault {
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
  modules: string[];
  keys: string[];

  chooser: 'bible' | 'genbook' | 'none';
  numDisplayedWindows: number;
}

// The following state values are not stored in Prefs, but take
// default values in Xulsword constructor.
const stateNoPref = {
  historyMenupopup: undefined,
  hasBible: G.LibSword.hasBible(),
  bsreset: 0,
  searchDisabled: true,
};

type XulswordState = typeof stateNoPref & StateDefault;

const maxHistoryMenuLength = 20;

export class Xulsword extends React.Component {
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
        G.reset();
        i18next
          .changeLanguage(lng)
          .then(() => {
            G.reset();
            this.setState(state);
            return true;
          })
          .catch((e) => {
            throw Error(e);
          });
      } else {
        G.reset();
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
      const prefId = fullPref.substr(0, id.length);
      if (prefId === id && fullPref.substr(id.length, 1) === '.') {
        const prefName = fullPref.substr(id.length + 1);
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
  // setGlobalMenuFromPrefs()
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

  historyMenu = () => {
    const state = this.state as XulswordState;
    let is = state.historyIndex - Math.round(maxHistoryMenuLength / 2);
    if (is < 0) is = 0;
    let ie = is + maxHistoryMenuLength;
    if (ie > state.history.length) ie = state.history.length;
    const items = state.history.slice(is, ie);
    if (!items || !items.length) return null;
    return (
      <Menupopup>
        {items.map((loc, i) => {
          const cloc = convertDotString(
            loc,
            G.LibSword.getVerseSystem(state.modules[0])
          );
          const index = i + is;
          const selected = index === state.historyIndex ? 'selected' : '';
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

  // Insert a page history entry at the current historyIndex.
  addHistory = (add?: string): void => {
    const { book, chapter, verse, lastverse, modules, history, historyIndex } =
      this.state as XulswordState;
    let location = add as string;
    if (!location) {
      location = [
        book,
        chapter,
        verse,
        lastverse,
        G.LibSword.getVerseSystem(modules[0]),
      ].join('.');
    }
    if (history[historyIndex] === location) return;

    this.setState((prevState: XulswordState) => {
      prevState.history.splice(prevState.historyIndex, 0, location);
      if (prevState.history.length > maxHistoryMenuLength) {
        prevState.history.pop();
      }
      return { history: prevState.history };
    });
  };

  // Set state location back to history[index] and move history[index]
  // to history[0] if promote is true.
  setHistory = (index: number, promote = false): void => {
    const { history: h } = this.state as XulswordState;
    if (index < 0 || index > h.length - 1 || index > maxHistoryMenuLength)
      return;
    this.setState((prevState: XulswordState) => {
      const { history, modules } = prevState as XulswordState;
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
    if (historyMenupopup) {
      this.setState({ historyMenupopup: undefined });
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
      keys,
      hasBible,
      numDisplayedWindows,
      chooser,
      bsreset,
    } = state;

    jsdump(
      `Rendering Xulsword ${JSON.stringify({
        ...state,
        historyMenupopup: !!historyMenupopup,
      })}`
    );

    const { handler, handleViewport } = this;

    this.updateGlobalState(state);

    // Add page to history after a short delay
    if (this.historyTO) clearTimeout(this.historyTO);
    this.historyTO = setTimeout(() => {
      this.addHistory();
    }, 1000);

    if (!hasBible) {
      return <Vbox {...this.props} />;
    }

    return (
      <Translation>
        {(t) => (
          <Vbox {...this.props} onClick={this.closeMenupopups}>
            <Toolbox>{/* TODO: NEED TO ADD MENU */}</Toolbox>

            <Hbox id="main-controlbar" className="controlbar">
              <Spacer width="17px" orient="vertical" />

              <Vbox id="navigator-tool" pack="start">
                <Hbox id="historyButtons" align="center">
                  <Button
                    id="back"
                    flex="40%"
                    onClick={handler}
                    disabled={
                      !history.length || historyIndex === history.length - 1
                    }
                    label={t('history.back.label')}
                    tooltip={t('history.back.tooltip')}
                  />
                  <Button
                    id="historymenu"
                    type="menu"
                    onClick={handler}
                    disabled={history.length <= 1}
                    tooltip={t('history.all.tooltip')}
                  >
                    {historyMenupopup}
                  </Button>
                  <Button
                    id="forward"
                    dir="reverse"
                    flex="40%"
                    onClick={handler}
                    disabled={historyIndex === 0}
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
                    key={`bk${book}${bsreset}`}
                    onChange={handler}
                  />
                  <Textbox
                    id="chapter"
                    width="50px"
                    maxLength="3"
                    pattern={/^[0-9]+$/}
                    value={chapter.toString()}
                    timeout="300"
                    key={`ch${chapter}`}
                    onChange={handler}
                    onClick={handler}
                  />
                  <Vbox width="28px">
                    <Button id="nextchap" onClick={handler} />
                    <Button id="prevchap" onClick={handler} />
                  </Vbox>
                  <Textbox
                    id="verse"
                    key={`vs${verse}`}
                    width="50px"
                    maxLength="3"
                    pattern={/^[0-9]+$/}
                    value={verse.toString()}
                    timeout="300"
                    onChange={handler}
                    onClick={handler}
                  />
                  <Vbox width="28px">
                    <Button id="nextverse" onClick={handler} />
                    <Button id="prevverse" onClick={handler} />
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
                id="main-viewport"
                book={book}
                chapter={chapter}
                verse={verse}
                lastverse={lastverse}
                handler={handleViewport}
                tabs={tabs}
                modules={modules}
                keys={keys}
                chooser={chooser}
                numDisplayedWindows={numDisplayedWindows}
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

export function loadedXUL() {
  jsdump('RUNNING loadedXUL()!');
}

export function unloadXUL() {
  jsdump('RUNNING unloadXUL()!');
}
