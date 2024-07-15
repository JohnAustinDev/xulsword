import React from 'react';
import log from '../log.ts';
import renderToRoot from '../renderer.tsx';
import ModuleManager, { onunload } from './manager.tsx';

renderToRoot(<ModuleManager id="moduleManager" />, {
  initialState: { resetOnResize: false }, // turns on after Internet dialog
  onunload,
}).catch((er) => {
  log.error(er);
});
