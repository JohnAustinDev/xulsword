/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import { Translation } from 'react-i18next';
import {
  convertDotString,
  dosString2LocaleString,
  dotStringLoc2ObjectLoc,
  jsdump,
} from '../rutil';
import Button from '../libxul/button';
import { Hbox, Vbox } from '../libxul/boxes';
import Menupopup from '../libxul/menupopup';
import Bookselect from '../libxul/bookselect';
import Spacer from '../libxul/spacer';
import Textbox from '../libxul/textbox';
import Toolbox from '../libxul/toolbox';
import Viewport from '../viewport/viewport';
import G from '../gr';
import { xulswordHandler, handleViewport as handleVP } from './handlers';
import './xulsword.css';

interface XulswordState {
  book: string;
  chapter: number;
  verse: number;
  lastverse: number;

  historyMenupopup: React.ReactNode | undefined;
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

  searchDisabled: boolean;

  tabs: string[][];
  modules: string[];
  keys: string[];

  chooser: string;
  numDisplayedWindows: number;

  bsreset: number; // increment this to re-instantiate the Bookselect
}

export class Xulsword extends React.Component {
  handler: any;

  handleViewport: any;

  historyTO: NodeJS.Timeout | undefined;

  constructor(props: Record<string, never>) {
    super(props);
    this.state = {
      book: 'Gen',
      chapter: 1,
      verse: 1,
      lastverse: 1,

      historyMenupopup: undefined,
      history: [],
      historyIndex: 0,

      showHeadings: true,
      showFootnotes: true,
      showCrossRefs: true,
      showDictLinks: true,

      searchDisabled: true,

      tabs: [['KJV'], ['KJV'], ['KJV']],
      modules: ['KJV', 'KJV', 'KJV'],
      keys: [null, null, null],

      chooser: 'bible', // bible, genbook, or none
      numDisplayedWindows: 3,

      bsreset: 0,
    };

    this.historyMenu = this.historyMenu.bind(this);
    this.addHistory = this.addHistory.bind(this);
    this.setHistory = this.setHistory.bind(this);
    this.closeMenupopups = this.closeMenupopups.bind(this);

    this.handler = xulswordHandler.bind(this);
    this.handleViewport = handleVP.bind(this);
  }

  historyMenu = () => {
    const state = this.state as XulswordState;
    const maxMenuLength = 20;
    let is = state.historyIndex - Math.round(maxMenuLength / 2);
    if (is < 0) is = 0;
    let ie = is + maxMenuLength;
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
                this.setHistory(index);
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
      return { history: prevState.history };
    });
  };

  setHistory = (newIndex: number): void => {
    const { history } = this.state as XulswordState;
    if (newIndex < 0 || newIndex > history.length - 1) return;
    this.setState((prevState: XulswordState) => {
      const newLocation = convertDotString(
        prevState.history[newIndex],
        G.LibSword.getVerseSystem(prevState.modules[0])
      );
      const { book, chapter, verse, lastverse } =
        dotStringLoc2ObjectLoc(newLocation);
      return {
        historyIndex: newIndex,
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
    jsdump(`Rendering Xulsword ${JSON.stringify(this.state)}`);
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
      numDisplayedWindows,
      chooser,
      bsreset,
    } = this.state as XulswordState;

    const { handler, handleViewport } = this;

    // Add page to history after a short delay
    if (this.historyTO) clearTimeout(this.historyTO);
    this.historyTO = setTimeout(() => {
      this.addHistory();
    }, 1000);

    return (
      <Translation>
        {(t) => (
          <Vbox
            id="topbox"
            className="hasBible"
            pack="start"
            height="100%"
            onClick={this.closeMenupopups}
          >
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

export function loadedXUL() {
  jsdump('RUNNING loadedXUL()!');
}

export function unloadXUL() {
  jsdump('RUNNING unloadXUL()!');
}
