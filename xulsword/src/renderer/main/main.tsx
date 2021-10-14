/* eslint-disable prettier/prettier */
import React from 'react';
import { render } from 'react-dom';
import { Translation } from 'react-i18next';
import i18nInit from '../i18n';
import { Label, Stack, Vbox, Hbox } from '../xul';
import { jsdump } from '../../common0';
import './main.css';

document.getElementsByTagName('body')[0].className = 'main';

i18nInit(['startup/startup']).then(() =>
render(
  <Translation>
    {(t, {i18n}) => (
      <Vbox lang={i18n.language}/>
    )}
  </Translation>,
  document.getElementById('root')
)).catch((e: string | Error) => jsdump(e));
