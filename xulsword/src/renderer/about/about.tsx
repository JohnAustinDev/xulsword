import React from 'react';
import { render } from 'react-dom';
import { Translation } from 'react-i18next';
import { Label, Stack, Vbox, Hbox } from '../xul';
import i18n from '../i18n';
import './about.global.css';
import * as C from '../../constants';

const R = window.ipc.renderer;

const lng = R.sendSync('prefs', 'getCharPref', C.LOCALEPREF);

const namespaces = ['startup/startup'];
i18n.setDefaultNamespace(namespaces[0]);
i18n
  .loadNamespaces(namespaces)
  .then(() => {
    i18n.changeLanguage(lng);
    return true;
  })
  .then(() => {
    render(
      <Translation i18n={i18n}>
        {(t) => (
          <Vbox lang={lng} id="mainbox" flex="1">
            <Stack flex="1">
              <Vbox id="layer1" flex="1" width="500" height="375" />
              <Vbox id="layer2" flex="1" width="500" height="375" pack="end">
                <Hbox align="center">
                  <Vbox flex="1" pack="start" align="center">
                    <Label class="splash-text" value={t('producedby')} />
                  </Vbox>
                </Hbox>
              </Vbox>
            </Stack>
          </Vbox>
        )}
      </Translation>,
      document.getElementById('root')
    );
    return true;
  })
  .catch((e) => R.send('jsdump', e));
