/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/media-has-caption */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
import React from 'react';
import { Icon } from '@blueprintjs/core';
import { dString, clone } from '../../../common.ts';
import C from '../../../constant.ts';
import S from '../../../defaultPrefs.ts';
import G, { GI } from '../../rg.ts';
import RenderPromise from '../../renderPromise.ts';
import { verseKey } from '../../htmlData.ts';
import {
  registerUpdateStateFromPref,
  getStatePref,
  clearPending,
  setStatePref,
} from '../../rutil.ts';
import {
  addClass,
  delayHandler,
  topHandle,
  XulProps,
  xulPropTypes,
} from '../../libxul/xul.tsx';
import Button, { AnchorButton } from '../../libxul/button.tsx';
import { Box, Hbox, Vbox } from '../../libxul/boxes.tsx';
import Menupopup from '../../libxul/menupopup.tsx';
import Bookselect from '../../libxul/bookselect.tsx';
import Spacer from '../../libxul/spacer.tsx';
import Textbox from '../../libxul/textbox.tsx';
import Viewport from '../viewport/viewport.tsx';
import viewportParentH, {
  closeMenupopups,
  bbDragEnd as bbDragEndH,
} from '../viewport/viewportParentH.ts';
import handlerH from './xulswordH.ts';
import './xulsword.css';

import type { HistoryVKType, XulswordStateArgType } from '../../../type.ts';
import type { RenderPromiseComponent, RenderPromiseState } from '../../renderPromise.ts';
import type Atext from '../atext/atext.tsx';

const propTypes = xulPropTypes;

export type XulswordProps = XulProps;

// The following state keys are never read from Prefs. Neither are
// they written to Prefs.
const notStatePrefDefault = {
  historyMenupopup: undefined,
  bsreset: 0,
  vpreset: 0,
  searchDisabled: true,
};

export type XulswordState = typeof notStatePrefDefault &
  typeof S.prefs.xulsword &
  RenderPromiseState;

export default class Xulsword extends React.Component implements RenderPromiseComponent{

  static propTypes: typeof propTypes;

  handler: any;

  viewportParentHandler: any;

  bbDragEnd: (e: React.MouseEvent, value: any) => void;

  historyTO: NodeJS.Timeout | undefined;

  dictkeydownTO: NodeJS.Timeout | undefined;

  wheelScrollTO: NodeJS.Timeout | undefined;

  destroy: (() => void)[];

  atextRefs: React.RefObject<Atext>[];

  renderPromise: RenderPromise;

  constructor(props: XulswordProps) {
    super(props);

    const s: XulswordState = {
      ...notStatePrefDefault,
      ...(getStatePref('prefs', 'xulsword') as typeof S.prefs.xulsword),
      renderPromiseID: 0,
    };
    this.state = s;

    this.handler = handlerH.bind(this);
    this.viewportParentHandler = viewportParentH.bind(this);
    this.bbDragEnd = bbDragEndH.bind(this);
    this.xulswordStateHandler = this.xulswordStateHandler.bind(this);

    this.destroy = [];

    this.atextRefs = [];
    s.panels.forEach(() => {
      this.atextRefs.push(React.createRef());
    });

    this.renderPromise = new RenderPromise(this);
  }

  componentDidMount() {
    const { renderPromise } = this;
    this.destroy.push(registerUpdateStateFromPref('prefs', 'xulsword', this));
    renderPromise.dispatch();
  }

  componentDidUpdate(_prevProps: XulswordProps, prevState: XulswordState) {
    const { renderPromise } = this;
    const state = this.state as XulswordState;
    const { scroll } = state;
    if (!scroll?.skipWindowUpdate) {
      const statex = clone(state);
      setStatePref('prefs', 'xulsword', prevState, statex);
      // Add page to history after a short delay
      const { location } = state;
      if (location) {
        delayHandler.bind(this)(
          () => {
            this.addHistory();
          },
          C.UI.Xulsword.historyDelay,
          'historyTO'
        )();
      }
    }
    renderPromise.dispatch();
  }

  componentWillUnmount() {
    clearPending(this, ['historyTO', 'dictkeydownTO', 'wheelScrollTO']);
    this.destroy.forEach((func) => func());
    this.destroy = [];
  }

  // A history item has the type HistoryTypeVK and only a single
  // verse selection for a chapter will be successively saved in
  // history. If add is supplied, its v11n must be the same as
  // current v11n or nothing will be recorded. The history entry
  // will be recorded at the current historyIndex, and the history
  // array size will be limited to maxHistoryMenuLength.
  addHistory = (add?: HistoryVKType): void => {
    const { location, selection, history, historyIndex } = this
      .state as XulswordState;
    const { renderPromise } = this;
    if (!location || (add && add.location.v11n !== location.v11n)) return;
    const newhist: HistoryVKType = add || {
      location,
      selection,
    };
    // Don't record multiple entries for the same chapter, and convert vlln
    // before comparing so duplicate history is not recorded when v11n
    // switches with a module having a different v11n.
    if (history[historyIndex]) {
      const locvk = verseKey(history[historyIndex].location, location.v11n, undefined, renderPromise);
      if (location.book === locvk.book && location.chapter === locvk.chapter)
        return;
    }
    this.setState((prevState: XulswordState) => {
      const newhistory = clone(prevState.history);
      newhistory.splice(prevState.historyIndex, 0, newhist);
      if (newhistory.length > C.UI.Xulsword.maxHistoryMenuLength) {
        newhistory.pop();
      }
      return { history: newhistory };
    });
  };

  // Set scripture location state to a particular history index. Also, if
  // promote is true, move that history entry to history[0].
  setHistory = (index: number, promote = false): void => {
    const { history: h } = this.state as XulswordState;
    const { renderPromise } = this;
    if (
      index < 0 ||
      index > h.length - 1 ||
      index > C.UI.Xulsword.maxHistoryMenuLength
    )
      return;
    this.setState((prevState: XulswordState) => {
      let ret: Partial<XulswordState> | null = null;
      const { history, location } = clone(prevState) as XulswordState;
      if (location) {
        // To update state to a history index without changing the selected
        // modules, history needs to be converted to the current v11n.
        const { location: hloc, selection: hsel } = history[index];
        const newloc = verseKey(hloc, location.v11n, undefined, renderPromise).location();
        const newsel = hsel
          ? verseKey(hsel, location.v11n, undefined, renderPromise).location()
          : null;
        if (promote) {
          const targ = history.splice(index, 1);
          history.splice(0, 0, targ[0]);
        }
        ret = {
          location: newloc,
          selection: newsel,
          scroll: { verseAt: 'center' },
          history,
          historyIndex: promote ? 0 : index,
          historyMenupopup: undefined,
        };
      }
      return ret;
    });
  };

  // Build and return a history menupopup from state.
  historyMenu = (state: XulswordState) => {
    const { history, historyIndex, location } = state;
    const { renderPromise } = this;
    let is = historyIndex - Math.round(C.UI.Xulsword.maxHistoryMenuLength / 2);
    if (is < 0) is = 0;
    let ie = is + C.UI.Xulsword.maxHistoryMenuLength;
    if (ie > history.length) ie = history.length;
    const items = history.slice(is, ie);
    if (!items || !items.length || !location) return null;
    return (
      <Menupopup>
        {items.map((histitem, i) => {
          const { location: hloc, selection: hsel } = histitem;
          const versekey = verseKey(hloc, location.v11n, undefined, renderPromise);
          if (versekey.verse === 1) {
            versekey.verse = undefined;
            versekey.lastverse = undefined;
          }
          // Verse comes from verse or selection; lastverse comes from selection.
          if (hsel && hsel.verse && hsel.verse > 1) {
            versekey.verse = hsel.verse;
            if (hsel.lastverse && hsel.lastverse > hsel.verse)
              versekey.lastverse = hsel.lastverse;
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
              {versekey.readable(G.i18n.language, null, true)}
            </div>
          );
        })}
      </Menupopup>
    );
  };

  xulswordStateHandler(s: XulswordStateArgType): void {
    this.setState(s);
  }

  render() {
    const state = this.state as XulswordState;
    const props = this.props as XulswordProps;
    const {
      atextRefs,
      handler,
      viewportParentHandler,
      renderPromise,
      bbDragEnd,
      xulswordStateHandler,
    } = this;
    const {
      location,
      selection,
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
      scroll,
      isPinned,
      noteBoxHeight,
      maximizeNoteBox,
      showChooser,
      bsreset,
      vpreset,
      audio,
    } = state;

    // Book options for Bookselect dropdown
    const bookset: Set<string> = new Set();
    panels.forEach((m, i) => {
      if (m && !isPinned[i] && G.Tab[m].isVerseKey) {
        G.getBooksInVKModule(m).forEach((bk) => bookset.add(bk));
      }
    });
    const Book = G.Book(G.i18n.language);
    const booklist = [...bookset].sort((a: string, b: string) => {
      if (Book[a].index < Book[b].index) return -1;
      if (Book[a].index > Book[b].index) return 1;
      return 0;
    });

    const navdisabled = !location || isPinned.every((p, i) => p || !panels[i]);

    const viewportReset: string[] = [
      vpreset.toString(),
      showChooser.toString(),
    ];
    panels.forEach((m) => {
      if (m === null) viewportReset.push('null');
      else if (!m) viewportReset.push('und');
      else viewportReset.push(m);
    });

    const left = GI.i18n.t('ltr', renderPromise, 'locale_direction') === 'ltr' ? 'left' : 'right';
    const right = GI.i18n.t('ltr', renderPromise, 'locale_direction') !== 'ltr' ? 'left' : 'right';

    return (
      <Vbox
        {...addClass('xulsword', props)}
        pack="start"
        height="100%"
        {...topHandle('onClick', () => closeMenupopups(this), props)}
      >
        <Hbox id="main-controlbar" pack="start" className="controlbar skin">
          <Spacer className="start-spacer" orient="vertical" />

          <Vbox id="navigator-tool" pack="start">
            {!audio.open && (
              <Hbox id="historyButtons" align="center">
                <Box flex="40%" title={GI.i18n.t('', renderPromise, 'history.back.tooltip')}>
                  <Button
                    id="back"
                    icon={`chevron-${left}`}
                    onClick={handler}
                    disabled={
                      navdisabled ||
                      !history.length ||
                      historyIndex === history.length - 1
                    }
                  >
                    {GI.i18n.t('', renderPromise, 'back.label')}
                  </Button>
                </Box>
                <Box title={GI.i18n.t('', renderPromise, 'history.all.tooltip')}>
                  <Button
                    id="historymenu"
                    icon={`double-chevron-${left}`}
                    rightIcon={`double-chevron-${right}`}
                    onClick={handler}
                    disabled={navdisabled || history.length <= 1}
                  >
                    {historyMenupopup || <span />}
                  </Button>
                </Box>
                <Box flex="40%" title={GI.i18n.t('', renderPromise, 'history.forward.tooltip')}>
                  <Button
                    id="forward"
                    rightIcon={`chevron-${right}`}
                    onClick={handler}
                    disabled={navdisabled || historyIndex === 0}
                  >
                    {GI.i18n.t('', renderPromise, 'history.forward.label')}
                  </Button>
                </Box>
              </Hbox>
            )}
            {audio.open && (
              <Hbox id="player" pack="start" align="center">
                <Vbox flex="3">
                  <div>
                    <audio
                      controls
                      onEnded={handler}
                      onCanPlay={handler}
                      src={
                        audio.file ? G.inlineAudioFile(audio.file) : undefined
                      }
                    />
                  </div>
                </Vbox>
                <Button id="closeplayer" flex="1" onClick={handler}>
                  {GI.i18n.t('', renderPromise, 'close.label')}
                </Button>
              </Hbox>
            )}

            <Hbox id="textnav" align="center">
              <Bookselect
                id="book"
                sizetopopup="none"
                flex="1"
                selection={location?.book}
                options={booklist}
                disabled={navdisabled}
                key={[location?.book, bsreset].join('.')}
                onChange={handler}
              />
              <Textbox
                id="chapter"
                width="50px"
                maxLength="3"
                pattern={/^[0-9]+$/}
                value={
                  location?.chapter ? dString(G.getLocaleDigits(), location.chapter, G.i18n.language) : ''
                }
                timeout="600"
                disabled={navdisabled}
                key={`c${location?.chapter}`}
                onChange={handler}
                onClick={handler}
              />
              <Vbox>
                <AnchorButton
                  id="nextchap"
                  disabled={navdisabled}
                  onClick={handler}
                />
                <AnchorButton
                  id="prevchap"
                  disabled={navdisabled}
                  onClick={handler}
                />
              </Vbox>
              <span>:</span>
              <Textbox
                id="verse"
                key={`v${location?.verse}`}
                width="50px"
                maxLength="3"
                pattern={/^[0-9]+$/}
                value={location?.verse ? dString(G.getLocaleDigits(), location.verse, G.i18n.language) : ''}
                timeout="600"
                disabled={navdisabled}
                onChange={handler}
                onClick={handler}
              />
              <Vbox>
                <AnchorButton
                  id="nextverse"
                  disabled={navdisabled}
                  onClick={handler}
                />
                <AnchorButton
                  id="prevverse"
                  disabled={navdisabled}
                  onClick={handler}
                />
              </Vbox>
            </Hbox>
          </Vbox>

          <Spacer flex="1" style={{ minWidth: '15px' }} orient="vertical" />

          <Hbox id="search-tool">
            <Vbox pack="start" align="center">
              <Textbox
                id="searchText"
                type="search"
                maxLength="24"
                onChange={handler}
                onKeyUp={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    const b = document.getElementById('searchButton');
                    if (b) b.click();
                  }
                }}
                title={GI.i18n.t('', renderPromise, 'searchbox.tooltip')}
              />
              <Box title={GI.i18n.t('', renderPromise, 'search.tooltip')}>
                <Button
                  id="searchButton"
                  icon="search"
                  disabled={searchDisabled}
                  onClick={handler}
                >
                  {GI.i18n.t('', renderPromise, 'menu.search')}
                </Button>
              </Box>
            </Vbox>
          </Hbox>

          <Spacer flex="1" style={{ minWidth: '10px' }} orient="vertical" />

          <Hbox id="optionButtons" align="start">
            {window.processR.platform === 'browser' && (<>
              <Button
                id="addcolumn"
                checked={true}
                icon={<Icon icon="add-column-right" size={28} />}
                onClick={handler}
              />
              <Button
                id="removecolumn"
                checked={true}
                icon={<Icon icon="remove-column-right" size={28} />}
                onClick={handler}
              /></>
            )}
            <Button
              id="headings"
              checked={show.headings}
              icon={<Icon icon="widget-header" size={28} />}
              onClick={handler}
              title={GI.i18n.t('', renderPromise, 'headingsButton.tooltip')}
            />
            <Button
              id="dictlinks"
              checked={show.dictlinks}
              icon={<Icon icon="search-template" size={28} />}
              onClick={handler}
              title={GI.i18n.t('', renderPromise, 'dictButton.tooltip')}
            />
            <Button
              id="footnotes"
              checked={show.footnotes}
              icon={<Icon icon="manually-entered-data" size={28} />}
              onClick={handler}
              title={GI.i18n.t('', renderPromise, 'notesButton.tooltip')}
            />
            <Button
              id="crossrefs"
              checked={show.crossrefs}
              icon={<Icon icon="link" size={28} />}
              onClick={handler}
              title={GI.i18n.t('', renderPromise, 'crossrefsButton.tooltip')}
            />
          </Hbox>

          <Spacer flex="1" style={{ minWidth: '10px' }} orient="vertical" />
        </Hbox>

        <Hbox pack="start" flex="1">
          <Viewport
            key={viewportReset.join('.')}
            id="main-viewport"
            location={location}
            selection={selection}
            tabs={tabs}
            panels={panels}
            ilModules={ilModules}
            mtModules={mtModules}
            show={show}
            place={place}
            keys={keys}
            scroll={scroll}
            isPinned={isPinned}
            noteBoxHeight={noteBoxHeight}
            maximizeNoteBox={maximizeNoteBox}
            showChooser={showChooser}
            ownWindow={false}
            atextRefs={atextRefs}
            eHandler={viewportParentHandler}
            bbDragEnd={bbDragEnd}
            xulswordStateHandler={xulswordStateHandler}
          />
        </Hbox>
      </Vbox>
    );
  }
}
Xulsword.propTypes = propTypes;
