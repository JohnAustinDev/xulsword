/* eslint-disable prettier/prettier */
import React from 'react';
import { render } from 'react-dom';
import { Translation } from 'react-i18next';
import i18nInit from '../i18n';
import { Hbox, Vbox } from '../libxul/boxes';
import Label from '../libxul/label';
import Stack from '../libxul/stack';
import { jsdump } from '../rutil';
import '../about/about.css';

i18nInit(['xulsword']).then(() =>
render(
  <Translation>
    {(t) => (
      <Vbox id="mainbox" flex="1">
        <Stack flex="1">
          <Vbox id="layer1" flex="1" width="500" height="375" />
          <Vbox id="layer2" flex="1" width="500" height="375" pack="end">
            <Hbox align="center">
              <Vbox flex="1" pack="start" align="center">
                <Label className="splash-text" value={t('producedBy')} />
              </Vbox>
            </Hbox>
          </Vbox>
        </Stack>
      </Vbox>
    )}
  </Translation>,
  document.getElementById('root')
)).catch((e: string | Error) => jsdump(e));
