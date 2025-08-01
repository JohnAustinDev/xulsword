import React from 'react';
import { Icon } from '@blueprintjs/core';
import Subscription from '../../../subscription.ts';
import { clone, stringHash } from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import log from '../../log.ts';
import RenderPromise from '../../renderPromise.ts';
import {
  dString,
  registerUpdateStateFromPref,
  getStatePref,
  clearPending,
  setStatePref,
  syncChildrensBibles,
  doUntilDone,
  isIBTChildrensBible,
  chooserGenbks,
  audioSelections,
} from '../../common.tsx';
import {
  addClass,
  delayHandler,
  topHandle,
  xulPropTypes,
} from '../libxul/xul.tsx';
import Button, { AnchorButton } from '../libxul/button.tsx';
import { Box, Hbox, Vbox } from '../libxul/boxes.tsx';
import Bookselect from '../libxul/bookselect.tsx';
import Spacer from '../libxul/spacer.tsx';
import Textbox from '../libxul/textbox.tsx';
import SelectOR from '../libxul/selectOR.tsx';
import SelectVK from '../libxul/selectVK.tsx';
import Menulist from '../libxul/menulist.tsx';
import AudioPlayer from '../audioPlayer/audioPlayer.tsx';
import Viewport from '../viewport/viewport.tsx';
import viewportParentH, {
  closeMenupopups,
  bbDragEnd as bbDragEndH,
} from '../viewport/viewportParentH.ts';
import handlerH from './xulswordH.ts';
import {
  addHistory as addHistoryH,
  setHistory as setHistoryH,
  historyMenu as historyMenuH,
} from './history.tsx';
import './xulsword.css';

import type { BibleBrowserControllerGlobal } from '../../webapp/bibleBrowser/bibleBrowser.tsx';
import type {
  AudioPlayerSelectionGB,
  AudioPlayerSelectionVK,
  OSISBookType,
  XulswordStateArgType,
} from '../../../type.ts';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type S from '../../../defaultPrefs.ts';
import type Atext from '../atext/atext.tsx';
import type { XulProps } from '../libxul/xul.tsx';
import type { SelectORMType } from '../libxul/selectOR.tsx';
import type { SelectVKType } from '../libxul/selectVK.tsx';

const propTypes = {
  ...xulPropTypes,
};

export type XulswordProps = XulProps;

// The following state keys are never read from Prefs. Neither are
// they written to Prefs.
const notStatePrefDefault = {
  historyMenupopup: undefined as React.JSX.Element | undefined,
  bsreset: 0,
  vpreset: 0,
  searchDisabled: true,
};

export type XulswordState = typeof notStatePrefDefault &
  typeof S.prefs.xulsword &
  RenderPromiseState;

export default class Xulsword
  extends React.Component
  implements RenderPromiseComponent
{
  static propTypes: typeof propTypes;

  handler: any;

  viewportParentHandler: any;

  bbDragEnd: (e: React.MouseEvent, value: any) => void;

  addHistory: typeof addHistoryH;

  setHistory: typeof setHistoryH;

  historyMenu: typeof historyMenuH;

  historyTO: NodeJS.Timeout | undefined;

  dictkeydownTO: NodeJS.Timeout | undefined;

  wheelScrollTO: NodeJS.Timeout | undefined;

  destroy: Array<() => void>;

  atextRefs: Array<React.RefObject<Atext>>;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLElement>;

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
    this.selectionGenbk = this.selectionGenbk.bind(this);
    this.selectionVK = this.selectionVK.bind(this);
    this.xulswordStateHandler = this.xulswordStateHandler.bind(this);
    this.addHistory = addHistoryH.bind(this);
    this.setHistory = setHistoryH.bind(this);
    this.historyMenu = historyMenuH.bind(this);

    this.destroy = [];

    this.atextRefs = [];

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);
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

    if (Build.isWebApp) {
      doUntilDone((renderPromise2) => {
        const { keys: prevkeys } = prevState;
        const { panels, keys } = this.state as XulswordState;
        const keys2 = syncChildrensBibles(
          panels,
          prevkeys,
          keys,
          renderPromise2,
        );
        if (
          !renderPromise2?.waiting() &&
          stringHash(keys) !== stringHash(keys2)
        ) {
          if (Build.isDevelopment) {
            log.debug(`xulsword componentDidUpdate setState:`, { keys: keys2 });
          }
          this.setState({ keys: keys2 } as XulswordState);
        }
      });
    }

    if (!scroll?.skipWindowUpdate) {
      const statex = clone({ ...state, historyMenupopup: undefined });
      setStatePref('prefs', 'xulsword', prevState, statex);
      // Add page to history after a short delay
      const { location } = state;
      if (location) {
        delayHandler(
          this,
          () => this.addHistory(),
          [],
          C.UI.Xulsword.historyDelay,
          'historyTO',
        );
      }
    }
    renderPromise.dispatch();
  }

  componentWillUnmount() {
    clearPending(this, ['historyTO', 'dictkeydownTO', 'wheelScrollTO']);
    this.destroy.forEach((func) => {
      func();
    });
    this.destroy = [];
  }

  selectionGenbk(selection: SelectORMType | undefined, _id?: string): void {
    if (selection) {
      const { panels } = this.state as XulswordState;
      const { otherMod, keys: newkey } = selection;
      const panelIndex = panels.indexOf(otherMod);
      if (panelIndex !== -1) {
        this.setState((prevState: XulswordState) => {
          let { keys } = prevState;
          keys = [...keys];
          [keys[panelIndex]] = newkey;
          return { keys } as XulswordState;
        });
      }
    }
  }

  selectionVK(selection: SelectVKType | undefined): void {
    if (selection) this.setState({ location: selection });
  }

  xulswordStateHandler(s: XulswordStateArgType): void {
    if (Build.isDevelopment) {
      log.debug(`xulswordStateHandler setState:`, s);
    }
    this.setState(s);
  }

  render() {
    const state = this.state as XulswordState;
    const props = this.props as XulswordProps;
    const {
      loadingRef,
      handler,
      viewportParentHandler,
      renderPromise,
      bbDragEnd,
      selectionGenbk,
      selectionVK,
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
    const bookset = new Set<OSISBookType>();
    panels.forEach((m, i) => {
      if (m && !isPinned[i] && G.Tab[m].isVerseKey) {
        GI.getBooksInVKModule(
          G.Books().map((b) => b.code),
          renderPromise,
          m,
        ).forEach((bk) => bookset.add(bk));
      }
    });
    const Book = G.Book(G.i18n.language);
    const booklist = [...bookset].sort((a: OSISBookType, b: OSISBookType) => {
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

    const vkMod = panels.find((p) => p && G.Tab[p].isVerseKey) ?? undefined;

    const left =
      GI.i18n.t('ltr', renderPromise, 'locale_direction') === 'ltr'
        ? 'left'
        : 'right';
    const right =
      GI.i18n.t('ltr', renderPromise, 'locale_direction') !== 'ltr'
        ? 'left'
        : 'right';

    const historyComponent = (
      <Hbox id="historyButtons" pack="start" align="center">
        <Box
          flex="1"
          title={GI.i18n.t('', renderPromise, 'history.back.tooltip')}
        >
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
        <Box
          flex="1"
          title={GI.i18n.t('', renderPromise, 'history.forward.tooltip')}
        >
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
    );

    const audioComponent = (
      <Hbox id="player" pack="start" align="center">
        <Vbox flex="3">
          <AudioPlayer
            audio={audio}
            audioHandler={handler}
            renderPromise={renderPromise}
          />
        </Vbox>
        <Button
          id="closeplayer"
          className="narrow-screen-hide"
          onClick={handler}
        >
          {GI.i18n.t('', renderPromise, 'close.label')}
        </Button>
      </Hbox>
    );

    const searchComponent = (
      <>
        <Textbox
          id="xsSearchText"
          type="search"
          maxLength="24"
          onChange={handler}
          onKeyUp={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
              const b = document.getElementById('xsSearchButton');
              if (b) b.click();
            }
          }}
          title={GI.i18n.t('', renderPromise, 'searchbox.tooltip')}
        />
        <Box title={GI.i18n.t('', renderPromise, 'search.tooltip')}>
          <Button
            id="xsSearchButton"
            icon="search"
            disabled={searchDisabled}
            onClick={handler}
          >
            {GI.i18n.t('', renderPromise, 'menu.search')}
          </Button>
        </Box>
      </>
    );

    const chooserMenuButton = (
      <Button
        id="choosermenu"
        checked={showChooser}
        icon={
          <Icon icon={showChooser ? 'menu-closed' : 'menu-open'} size={28} />
        }
        onClick={handler}
        title={GI.i18n.t(
          '',
          renderPromise,
          'Show or hide the verse chooser tool.',
          { ns: 'bibleBrowser' },
        )}
      />
    );

    const optionButtons = (
      <Hbox id="optionButtons" align="start">
        {Build.isWebApp && (
          <Button
            id="printPassage"
            disabled={!panels.find((m) => m && G.Tab[m].type == C.BIBLE)}
            icon={<Icon icon="print" />}
            onClick={() => {
              setStatePref('prefs', 'printPassage', null, {
                chapters: { ...location, vkMod },
              });
              Subscription.publish.setControllerState({
                card: { name: 'printPassage', props: {} },
              });
            }}
            title={GI.i18n.t('', renderPromise, 'menu.printPassage')}
          />
        )}
        {(window as BibleBrowserControllerGlobal).browserMaxPanels && (
          <>
            <Button
              id="addcolumn"
              disabled={panels.length >= (window as any).browserMaxPanels}
              icon={<Icon icon="add-column-right" />}
              onClick={handler}
              title={GI.i18n.t(
                '',
                renderPromise,
                'Add another column of text.',
                { ns: 'bibleBrowser' },
              )}
            />
            <Button
              id="removecolumn"
              disabled={panels.length <= 1}
              icon={<Icon icon="remove-column-right" />}
              onClick={handler}
              title={GI.i18n.t('', renderPromise, 'Remove a column of text.', {
                ns: 'bibleBrowser',
              })}
            />
          </>
        )}
        <Button
          id="headings"
          checked={show.headings}
          icon={<Icon icon="widget-header" />}
          onClick={handler}
          title={GI.i18n.t('', renderPromise, 'headingsButton.tooltip')}
          disabled={!panels.find((m) => m && G.Tab[m].type == C.BIBLE)}
        />
        <Button
          id="dictlinks"
          checked={show.dictlinks}
          icon={<Icon icon="search-template" />}
          onClick={handler}
          title={GI.i18n.t('', renderPromise, 'dictButton.tooltip')}
          disabled={
            !panels.find(
              (m) => m && [C.BIBLE, C.DICTIONARY].includes(G.Tab[m].type),
            )
          }
        />
        <Button
          id="footnotes"
          checked={show.footnotes}
          icon={<Icon icon="manually-entered-data" />}
          onClick={handler}
          title={GI.i18n.t('', renderPromise, 'notesButton.tooltip')}
          disabled={!panels.find((m) => m && G.Tab[m].type == C.BIBLE)}
        />
        {Build.isElectronApp && (
          <Button
            id="crossrefs"
            checked={show.crossrefs}
            icon={<Icon icon="link" />}
            onClick={handler}
            title={GI.i18n.t('', renderPromise, 'crossrefsButton.tooltip')}
            disabled={!panels.find((m) => m && G.Tab[m].type == C.BIBLE)}
          />
        )}
      </Hbox>
    );

    const webappGenbkSelectorComponent = (
      <Hbox pack="center">
        <Vbox id="genbknav" pack="center">
          {chooserGenbks(panels).map((ga) => {
            const [i] = ga;
            const m = panels[i];
            if (m && m in G.Tab && G.Tab[m].tabType === 'Genbks') {
              const isCB = isIBTChildrensBible(m, renderPromise);
              // Since CBs sync together, only the first CB selector is ever shown.
              let hasPrevCB = false;
              for (let x = 0; x < i; x++) {
                const px = panels[x];
                if (px && isIBTChildrensBible(px, renderPromise))
                  hasPrevCB = true;
              }
              if (i === 0 || !isCB || !hasPrevCB) {
                return (
                  <SelectOR
                    flex="1"
                    key={[m, keys[i]].join('.')}
                    otherMods={[m]}
                    initialORM={{
                      otherMod: m,
                      keys: [keys[i] || ''],
                    }}
                    enableMultipleSelection={false}
                    enableParentSelection={!isCB} // CB's don't have introductions
                    onSelection={selectionGenbk}
                  />
                );
              }
            }
            return null;
          })}
        </Vbox>
      </Hbox>
    );

    const webappVKSelectorComponent = (
      <Hbox pack="center">
        <Hbox id="textnav">
          <SelectVK
            id="book"
            flex="1"
            options={{
              verses: [],
              lastchapters: [],
              lastverses: [],
              vkMods: [vkMod],
            }}
            initialVK={{ ...location, vkMod }}
            disabled={location === null}
            onSelection={selectionVK}
            key={[stringHash(location), vkMod, bsreset].join('.')}
          />
        </Hbox>
      </Hbox>
    );

    const appNavigatorToolComponent = (
      <Vbox id="navigator-tool" pack="start">
        {historyComponent}

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
            value={location?.chapter ? dString(location.chapter) : ''}
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
            value={location?.verse ? dString(location.verse) : ''}
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
    );

    const appSearchTool = (
      <>
        {audio.open && audioComponent}
        {!audio.open && (
          <Hbox id="search-tool">
            <Vbox pack="start" align="center">
              {searchComponent}
            </Vbox>
          </Hbox>
        )}
      </>
    );

    this.atextRefs = [];
    panels.forEach(() => {
      this.atextRefs.push(React.createRef());
    });

    return (
      <Vbox
        domref={loadingRef}
        {...addClass('xulsword', props)}
        pack="start"
        {...topHandle(
          'onClick',
          () => {
            closeMenupopups(this);
          },
          props,
        )}
      >
        {Build.isWebApp && (
          <Hbox id="controls" pack="center" className="skin">
            <Spacer flex="1" />
            <Vbox id="control-rows">
              <Hbox pack="center">
                {historyComponent}
                <Spacer flex="1" className="narrow-screen-hide" />
              </Hbox>

              <Hbox id="main-controlbar" pack="center" align="start">
                {chooserMenuButton}

                {vkMod && webappVKSelectorComponent}

                {panels.find(
                  (m) => m && m in G.Tab && G.Tab[m].tabType === 'Genbks',
                ) && webappGenbkSelectorComponent}

                <Spacer flex="1" />

                <Hbox>{searchComponent}</Hbox>

                <Hbox pack="center">{optionButtons}</Hbox>
              </Hbox>

              {audio.open && (
                <Hbox pack="center">
                  {audioComponent}
                  <Spacer flex="1" className="narrow-screen-hide" />
                </Hbox>
              )}
            </Vbox>
            <Spacer flex="1" />
          </Hbox>
        )}

        {Build.isElectronApp && (
          <Hbox
            id="main-controlbar"
            pack="start"
            align="center"
            className="controlbar skin"
          >
            <Spacer className="start-spacer" />

            {appNavigatorToolComponent}

            <Spacer flex="1" style={{ minWidth: '15px' }} />

            {appSearchTool}

            <Spacer flex="1" style={{ minWidth: '10px' }} />

            <Hbox pack="center">{optionButtons}</Hbox>

            <Spacer flex="1" style={{ minWidth: '10px' }} />
          </Hbox>
        )}

        <Hbox pack="start" flex="1">
          <Viewport
            key={viewportReset.join('.')}
            id="main-viewport"
            location={location}
            selection={selection}
            audio={audio}
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
            atextRefs={this.atextRefs}
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
