import React from 'react';
import log from '../../log.ts';
import renderToRoot from '../../controller.tsx';
import SearchHelp from '../../components/searchHelp/searchHelp.tsx';

renderToRoot(<SearchHelp height="100%" />).catch((er) => {
  log.error(er);
});
