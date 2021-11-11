/* eslint-disable jsx-a11y/media-has-caption */
/* eslint-disable prettier/prettier */
import React from 'react';
import { Translation } from 'react-i18next';
import { jsdump } from '../rutil';
import Button from '../libxul/button';
import { Hbox, Vbox } from '../libxul/boxes';
import Menupopup from '../libxul/menupopup';
import Bookselect from '../libxul/bookselect';
import Spacer from '../libxul/spacer';
import Textbox from '../libxul/textbox';
import Toolbox from '../libxul/toolbox';
import Viewport from '../viewport/viewport';
import { xulswordHandler, handleViewport as handleVP } from './handlers';
import './xulsword.css';

interface XulswordState {
  book: string,
  chapter: number,
  verse: number,
  lastverse: number,

  showHeadings: boolean,
  showFootnotes: boolean,
  showCrossRefs: boolean,
  showDictLinks: boolean,
  showVerseNums: boolean,
  showStrongs: boolean,
  showMorph: boolean,
  showUserNotes: boolean,
  showHebCantillation: boolean,
  showHebVowelPoints: boolean,
  showRedWords: boolean,

  searchDisabled: boolean,

  tabs: string[][],
  modules: string[],
  keys: string[],

  numDisplayedWindows: number,

  bsreset: number, // increment this to re-instantiate the Bookselect
}

export class Xulsword extends React.Component {
  handler: any;

  handleViewport: any;

  constructor(props: Record<string, never>) {
    super(props);
    this.state = {
      book: 'Gen',
      chapter: 1,
      verse: 1,
      lastverse: 1,
      showHeadings: true,
      showFootnotes: true,
      showCrossRefs: true,
      showDictLinks: true,

      searchDisabled: true,

      tabs: [['KJV'], ['KJV'], ['KJV']],
      modules: ['KJV', 'KJV', 'KJV'],
      keys: [null, null, null],

      numDisplayedWindows: 3,

      bsreset: 0,
    };

    this.handler = xulswordHandler.bind(this);
    this.handleViewport = handleVP.bind(this);
  }

  render() {
    jsdump(`Rendering Xulsword ${JSON.stringify(this.state)}`);
    const {
        book, chapter, verse, lastverse,
        showHeadings, showFootnotes, showCrossRefs, showDictLinks,
        searchDisabled, tabs, modules, keys, numDisplayedWindows,
        bsreset
    } = this.state as XulswordState;

    const { handler, handleViewport } = this;

    return (<Translation>{(t) => (
<Vbox className="hasBible" id="topbox" pack="start" height="100%">
  <Toolbox>

    {/* TODO: NEED TO ADD MENU */}

  </Toolbox>

  <Hbox id="main-controlbar" className="controlbar">

    <Spacer width="17px" orient="vertical"/>

    <Vbox id="navigator-tool" pack="start">
      <Hbox id="historyButtons" align="center" >
        <Button id="back" flex="40%" onClick={handler} label={t('history.back.label')} tooltip={t('history.back.tooltip')} />
        <Button id="historymenu" type="menu" tooltip={t('history.all.tooltip')} >
          <Menupopup id="historypopup" onPopupShowing={handler}/>
        </Button>
        <Button id="forward" dir="reverse" flex="40%" onClick={handler} label={t('history.forward.label')} tooltip={t('history.forward.tooltip')} />
      </Hbox>

      <Hbox id="player" pack="start" align="center" hidden>
        <audio controls onEnded={handler} onCanPlay={handler}/>
        <Button id="closeplayer" onClick={handler} label={t('closeCmd.label')} />
      </Hbox>

      <Hbox id="textnav" align="center">
        <Bookselect id="book" key={`bk${book}${bsreset}`} sizetopopup="none" flex="1" book={book} trans={t('configuration.default_modules')} onChange={handler} />
        <Textbox  id="chapter" key={`ch${chapter}`} width="50px" maxLength="3" pattern={/^[0-9]+$/} value={chapter.toString()} timeout="300" onChange={handler} onClick={handler}/>
        <Vbox width="28px">
          <Button id="nextchap" onClick={handler}/>
          <Button id="prevchap" onClick={handler}/>
        </Vbox>
        <Textbox  id="verse" key={`vs${verse}`} width="50px" maxLength="3" pattern={/^[0-9]+$/} value={ verse.toString() } timeout="300" onChange={handler} onClick={handler}/>
        <Vbox width="28px">
          <Button id="nextverse" onClick={handler}/>
          <Button id="prevverse" onClick={handler}/>
        </Vbox>
      </Hbox>
    </Vbox>

    <Spacer flex="14%"  orient="vertical"/>

    <Hbox id="search-tool">
      <Vbox>
        <Textbox id="searchText" type="search" maxLength="24" onChange={handler} onKeyDown={handler} tooltip={t('searchbox.tooltip')} />
        <Button id="searchButton" orient="horizontal" dir="reverse" disabled={searchDisabled} onClick={handler} label={t('searchBut.label')} tooltip={t('search.tooltip')} />
      </Vbox>
    </Hbox>

    <Spacer flex="14%"  orient="vertical"/>

    <Hbox id="optionButtons" align="start">
      <Button id="hdbutton" orient="vertical" checked={showHeadings} onClick={handler} label={t('headingsButton.label')}  tooltip={t('headingsButton.tooltip')} />
      <Button id="fnbutton" orient="vertical" checked={showFootnotes} onClick={handler} label={t('notesButton.label')}     tooltip={t('notesButton.tooltip')} />
      <Button id="crbutton" orient="vertical" checked={showCrossRefs} onClick={handler} label={t('crossrefsButton.label')} tooltip={t('crossrefsButton.tooltip')} />
      <Button id="dtbutton" orient="vertical" checked={showDictLinks} onClick={handler} label={t('dictButton.label')}      tooltip={t('dictButton.tooltip')} />
    </Hbox>

    <Spacer id="rightSpacer"  flex="72%" orient="vertical"/>

  </Hbox>

  <Hbox flex="1">
    <Viewport id="main-viewport"
      book={book} chapter={chapter} verse={verse} lastverse={lastverse} handler={handleViewport}
      tabs={tabs} modules={modules} keys={keys} numDisplayedWindows={numDisplayedWindows} />
  </Hbox>

</Vbox>)}</Translation>)
  }
}

export function loadedXUL() {
  jsdump('RUNNING loadedXUL()!');
}

export function unloadXUL() {
  jsdump('RUNNING unloadXUL()!');
}
