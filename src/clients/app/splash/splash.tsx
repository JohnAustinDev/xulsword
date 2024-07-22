import React from 'react';
import G from '../../rg.ts';
import renderToRoot from '../renderer.tsx';
import log from '../../log.ts';
import { Hbox, Vbox } from '../../components/libxul/boxes.tsx';
import Label from '../../components/libxul/label.tsx';
import Stack from '../../components/libxul/stack.tsx';
import './splash.css';

const overlay = G.inlineFile(
  `${G.Dirs.path.xsAsset}/splash-overlay-${G.i18n.language}.png`,
);
const style = overlay ? (
  <style>
    {`html.${G.i18n.language} #layer2 {
        background-image: url(${overlay});
      }`}
  </style>
) : undefined;

const opts = { ns: 'branding' };
const producedBy = G.i18n.exists('producedBy', opts)
  ? G.i18n.t('producedBy', opts)
  : '';

renderToRoot(
  <Vbox id="mainbox" width="500" height="375">
    {style}
    <Stack flex="1">
      <Vbox id="layer1" flex="1" />
      <Vbox id="layer2" flex="1" pack="end">
        <Hbox align="center">
          <Vbox className="splash-text" flex="1" pack="start" align="center">
            <Label value={producedBy} />
          </Vbox>
        </Hbox>
      </Vbox>
    </Stack>
  </Vbox>,
).catch((er) => {
  log.error(er);
});
