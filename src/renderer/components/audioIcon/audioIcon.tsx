import React from 'react';
import { Icon } from '@blueprintjs/core';
import G from '../../rg.ts';
import { genBookAudioFile, verseKeyAudioFile } from '../../rutil.ts';

import type {
  GenBookAudioFile,
  OSISBookType,
  VerseKeyAudioFile,
} from '../../../type.ts';

export default function audioIcon(
  module: string,
  bookOrKey: OSISBookType | string,
  chapter: number | undefined,
  audioHandler: (audio: VerseKeyAudioFile | GenBookAudioFile) => void,
): JSX.Element | null {
  let afile: VerseKeyAudioFile | GenBookAudioFile | null = null;
  if (G.Tab[module].isVerseKey) {
    const book = bookOrKey as OSISBookType;
    afile = verseKeyAudioFile(module, book, chapter);
  } else if (G.Tab[module].tabType === 'Genbks' && bookOrKey) {
    afile = genBookAudioFile(module, bookOrKey);
  }
  if (afile) {
    const handler = ((ax: VerseKeyAudioFile | GenBookAudioFile) => {
      return (e: React.SyntheticEvent) => {
        e.stopPropagation();
        audioHandler(ax);
      };
    })(afile);
    return (
      <div className="audio-icon" onClick={handler}>
        <Icon icon="volume-up" />
      </div>
    );
  }
  return null;
}
