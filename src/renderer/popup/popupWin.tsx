/* eslint-disable react/jsx-props-no-spreading */
/* eslint-disable react/static-property-placement */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/media-has-caption */
import React from 'react';
import { render } from 'react-dom';
import i18nInit from '../i18n';
import { jsdump } from '../rutil';
import Popup from './popup';
import '../global-htm.css';
import { Vbox } from '../libxul/boxes';

i18nInit(['xulsword'])
  .then(() =>
    render(
      <Vbox pack="start" height="100%">
        <Popup showelem={JSON.parse(window.shell.process.argv().pop())} />
      </Vbox>,
      document.getElementById('root')
    )
  )
  .then(() => window.ipc.renderer.send('did-finish-render'))
  .catch((e: string | Error) => jsdump(e));
