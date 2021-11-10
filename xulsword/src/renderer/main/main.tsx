/* eslint-disable jsx-a11y/media-has-caption */
/* eslint-disable prettier/prettier */
import React from 'react';
import { render } from 'react-dom';
import { jsdump } from '../rutil';
import i18nInit from '../i18n';
import { Xulsword, loadedXUL, unloadXUL } from './xulsword';
import '../global-htm.css';

i18nInit(['xulsword']).then(() =>
render(
  <Xulsword />,
  document.getElementById('root')))
.then(() => loadedXUL())
.catch((e: string | Error) => jsdump(e));

// window.ipc.renderer.on('resize', () => {if (ViewPort) ViewPort.resize()});

window.ipc.renderer.on('close', () => unloadXUL());
