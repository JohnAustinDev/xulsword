import React from 'react';
import renderToRoot from '../renderer.tsx';
import ModuleManager, { onunload } from './manager.tsx';

renderToRoot(<ModuleManager id="moduleManager" />, {
  initialState: { resetOnResize: false }, // turns on after Internet dialog
  onunload,
});
