/* eslint-disable jsx-a11y/media-has-caption */
/* eslint-disable prettier/prettier */
import React from 'react';
import { render } from 'react-dom';
import { Translation } from 'react-i18next';
import i18nInit from '../i18n';
import Button from '../libxul/button';
import Deck from '../libxul/deck';
import { Hbox, Vbox } from '../libxul/boxes';
import Menupopup from '../libxul/menupopup';
import Referencedropdown from '../libxul/referenceddropdown';
import Spacer from '../libxul/spacer';
import Textbox from '../libxul/textbox';
import Toolbox from '../libxul/toolbox';
import { jsdump, setBodyClass } from '../../common0';
import { loadedXUL, unloadXUL } from './main.js';
import eventHandler from './eventHandler';
import './main.css';

setBodyClass('main');

interface XulswordState {
  hdbutton: boolean,
  fnbutton: boolean,
  crbutton: boolean,
  dtbutton: boolean,
}

class Xulsword extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hdbutton: true,
      fnbutton: true,
      crbutton: true,
      dtbutton: true,
    };
 //   this.handleToggleButton = this.handleToggleButton.bind(this);
  }

 /*

  handleToggleButton(buttonID: string) {
    const state = this.state as XulswordState;
    if (typeof state[buttonID as keyof XulswordState] === undefined) {
      throw Error(`Unexpected toggle button ID: ${buttonID}`);
    }
    this.setState((prevState) => {
      const v = prevState as XulswordState;
      return {[buttonID]: !v};
    });
  }
  */

  render() {
    const {hdbutton, fnbutton, crbutton, dtbutton} = this.state as XulswordState;

    return (
<Translation>
    {(t, {i18n}) => (
<Vbox className="hasBible" lang={i18n.language} id="topbox" flex="1">
  <Toolbox>

    {/* TODO: NEED TO ADD MENU */}

  </Toolbox>

  <Hbox id="main-controlbar" className="controlbar">

    <Spacer width="17px" orient="vertical"/>

    <Vbox id="navigator-tool" pack="start">
      <Hbox id="historyButtons" align="center" >
        <Button id="back" tooltip={t('history.back.tooltip')} label={t('history.back.label')} onClick={eventHandler} flex="40%"/>
        <Button id="historymenu" tooltip={t('history.all.tooltip')} type="menu">
          <Menupopup id="historypopup" onPopupShowing={eventHandler}/>
        </Button>
        <Button id="forward" tooltip={t('history.forward.tooltip')} label={t('history.forward.label')} onClick={eventHandler} dir="reverse" flex="40%"/>
      </Hbox>

      <Hbox id="player" flex="1" align="center" pack="start" hidden="true">
        <audio controls onEnded={eventHandler} onCanPlay={eventHandler}/>
        <Button id="closeplayer" label={t('closeCmd.label')} onClick={eventHandler}/>
      </Hbox>

      <Hbox id="textnav" align="center">
        <Referencedropdown className="hidechapter hideverse hidelastverse hideversion" id="book" sizetopopup="none" flex="1" />
        <Textbox  id="chapter" type="search" timeout="300" onKeyUp={eventHandler} onClick={eventHandler} width="35px" />
        <Vbox>
          <Button  id="nextchap" className="smallButtons" onClick={eventHandler}/>
          <Button  id="prevchap" className="smallButtons" onClick={eventHandler}/>
        </Vbox>
        <Textbox  id="verse" type="search" timeout="300" onKeyUp={eventHandler} onClick={eventHandler} width="35px"/>
        <Vbox>
          <Button  id="nextverse" className="smallButtons" onClick={eventHandler}/>
          <Button  id="prevverse" className="smallButtons" onClick={eventHandler}/>
        </Vbox>
      </Hbox>
    </Vbox>

    <Spacer flex="14%"  orient="vertical"/>

    <Hbox id="search-tool">
      <Vbox>
        <Textbox id="searchText" tooltip={t('searchbox.tooltip')} maxlength="24" onKeyUp={eventHandler}/>
        <Button id="searchButton" tooltip={t('search.tooltip')} label={t('searchBut.label')} onClick={eventHandler} dir="reverse" orient="horizontal" />
      </Vbox>
    </Hbox>

    <Spacer flex="14%"  orient="vertical"/>

    <Hbox id="optionButtons" hidden="false" align="start">
      <Button id="hdbutton" orient="vertical" onClick={eventHandler} checked={hdbutton} label={t('headingsButton.label')}  tooltip={t('headingsButton.tooltip')} />
      <Button id="fnbutton" orient="vertical" onClick={eventHandler} checked={fnbutton} label={t('notesButton.label')}     tooltip={t('notesButton.tooltip')} />
      <Button id="crbutton" orient="vertical" onClick={eventHandler} checked={crbutton} label={t('crossrefsButton.label')} tooltip={t('crossrefsButton.tooltip')} />
      <Button id="dtbutton" orient="vertical" onClick={eventHandler} checked={dtbutton} label={t('dictButton.label')}      tooltip={t('dictButton.tooltip')} />
    </Hbox>

    <Spacer id="rightSpacer"  flex="72%" orient="vertical"/>

  </Hbox>

  <Vbox flex="1">
    <Deck id="viewport-deck" flex="1">

      <Hbox className="bible" id="frameset" flex="1"> {/* class (was chooser attribute) may be set to "bible", "book", or "hide" */}
        <Vbox id="genBookChooser" pack="start" flex="1" align="end">
          <Spacer height="36"/>
          <Vbox id="genBookTree" flex="1">

            {/* TODO: NEED TO ADD GENBOOK TREE */}

          </Vbox>
          <Spacer height="22"/>
        </Vbox>
        <Vbox flex="1">
          {/* TODO: <iframe id="main-viewport" src="../viewport/viewport.html" title="viewport" /> */}
        </Vbox>
      </Hbox>
    </Deck>
  </Vbox>

</Vbox>
    )}
</Translation>)
  }
}

i18nInit(['xulsword']).then(() =>
render(
  <Xulsword />,
  document.getElementById('root')
))
.then(() => loadedXUL())
.catch((e: string | Error) => jsdump(e));

// window.ipc.renderer.on('resize', () => {if (ViewPort) ViewPort.resize()});

window.ipc.renderer.on('close', () => unloadXUL());
