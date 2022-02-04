/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/media-has-caption */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';
import { render } from 'react-dom';
import { Translation } from 'react-i18next';
import { HistoryTypeVK, XulswordStatePref } from '../../type';
import { dString } from '../../common';
import C from '../../constant';
import G from '../rg';
import i18nInit from '../i18n';
import {
  dotString2LocaleString,
  jsdump,
  onSetWindowStates,
  getStatePref,
  setPrefFromState,
} from '../rutil';
import {
  addClass,
  topHandle,
  xulDefaultProps,
  XulProps,
  xulPropTypes,
} from '../libxul/xul';
import Button from '../libxul/button';
import { Hbox, Vbox } from '../libxul/boxes';
import Menupopup from '../libxul/menupopup';
import Bookselect from '../libxul/bookselect';
import Spacer from '../libxul/spacer';
import Textbox from '../libxul/textbox';
import Viewport from '../viewport/viewport';
import viewportParentH, {
  closeMenupopups,
  updateVersification,
} from '../viewport/viewportParentH';
import handlerH from './xulswordH';
import '../global-htm.css';
import './xulsword.css';

import type { MouseWheel } from '../viewport/viewportParentH';

const defaultProps = {
  ...xulDefaultProps,
};

const propTypes = {
  ...xulPropTypes,
};

export type XulswordProps = XulProps;

// The following initial state values do not come from Prefs, but from
// these constants. Neither are these state keys written to Prefs.
const notStatePref = {
  windowV11n: '',
  v11nmod: '',
  historyMenupopup: undefined,
  bsreset: 0,
  vpreset: 0,
  searchDisabled: true,
};

// These are state pref panel arrays that don't require default values in
// default prefs.js, since they could be variable size arrays.
const statePrefPanelDefault: Partial<XulswordStatePref> = {
  isPinned: [false],
  flagScroll: [1],
  noteBoxHeight: [200],
  maximizeNoteBox: [0],
};

export type XulswordState = typeof notStatePref & XulswordStatePref;

export default class Xulsword extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  handler: any;

  viewportParentHandler: any;

  historyTO: NodeJS.Timeout | undefined;

  mouseWheel: MouseWheel;

  lastStatePref: { [i: string]: any };

  constructor(props: XulswordProps) {
    super(props);

    if (props.id === 'xulsword') {
      const s: XulswordState = {
        ...notStatePref,
        ...(getStatePref(props.id, null) as XulswordStatePref),
      };
      // If any statePrefPanelDefault arrays are still 0 length, fill them.
      const sx = s as any;
      Object.entries(statePrefPanelDefault).forEach((entry) => {
        const [key, val] = entry;
        const sval = sx[key];
        if (!sval.length && key && Array.isArray(val)) {
          sx.panels.forEach((_p: any, i: string) => {
            if (sx[key][i] === undefined) [sx[key][i]] = val;
          });
        }
      });
      this.state = s;
    } else throw Error(`Xulsword id must be 'xulsword'`);

    onSetWindowStates(this);

    this.handler = handlerH.bind(this);
    this.viewportParentHandler = viewportParentH.bind(this);
    this.lastStatePref = {};
    this.mouseWheel = { TO: 0, atext: null, count: 0 };
  }

  componentDidMount() {
    updateVersification(this);
  }

  componentDidUpdate() {
    updateVersification(this);
  }

  // A history item has the type HistoryTypeVK and only a single
  // verse selection for a chapter will be successively saved in
  // history. If add is supplied, its v11n must be the same as
  // windowV11n or nothing will be recorded. The history entry
  // will be recorded at the current historyIndex, and the history
  // array size will be limited to maxHistoryMenuLength.
  addHistory = (add?: HistoryTypeVK): void => {
    const {
      book,
      chapter,
      verse,
      selection,
      windowV11n,
      history,
      historyIndex,
    } = this.state as XulswordState;
    if (!book || !windowV11n || (add && add.v11n !== windowV11n)) return;
    const newhist: HistoryTypeVK = add || {
      book,
      chapter,
      verse,
      v11n: windowV11n,
      selection,
    };
    // Don't record multiple entries for the same chapter, and convert vlln
    // before comparing so duplicate history is not recorded when v11nmod
    // switches to a different module with a different v11n.
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
    this.setState((prevState: XulswordState) => {
      prevState.history.splice(prevState.historyIndex, 0, newhist);
      if (prevState.history.length > C.UI.Xulsword.maxHistoryMenuLength) {
        prevState.history.pop();
      }
      return { history: prevState.history };
    });
  };

  // Set scripture location state to a particular history index. Also, if
  // promote is true, move that history entry to history[0].
  setHistory = (index: number, promote = false): void => {
    const { history: h } = this.state as XulswordState;
    if (
      index < 0 ||
      index > h.length - 1 ||
      index > C.UI.Xulsword.maxHistoryMenuLength
    )
      return;
    this.setState((prevState: XulswordState) => {
      const { history, windowV11n, flagScroll } = prevState as XulswordState;
      if (!windowV11n) return null;
      // To update state to a history index without changing the selected
      // modules, history needs to be converted to the current windowV11n.
      let { book, chapter, verse, selection } = history[index];
      const { v11n } = history[index];
      const [bks, chs, vss] = G.LibSword.convertLocation(
        v11n,
        [book, chapter, verse].join('.'),
        windowV11n
      ).split('.');
      book = bks;
      chapter = Number(chs);
      verse = Number(vss);
      selection = G.LibSword.convertLocation(v11n, selection, windowV11n);
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
        selection,
        flagScroll: flagScroll.map(() => C.VSCROLL.center),
      };
    });
  };

  // Build and return a history menupopup from state.
  historyMenu = (state: XulswordState) => {
    const { history, historyIndex, windowV11n } = state;
    let is = historyIndex - Math.round(C.UI.Xulsword.maxHistoryMenuLength / 2);
    if (is < 0) is = 0;
    let ie = is + C.UI.Xulsword.maxHistoryMenuLength;
    if (ie > history.length) ie = history.length;
    const items = history.slice(is, ie);
    if (!items || !items.length) return null;
    return (
      <Menupopup>
        {items.map((histitem, i) => {
          const { book: bk, chapter: ch, verse: vs, v11n } = histitem;
          const [bks, chs, vss] = G.LibSword.convertLocation(
            v11n,
            [bk, ch, vs].join('.'),
            windowV11n
          ).split('.');
          const location = [bks, chs, vss];
          if (vss === '1') location.pop();
          // Verse comes from verse or selection; lastverse comes from selection.
          if (histitem.selection) {
            const [b, c, v, l] = G.LibSword.convertLocation(
              v11n,
              histitem.selection,
              windowV11n
            ).split('.');
            if (bks === b && chs === c && Number(v) > 1) {
              location[2] = v;
              if (!Number.isNaN(Number(l)) && v !== l) location[3] = l;
            }
          }
          const index = i + is;
          const selected = index === historyIndex ? 'selected' : '';
          return (
            <div
              key={[selected, index, histitem].join('.')}
              className={selected}
              onClick={(e) => {
                this.setHistory(index, true);
                e.stopPropagation();
              }}
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
    const props = this.props as XulswordProps;
    const { handler, viewportParentHandler, lastStatePref } = this;
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
      panels,
      ilModules,
      mtModules,
      keys,
      selection,
      flagScroll,
      isPinned,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      bsreset,
      vpreset,
      windowV11n,
    } = state;
    const { id } = props;

    if (id && setPrefFromState(id, state, lastStatePref, notStatePref)) {
      G.setGlobalStateFromPref(
        null,
        ['book', 'chapter', 'verse', 'selection', 'flagScroll'].map((p) => {
          return `${id}.${p}`;
        })
      );
    }

    // Add page to history after a short delay
    if (windowV11n) {
      if (this.historyTO) clearTimeout(this.historyTO);
      this.historyTO = setTimeout(() => {
        return this.addHistory();
      }, 1000);
    }

    const navdisabled =
      !windowV11n || isPinned.every((p, i) => p || !panels[i]);

    const short = true;
    console.log(
      `Rendering Xulsword ${JSON.stringify({
        ...state,
        history: history.length,
        tabs: short ? 'not_printed' : tabs,
        show: short ? 'not_printed' : show,
        place: short ? 'not_printed' : place,
        historyMenupopup: !!historyMenupopup,
        windowV11n,
      })}`
    );

    return (
      <Translation>
        {(t) => (
          <Vbox
            {...addClass('xulsword', props)}
            {...topHandle('onClick', () => closeMenupopups(this), props)}
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
                parentHandler={viewportParentHandler}
                book={book}
                chapter={chapter}
                verse={verse}
                selection={selection}
                tabs={tabs}
                panels={panels}
                ilModules={ilModules}
                mtModules={mtModules}
                show={show}
                place={place}
                keys={keys}
                flagScroll={flagScroll}
                isPinned={isPinned}
                noteBoxHeight={noteBoxHeight}
                maximizeNoteBox={maximizeNoteBox}
                showChooser={showChooser}
                ownWindow={false}
                windowV11n={windowV11n}
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
  window.ipc.renderer.send('window', 'did-finish-render');
  setTimeout(() => {
    window.ipc.renderer.send('window', 'move-to-back');
  }, 100);
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

window.ipc.renderer.on('close', () => unloadXUL());
