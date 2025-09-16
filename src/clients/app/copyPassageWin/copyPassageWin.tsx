import React from 'react';
import { Intent } from '@blueprintjs/core';
import VerseKey from '../../../verseKey.ts';
import { sanitizeHTML } from '../../../common.ts';
import { GE as G, GI } from '../../G.ts';
import renderToRoot from '../../controller.tsx';
import {
  windowArguments,
  computed2inlineStyle,
  elem2text,
  getMaxVerse,
  getStatePref,
  setStatePref,
  topToaster,
} from '../../common.ts';
import RenderPromise, {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import log from '../../log.ts';
import { libswordText } from '../../components/atext/ztext.ts';
import Groupbox from '../../components/libxul/groupbox.tsx';
import Checkbox from '../../components/libxul/checkbox.tsx';
import { Hbox, Vbox } from '../../components/libxul/boxes.tsx';
import Button from '../../components/libxul/button.tsx';
import SelectVK from '../../components/libxul/selectVK.tsx';
import Spacer from '../../components/libxul/spacer.tsx';
import '../../libsword.css';
import '../../components/atext/atext.css';
import './copyPassageWin.css';

import type { ToastProps } from '@blueprintjs/core';
import type S from '../../../defaultPrefs.ts';
import type { XulProps } from '../../components/libxul/xul.tsx';
import type { SelectVKType } from '../../components/libxul/selectVK.tsx';

// TODO: CopyPassage font is underlined when viewed in LibreOffice.

const MaxChaptersToCopy = 10;

type CopyPassageProps = XulProps;

const notStatePrefDefault = {
  passage: null as SelectVKType | null,
};

export type CopyPassageState = typeof notStatePrefDefault &
  typeof S.prefs.copyPassage &
  RenderPromiseState;

export default class CopyPassageWin
  extends React.Component<CopyPassageProps, CopyPassageState>
  implements RenderPromiseComponent
{
  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  constructor(props: CopyPassageProps) {
    super(props);

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);

    const openedWinState = windowArguments(
      'copyPassageState',
    ) as Partial<CopyPassageState> | null;
    if (openedWinState) {
      Object.entries(openedWinState).forEach((entry) => {
        const [k, val] = entry;
        const key = k as keyof typeof openedWinState;
        if (val === undefined) delete openedWinState[key];
      });
    }

    const s: CopyPassageState = {
      renderPromiseID: 0,
      ...notStatePrefDefault,
      ...(getStatePref('prefs', 'copyPassage') as typeof S.prefs.copyPassage),
      ...openedWinState,
    };
    if (s.passage) {
      if (!s.passage.chapter) s.passage.chapter = 1;
      if (!s.passage.verse) s.passage.verse = 1;
      if (!s.passage.lastchapter) s.passage.lastchapter = s.passage.chapter;
      if (!s.passage.lastverse) {
        const { v11n } = (s.passage.vkMod && G.Tab[s.passage.vkMod]) || {};
        s.passage.lastverse = getMaxVerse(
          v11n || s.passage.v11n || 'KJV',
          `${s.passage.book}.${s.passage.lastchapter}`,
          this.renderPromise,
        );
      }
    }
    this.state = s;

    this.passageToClipboard = this.passageToClipboard.bind(this);
    this.addToast = this.addToast.bind(this);
  }

  componentDidMount() {
    const { renderPromise } = this;
    renderPromise.dispatch();
  }

  componentDidUpdate(
    _prevProps: CopyPassageProps,
    prevState: CopyPassageState,
  ) {
    const { renderPromise } = this;
    setStatePref('prefs', 'copyPassage', prevState, this.state);
    renderPromise.dispatch();
  }

  async addToast(message: ToastProps) {
    (await topToaster).show(message);
  }

  passageToClipboard() {
    const { state, renderPromise } = this;
    const { passage, checkboxes } = state;
    const testdiv = document.getElementById('testdiv');
    if (testdiv && passage) {
      passage.verse = undefined;
      passage.lastverse = undefined;
      testdiv.innerHTML = '';
      let ch = 0;
      for (
        ch = passage.chapter;
        ch <= (passage?.lastchapter || passage.chapter) &&
        ch < passage.chapter + MaxChaptersToCopy;
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
            module: passage.vkMod,
            ilModule: '',
            ilModuleOption: [],
            modkey: '',
          },
          0,
          renderPromise,
        );
        const div = testdiv.appendChild(document.createElement('div'));
        div.classList.add('text');
        sanitizeHTML(div, lsresp.textHTML);
        /* always showing full chapters
        htmlVerses(
          div,
          ch === passage.chapter ? passage.verse || 1 : 1,
          ch === passage.lastchapter ? passage.lastverse || null : null,
        );*/
        computed2inlineStyle(div);
      }
      if (ch === passage.chapter + MaxChaptersToCopy) {
        passage.lastchapter = ch - 1;
        this.addToast({
          message: `${GI.i18n.t(
            '',
            renderPromise,
            'menu.copyPassage',
          )}: ${passage.chapter}-${passage.lastchapter}`,
          timeout: 5000,
          intent: Intent.WARNING,
        }).catch((er) => log.error(er));
      }
      const refdiv = testdiv.appendChild(document.createElement('div'));
      const vks: VerseKey[] = [];
      if (!passage.lastchapter || passage.chapter === passage.lastchapter) {
        vks.push(new VerseKey(passage, renderPromise));
      } else {
        vks.push(
          new VerseKey(
            {
              ...passage,
              lastverse: undefined,
            },
            renderPromise,
          ),
        );
        vks.push(
          new VerseKey(
            {
              ...passage,
              chapter: passage.lastchapter || passage.chapter,
              verse: passage.lastverse,
              lastverse: undefined,
            },
            renderPromise,
          ),
        );
      }
      sanitizeHTML(
        refdiv,
        `
        <span class="cs-locale">
          (${vks.map((vk) => vk.readable(G.i18n.language)).join(' - ')})
        </span>`,
      );
      G.clipboard.write({
        html: testdiv.innerHTML,
        text: elem2text(testdiv),
      });
    }
  }

  render() {
    const { state, loadingRef, passageToClipboard } = this;
    const { passage, checkboxes } = state;
    return (
      <Vbox domref={loadingRef}>
        <div id="testdiv" />
        <Groupbox caption={G.i18n.t('passage.label')}>
          <SelectVK
            initialVK={passage || { book: 'Gen', chapter: 1, v11n: 'KJV' }}
            options={{ verses: [], lastverses: [] }}
            onSelection={(selection?: SelectVKType) => {
              if (selection) this.setState({ passage: selection });
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
                    onChange={() => {
                      this.setState((prevState) => {
                        return {
                          checkboxes: {
                            ...prevState.checkboxes,
                            [cb]: !prevState.checkboxes[cb],
                          },
                        };
                      });
                    }}
                  />
                );
              })}
            </Vbox>
          </Groupbox>
          <Spacer flex="1" />
          <Hbox className="dialog-buttons" pack="end" align="end">
            <Button onPointerDown={passageToClipboard}>
              {G.i18n.t('menu.edit.copy')}
            </Button>
            <Button
              id="cancel"
              onPointerDown={() => {
                G.Window.close();
              }}
            >
              {G.i18n.t('cancel.label')}
            </Button>
          </Hbox>
        </Hbox>
      </Vbox>
    );
  }
}

renderToRoot(<CopyPassageWin />).catch((er) => {
  log.error(er);
});
