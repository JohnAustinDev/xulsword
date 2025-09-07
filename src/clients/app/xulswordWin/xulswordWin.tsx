import React from 'react';
import { GE as G } from '../../G.ts';
import renderToRoot from '../../controller.tsx';
import log from '../../log.ts';
import Xulsword from '../../components/xulsword/xulsword.tsx';
import './xulswordWin.css';

renderToRoot(<Xulsword />, {
  onload: () => {
    log.verbose('Loaded xulsword window');
    setTimeout(() => {
      G.Window.moveToBack();
    }, 100);
  },
}).catch((er) => {
  log.error(er);
});
