import React from 'react';
import log from '../../log.ts';
import renderToRoot from '../../controller.tsx';
import ModuleManager, { onunload } from './manager.tsx';

renderToRoot(<ModuleManager id="moduleManager" />, {
  resetOnResize: false, // turns on after Internet dialog
  onunload,
}).catch((er) => {
  log.error(er);
});
