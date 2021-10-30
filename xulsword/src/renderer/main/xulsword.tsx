/* eslint-disable jsx-a11y/media-has-caption */
/* eslint-disable prettier/prettier */
import React from 'react';
import { Translation } from 'react-i18next';
import { jsdump } from '../rutil';
import Button from '../libxul/button';
import Deck from '../libxul/deck';
import { Hbox, Vbox } from '../libxul/boxes';
import Menupopup from '../libxul/menupopup';
import Bookselect from '../libxul/bookselect';
import Spacer from '../libxul/spacer';
import Textbox from '../libxul/textbox';
import Toolbox from '../libxul/toolbox';
import { XulProps } from '../libxul/xul';
import handler from './handler';
import './xulsword.css';

export class Xulsword extends React.Component {

  eHandler = handler;

  constructor(props: Record<string, never>) {
    super(props);
    this.state = {
      book: null,
      chapter: 1,
      verse: 1,
      lastverse: 1,
      hdbutton: true,
      fnbutton: true,
      crbutton: true,
      dtbutton: true,
      searchDisabled: true,
    };

    this.eHandler = this.eHandler.bind(this);
  }

  render() {
    jsdump(`Rendering Xulsword ${JSON.stringify(this.state)}`);
    const {
        book, chapter, verse, lastverse,
        hdbutton, fnbutton, crbutton, dtbutton,
        searchDisabled
    } = this.state as XulswordState;

    const {eHandler} = this;

    return (<Translation>{(t) => (
<Vbox className="hasBible" id="topbox" flex="1">
  <Toolbox>

    {/* TODO: NEED TO ADD MENU */}

  </Toolbox>

  <Hbox id="main-controlbar" className="controlbar">

    <Spacer width="17px" orient="vertical"/>

    <Vbox id="navigator-tool" pack="start">
      <Hbox id="historyButtons" align="center" >
        <Button id="back" flex="40%" onClick={eHandler} label={t('history.back.label')} tooltip={t('history.back.tooltip')} />
        <Button id="historymenu" type="menu" tooltip={t('history.all.tooltip')} >
          <Menupopup id="historypopup" onPopupShowing={eHandler}/>
        </Button>
        <Button id="forward" dir="reverse" flex="40%" onClick={eHandler} label={t('history.forward.label')} tooltip={t('history.forward.tooltip')} />
      </Hbox>

      <Hbox id="player" pack="start" align="center" hidden>
        <audio controls onEnded={eHandler} onCanPlay={eHandler}/>
        <Button id="closeplayer" onClick={eHandler} label={t('closeCmd.label')} />
      </Hbox>

      <Hbox id="textnav" align="center">
        <Bookselect id="book" sizetopopup="none" flex="1" book={book} trans={t('configuration.default_modules')} onChange={eHandler} />
        <Textbox  id="chapter" width="50px" maxLength="3" pattern="^[0-9]+$" value={chapter.toString()} timeout="300" onChange={eHandler} onClick={eHandler}/>
        <Vbox width="28px">
          <Button id="nextchap" onClick={eHandler}/>
          <Button id="prevchap" onClick={eHandler}/>
        </Vbox>
        <Textbox  id="verse"   width="50px" maxLength="3" pattern="^[0-9]+$" value={ verse.toString() } timeout="300" onChange={eHandler} onClick={eHandler}/>
        <Vbox width="28px">
          <Button id="nextverse" onClick={eHandler}/>
          <Button id="prevverse" onClick={eHandler}/>
        </Vbox>
      </Hbox>
    </Vbox>

    <Spacer flex="14%"  orient="vertical"/>

    <Hbox id="search-tool">
      <Vbox>
        <Textbox id="searchText" type="search" maxLength="24" onChange={eHandler} tooltip={t('searchbox.tooltip')} />
        <Button id="searchButton" orient="horizontal" dir="reverse" disabled={searchDisabled} onClick={eHandler} label={t('searchBut.label')} tooltip={t('search.tooltip')} />
      </Vbox>
    </Hbox>

    <Spacer flex="14%"  orient="vertical"/>

    <Hbox id="optionButtons" align="start">
      <Button id="hdbutton" orient="vertical" checked={hdbutton} onClick={eHandler} label={t('headingsButton.label')}  tooltip={t('headingsButton.tooltip')} />
      <Button id="fnbutton" orient="vertical" checked={fnbutton} onClick={eHandler} label={t('notesButton.label')}     tooltip={t('notesButton.tooltip')} />
      <Button id="crbutton" orient="vertical" checked={crbutton} onClick={eHandler} label={t('crossrefsButton.label')} tooltip={t('crossrefsButton.tooltip')} />
      <Button id="dtbutton" orient="vertical" checked={dtbutton} onClick={eHandler} label={t('dictButton.label')}      tooltip={t('dictButton.tooltip')} />
    </Hbox>

    <Spacer id="rightSpacer"  flex="72%" orient="vertical"/>

  </Hbox>

  <Vbox flex="1">
    <Deck id="viewport-deck" flex="1">

      <Hbox className="bible" id="frameset" flex="1">{/* class (was chooser attribute) may be set to "bible", "book", or "hide" */}
        <Vbox id="genBookChooser" pack="start" flex="1" align="end">
          <Spacer height="36"/>
          <Vbox id="genBookTree" flex="1">

            {/* TODO: NEED TO ADD GENBOOK TREE */}

          </Vbox>
          <Spacer height="22"/>
        </Vbox>
        <Vbox flex="1">{ /*
          <iframe id="main-viewport" src="../viewport/viewport.html" title="viewport" /> */}
        </Vbox>
      </Hbox>
    </Deck>
  </Vbox>

</Vbox>)}</Translation>)
  }
}

interface XulswordState extends XulProps {
  book: string,
  chapter: number,
  verse: number,
  lastverse: number,
  hdbutton: boolean,
  fnbutton: boolean,
  crbutton: boolean,
  dtbutton: boolean,
  searchDisabled: boolean,
}

export function loadedXUL() {
  jsdump('RUNNING loadedXUL()!');
}

export function unloadXUL() {
  jsdump('RUNNING unloadXUL()!');
}
