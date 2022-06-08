import React from 'react';
import renderToRoot from '../rinit';
import ModuleManager, { onunload } from './manager';

renderToRoot(<ModuleManager id="moduleManager" />, null, onunload);
