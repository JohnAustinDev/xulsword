import React from 'react';
import renderToRoot from '../renderer.tsx';
import ModuleManager, { onunload } from '../moduleManager/manager.tsx';

renderToRoot(<ModuleManager id="removeModule" />, { onunload });
