import React from 'react';
import renderToRoot from '../rinit';
import ModuleManager, { onunload } from '../moduleManager/manager';

renderToRoot(<ModuleManager id="removeModule" />, null, onunload);
