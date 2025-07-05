import React from 'react';
import renderToRoot from '../../controller.tsx';
import log from '../../log.ts';
import ModuleManager, {
  onunload,
} from '../components/moduleManager/moduleManager.tsx';

renderToRoot(<ModuleManager id="removeModule" />, { onunload }).catch((er) => {
  log.error(er);
});
