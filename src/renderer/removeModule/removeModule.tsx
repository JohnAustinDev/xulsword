import React from 'react';
import renderToRoot from '../renderer';
import ModuleManager, { onunload } from '../moduleManager/manager';

renderToRoot(<ModuleManager id="removeModule" />, { onunload });
