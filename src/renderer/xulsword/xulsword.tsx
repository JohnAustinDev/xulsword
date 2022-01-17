/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import { render } from 'react-dom';
import { Translation } from 'react-i18next';
import { HistoryTypeVK, StateDefault } from '../../type';
import { dString } from '../../common';
import C from '../../constant';
import i18nInit from '../i18n';
import {
  dotString2LocaleString,
  jsdump,
  onSetWindowStates,
  getStatePref,
  updateGlobalState,
} from '../rutil';
import { handle, xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import Button from '../libxul/button';
import { Hbox, Vbox } from '../libxul/boxes';
import Menupopup from '../libxul/menupopup';
import Bookselect from '../libxul/bookselect';
import Spacer from '../libxul/spacer';
import Textbox from '../libxul/textbox';
import Viewport from '../viewport/viewport';
import G from '../rg';
import handlerH from './xulswordH';
import xulswordHandlerH from './xulswordHandler';
import '../global-htm.css';
import './xulsword.css';

import type { MouseWheel } from './xulswordHandler';

const maxHistoryMenuLength = 20;

export function updateVersification(component: React.Component) {
  const {
    modules,
    numDisplayedWindows,
    v11nmod: mod,
    versification: v11n,
  } = component.state as any;
  const v11nmod = modules.find((m: string, i: number) => {
    return i < numDisplayedWindows && m && G.Tab[m].isVerseKey;
  });
  const versification = v11nmod ? G.Tab[v11nmod].v11n : undefined;
  if (mod !== v11nmod || v11n !== versification) {
    component.setState({ v11nmod, versification });
  }
}

export function closeMenupopups(component: React.Component) {
  const { historyMenupopup } = component.state as any;
  let reset = 0;
  Array.from(document.getElementsByClassName('tabs')).forEach((t) => {
    if (t.classList.contains('open')) reset += 1;
  });
  if (reset || historyMenupopup) {
    component.setState((prevState) => {
      let { vpreset } = prevState as XulswordState;
      if (reset) vpreset += 1;
      const s: any = {};
      if (reset) s.vpreset = vpreset + 1;
      if (historyMenupopup) s.historyMenupopup = undefined;
      return s;
    });
  }
}

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

export type XulswordProps = XulProps;

// These state values are not stored in Prefs, but take
// on the following values in the Xulsword constructor.
export const notStatePref = {
  versification: '',
  v11nmod: '',
  historyMenupopup: undefined,
  bsreset: 0,
  vpreset: 0,
  searchDisabled: true,
};

export type XulswordState = typeof notStatePref & StateDefault;

export default class Xulsword extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  handler: any;

  xulswordHandler: any;

  historyTO: NodeJS.Timeout | undefined;

  mouseWheel: MouseWheel;

  lastSetPrefs: { [i: string]: any };

  constructor(props: XulswordProps) {
    super(props);

    this.state = {
      ...notStatePref,
      ...getStatePref(this, null, notStatePref),
    };

    onSetWindowStates(this);

    this.historyMenu = this.historyMenu.bind(this);
    this.addHistory = this.addHistory.bind(this);
    this.setHistory = this.setHistory.bind(this);

    this.handler = handlerH.bind(this);
    this.xulswordHandler = xulswordHandlerH.bind(this);
    this.lastSetPrefs = {};
    this.mouseWheel = { TO: 0, atext: null, count: 0 };
  }

  componentDidMount() {
    updateVersification(this);
  }

  componentDidUpdate() {
    updateVersification(this);
  }

  // A history item has the form HistoryTypeVK and only the last
  // verse selection viewed for a chapter will be saved in history.
  // This function inserts a history entry at the current historyIndex.
  addHistory = (add?: HistoryTypeVK): void => {
    const {
      book,
      chapter,
      verse,
      selection,
      versification,
      history,
      historyIndex,
    } = this.state as XulswordState;
    if (!book || !versification) return;
    const newhist: HistoryTypeVK = add || {
      book,
      chapter,
      verse,
      v11n: versification,
      selection,
    };
    // Don't record multiple entries for the same chapter, and convert vlln
    // before comparing.
    if (history[historyIndex]) {
      const { book: hbk, chapter: hch, v11n: hv11n } = history[historyIndex];
      const { book: nbk, chapter: nch, v11n: nv11n } = newhist;
      const [nbks, nchs] = `${G.LibSword.convertLocation(
        nv11n,
        [nbk, nch].join('.'),
        hv11n
      )}`.split('.');
      if (hbk === nbks && hch === Number(nchs)) return;
    }
    // Then add a new history entry to the array and check array length.
    this.setState((prevState: XulswordState) => {
      prevState.history.splice(prevState.historyIndex, 0, newhist);
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
      const { history, versification, flagScroll } = prevState as XulswordState;
      if (!versification) return null;
      // To update state to a history index without changing the selected
      // modules, history needs to be converted to the current versification.
      const { book: bk, chapter: ch, v11n, selection: sel } = history[index];
      const [bks, chs] = G.LibSword.convertLocation(
        v11n,
        [bk, ch].join('.'),
        versification
      ).split('.');
      const book = bks;
      const chapter = Number(chs);
      const selection = G.LibSword.convertLocation(v11n, sel, versification);
      if (promote) {
        const targ = history.splice(index, 1);
        history.splice(0, 0, targ[0]);
      }
      // If selection is interesting, scroll to it
      if (selection && selection.split('.').length > 2) {
        for (let x = 0; x < flagScroll.length; x += 1) {
          flagScroll[x] = C.SCROLLTYPECENTER;
        }
      }
      return {
        history,
        historyIndex: promote ? 0 : index,
        historyMenupopup: undefined,
        book,
        chapter,
        verse: 1,
        selection,
        flagScroll,
      };
    });
  };

  // Build and return a history menupopup
  historyMenu = (state: XulswordState) => {
    const { history, historyIndex, versification } = state;
    let is = historyIndex - Math.round(maxHistoryMenuLength / 2);
    if (is < 0) is = 0;
    let ie = is + maxHistoryMenuLength;
    if (ie > history.length) ie = history.length;
    const items = history.slice(is, ie);
    if (!items || !items.length) return null;
    return (
      <Menupopup>
        {items.map((histitem, i) => {
          // Displayed book and chapter are from history, but any
          // verse or lastverse are from the selection.
          const { book: bk, chapter: ch, v11n } = histitem;
          const [bks, chs] = G.LibSword.convertLocation(
            v11n,
            [bk, ch].join('.'),
            versification
          ).split('.');
          const location = [bks, chs];
          if (histitem.selection) {
            const [b, c, v, l] = G.LibSword.convertLocation(
              v11n,
              histitem.selection,
              versification
            ).split('.');
            if (bks === b && chs === c && Number(v) > 1) {
              location.push(v);
              if (!Number.isNaN(Number(l)) && v !== l) location.push(l);
            }
          }
          const index = i + is;
          const selected = index === historyIndex ? 'selected' : '';
          return (
            <div
              className={selected}
              onClick={(e) => {
                this.setHistory(index, true);
                e.stopPropagation();
              }}
              key={[selected, index, histitem].join('.')}
            >
              {dotString2LocaleString(location.join('.'), true)}
            </div>
          );
        })}
      </Menupopup>
    );
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
      versification,
    } = state;

    const { handler, xulswordHandler, lastSetPrefs } = this;

    updateGlobalState(this, lastSetPrefs, notStatePref);

    // Add page to history after a short delay
    if (versification) {
      if (this.historyTO) clearTimeout(this.historyTO);
      this.historyTO = setTimeout(() => {
        return this.addHistory();
      }, 1000);
    }

    const navdisabled =
      !versification || isPinned.every((p, i) => i >= numDisplayedWindows || p);

    jsdump(
      `Rendering Xulsword ${JSON.stringify({
        ...state,
        history: history.length,
        tabs: 'not_printed',
        show: 'not_printed',
        place: 'not_printed',
        historyMenupopup: !!historyMenupopup,
        versification,
      })}`
    );

    return (
      <Translation>
        {(t) => (
          <Vbox
            {...this.props}
            {...handle('onClick', () => closeMenupopups(this), this.props)}
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
