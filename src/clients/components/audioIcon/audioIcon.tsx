import React from 'react';
import { Icon } from '@blueprintjs/core';
import { G } from '../../G.ts';
import { genBookAudioFile, verseKeyAudioFile } from '../../common.ts';
import RenderPromise from '../../renderPromise.ts';
import './audioIcon.css';

import type {
  GenBookAudioFile,
  OSISBookType,
  VerseKeyAudioFile,
} from '../../../type.ts';

export default function audioIcon(
  module: string,
  bookOrKey: OSISBookType | string,
  chapter: number | undefined,
  audioHandler: (
    audio: VerseKeyAudioFile | GenBookAudioFile,
    e: React.SyntheticEvent,
  ) => void,
  renderPromise: RenderPromise,
): JSX.Element | null {
  let afile: VerseKeyAudioFile | GenBookAudioFile | null = null;
  if (G.Tab[module].isVerseKey) {
    const book = bookOrKey as OSISBookType;
    afile = verseKeyAudioFile(module, book, chapter ?? 1, renderPromise);
  } else if (G.Tab[module].tabType === 'Genbks' && bookOrKey) {
    afile = genBookAudioFile(module, bookOrKey, renderPromise);
  }
  if (afile) {
    const handler = ((ax: VerseKeyAudioFile | GenBookAudioFile) => {
      return (e: React.SyntheticEvent) => {
        e.stopPropagation();
        audioHandler(ax, e);
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
