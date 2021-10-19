/* eslint-disable prettier/prettier */
import React from 'react';
import { render } from 'react-dom';
import { Translation } from 'react-i18next';
import i18nInit from '../i18n';
import Hbox from '../libxul/hbox/hbox';
import Label from '../libxul/label/label';
import Stack from '../libxul/stack/stack';
import Vbox from '../libxul/vbox/vbox';
import { jsdump } from '../../common0';
import '../about/about.css';

document.getElementsByTagName('body')[0].className = 'splash';

i18nInit(['startup/startup']).then(() =>
render(
  <Translation>
    {(t, {i18n}) => (
      <Vbox lang={i18n.language} id="mainbox" flex="1">
        <Stack flex="1">
          <Vbox id="layer1" flex="1" width="500" height="375" />
          <Vbox id="layer2" flex="1" width="500" height="375" pack="end">
            <Hbox align="center">
              <Vbox flex="1" pack="start" align="center">
                <Label className="splash-text" value={t('producedby')} />
              </Vbox>
            </Hbox>
          </Vbox>
        </Stack>
      </Vbox>
    )}
  </Translation>,
  document.getElementById('root')
)).catch((e: string | Error) => jsdump(e));
