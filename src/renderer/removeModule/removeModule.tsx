/* eslint-disable @typescript-eslint/no-misused-promises */
import React from 'react';
import renderToRoot from '../renderer.tsx';
import log from '../log.ts';
import ModuleManager, { onunload } from '../moduleManager/manager.tsx';

renderToRoot(<ModuleManager id="removeModule" />, { onunload }).catch((er) => {
  log.error(er);
});
