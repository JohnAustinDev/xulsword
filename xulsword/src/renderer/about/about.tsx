import React from 'react';
import { render } from 'react-dom';
import { Label, Stack, Vbox, Hbox } from '../xul';
import './about.global.css';

render(
  <Vbox id="mainbox" flex="1">
    <Stack flex="1">
      <Vbox id="layer1" flex="1" width="500" height="375" />
      <Vbox id="layer2" flex="1" width="500" height="375" pack="end">
        <Hbox align="center">
          <Vbox flex="1" pack="start" align="center">
            <Label class="splash-text" value="Welcome to xulsword!" />
          </Vbox>
        </Hbox>
      </Vbox>
    </Stack>
  </Vbox>,
  document.getElementById('root')
);
