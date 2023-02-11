/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React from 'react';
import { sanitizeHTML } from '../../common';
import { SP } from '../../constant';
import G from '../rg';
import renderToRoot from '../renderer';
import {
  windowArgument,
  computed2inlineStyle,
  elem2text,
  htmlVerses,
  getMaxVerse,
  verseKey,
  getStatePref,
  setStatePref,
} from '../rutil';
import { libswordText } from '../viewport/ztext';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import Groupbox from '../libxul/groupbox';
import Checkbox from '../libxul/checkbox';
import { Hbox, Vbox } from '../libxul/boxes';
import Button from '../libxul/button';
import VKSelect, { SelectVKMType } from '../libxul/vkselect';
import '../libsword.css';
import '../viewport/atext.css';
import './copyPassage.css';

import type VerseKey from '../../versekey';

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type CopyPassageProps = XulProps;

const notStatePrefDefault = {
  passage: null as SelectVKMType | null,
};

export type CopyPassageState = typeof notStatePrefDefault &
  typeof SP.copyPassage;

const openedWinState = windowArgument(
  'copyPassageState'
) as Partial<CopyPassageState> | null;
if (openedWinState) {
  Object.entries(openedWinState).forEach((entry) => {
    const [k, val] = entry;
    const key = k as keyof typeof openedWinState;
    if (val === undefined) delete openedWinState[key];
  });
}

export default class CopyPassageWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  constructor(props: CopyPassageProps) {
    super(props);

    const s: CopyPassageState = {
      ...notStatePrefDefault,
      ...getStatePref('copyPassage', SP.copyPassage),
      ...openedWinState,
    };
    if (s.passage) {
      if (!s.passage.chapter) s.passage.chapter = 1;
      if (!s.passage.verse) s.passage.verse = 1;
      if (!s.passage.lastchapter) s.passage.lastchapter = s.passage.chapter;
      if (!s.passage.lastverse) {
        const { v11n } = G.Tab[s.passage.vkmod];
        s.passage.lastverse = getMaxVerse(
          v11n || s.passage.v11n || 'KJV',
          `${s.passage.book}.${s.passage.lastchapter}`
        );
      }
    }
    this.state = s;

    this.passageToClipboard = this.passageToClipboard.bind(this);
  }

  componentDidUpdate(
    _prevProps: CopyPassageProps,
    prevState: CopyPassageState
  ) {
    setStatePref(
      'copyPassage',
      prevState,
      this.state,
      Object.keys(SP.copyPassage)
    );
  }

  passageToClipboard() {
    const state = this.state as CopyPassageState;
    const { passage, checkboxes } = state;
    const testdiv = document.getElementById('testdiv');
    if (testdiv && passage) {
      testdiv.innerHTML = '';
      for (
        let ch = passage.chapter;
        ch <= (passage?.lastchapter || passage.chapter);
        ch += 1
      ) {
        const lsresp = libswordText(
          {
            location: {
              ...passage,
              chapter: ch,
            },
            show: {
              headings: true,
              versenums: true,
              usernotes: false,
              footnotes: false,
              crossrefs: false,
              dictlinks: false,
              strongs: false,
              morph: false,
              hebcantillation: true,
              hebvowelpoints: true,
              redwords: true,
              ...checkboxes,
            },
            place: {
              footnotes: 'notebox',
              crossrefs: 'notebox',
              usernotes: 'notebox',
            },
            module: passage.vkmod,
            ilModule: '',
            ilModuleOption: [],
            modkey: '',
          },
          0
        );
        const div = testdiv.appendChild(document.createElement('div'));
        div.classList.add('text');
        sanitizeHTML(div, lsresp.textHTML);
        htmlVerses(
          div,
          ch === passage.chapter ? passage.verse || 1 : 1,
          ch === passage.lastchapter ? passage.lastverse || null : null
        );
        computed2inlineStyle(div);
      }
      const refdiv = testdiv.appendChild(document.createElement('div'));
      const vks: VerseKey[] = [];
      if (!passage.lastchapter || passage.chapter === passage.lastchapter) {
        vks.push(verseKey(passage));
      } else {
        vks.push(
          verseKey({
            ...passage,
            lastverse: undefined,
          })
        );
        vks.push(
          verseKey({
            ...passage,
            chapter: passage.lastchapter || passage.chapter,
            verse: passage.lastverse,
            lastverse: undefined,
          })
        );
      }
      refdiv.innerHTML = `
        <span class="cs-locale">
          (${vks.map((vk) => vk.readable()).join('-')})
        </span>`;
      G.clipboard.write({
        html: testdiv.innerHTML,
        text: elem2text(testdiv),
      });
    }
  }

  render() {
    const state = this.state as CopyPassageState;
    const { passage, checkboxes } = state;
    const { passageToClipboard } = this;
    return (
      <Vbox>
        <div id="testdiv" />
        <Groupbox caption={G.i18n.t('passage.label')}>
          <VKSelect
            initialVKM={passage}
            options={{ lastchapters: [] }}
            onSelection={(selection: SelectVKMType) => {
              this.setState({ passage: selection });
            }}
          />
        </Groupbox>
        <Hbox>
          <Groupbox caption={G.i18n.t('include.label')}>
            <Vbox>
              {Object.entries(checkboxes).map((entry) => {
                const [cbx, checked] = entry;
                const cb = cbx as keyof typeof checkboxes;
                return (
                  <Checkbox
                    key={cb}
                    id={cb}
                    label={G.i18n.t(`menu.view.${cb}`)}
                    checked={checked}
                    onChange={() =>
                      this.setState((prevState: CopyPassageState) => {
                        const s: Partial<CopyPassageState> = {
                          checkboxes: {
                            ...prevState.checkboxes,
                            [cb]: !prevState.checkboxes[cb],
                          },
                        };
                        return s;
                      })
                    }
                  />
                );
              })}
            </Vbox>
          </Groupbox>
          <Hbox className="dialog-buttons" pack="end" align="end">
            <Button onClick={passageToClipboard}>
              {G.i18n.t('menu.edit.copy')}
            </Button>
            <Button id="cancel" onClick={() => G.Window.close()}>
              {G.i18n.t('cancel.label')}
            </Button>
          </Hbox>
        </Hbox>
      </Vbox>
    );
  }
}
CopyPassageWin.defaultProps = defaultProps;
CopyPassageWin.propTypes = propTypes;

renderToRoot(<CopyPassageWin />);
