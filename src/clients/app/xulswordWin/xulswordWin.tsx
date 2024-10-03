import React from 'react';
import renderToRoot from '../../controller.tsx';
import { G } from '../../G.ts';
import log from '../../log.ts';
import Xulsword from '../../components/xulsword/xulsword.tsx';
import './xulswordWin.css';

renderToRoot(<Xulsword />, {
  onload: () => {
    log.verbose('Loading Xulsword!');
    setTimeout(() => {
      G.Window.moveToBack();
    }, 100);
  },
}).catch((er) => {
  log.error(er);
});
