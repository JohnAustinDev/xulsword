import React from 'react';
import renderToRoot from '../renderer';
import ModuleManager, { onunload } from './manager';

renderToRoot(<ModuleManager id="moduleManager" />, {
  initialState: { resetOnResize: false }, // turns on after Internet dialog
  onunload,
});
