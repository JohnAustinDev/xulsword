import React from 'react';
import log from '../../log.ts';
import renderToRoot from '../../controller.tsx';
import SearchHelp from '../../components/searchHelp/searchHelp.tsx';
import './searchHelpWin.css';

renderToRoot(<SearchHelp />).catch((er) => {
  log.error(er);
});
