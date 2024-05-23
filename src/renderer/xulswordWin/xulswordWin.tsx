
import React from 'react';
import renderToRoot from '../renderer.tsx';
import G from '../rg.ts';
import log from '../log.ts';
import Xulsword from '../libxul/xulsword/xulsword.tsx';

renderToRoot(<Xulsword />, {
  onload: () => {
    log.verbose('Loading Xulsword!');
    setTimeout(() => {
      G.Window.moveToBack();
    }, 100);
  }
});
