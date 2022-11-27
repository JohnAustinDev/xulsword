import React from 'react';
import renderToRoot from '../renderer';
import ModuleManager, { onunload } from './manager';

renderToRoot(<ModuleManager id="moduleManager" />, { onunload });
