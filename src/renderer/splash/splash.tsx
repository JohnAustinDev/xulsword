import React from 'react';
import i18n from 'i18next';
import G from '../rg';
import renderToRoot from '../renderer';
import { Hbox, Vbox } from '../libxul/boxes';
import Label from '../libxul/label';
import Stack from '../libxul/stack';
import './splash.css';

const overlay = G.inlineFile(
  `${G.Dirs.path.xsAsset}/splash-overlay-${i18n.language}.png`
);
const style = overlay ? (
  <style>
    {`html.${i18n.language} #layer2 {
        background-image: url(${overlay});
      }`}
  </style>
) : undefined;

renderToRoot(
  <Vbox id="mainbox" width="500" height="375">
    {style}
    <Stack flex="1">
      <Vbox id="layer1" flex="1" />
      <Vbox id="layer2" flex="1" pack="end">
        <Hbox align="center">
          <Vbox flex="1" pack="start" align="center">
            <Label
              className="splash-text"
              value={i18n.t('producedBy', { ns: 'branding' })}
            />
          </Vbox>
        </Hbox>
      </Vbox>
    </Stack>
  </Vbox>
);
