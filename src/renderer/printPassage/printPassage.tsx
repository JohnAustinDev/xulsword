/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React, { ReactElement } from 'react';
import ReactDOM from 'react-dom';
import i18n from 'i18next';
import { ProgressBar } from '@blueprintjs/core';
import { diff, sanitizeHTML, stringHash, drop } from '../../common';
import G from '../rg';
import renderToRoot from '../rinit';
import { windowArgument, getStatePref } from '../rutil';
import log from '../log';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import Grid, { Column, Columns, Row, Rows } from '../libxul/grid';
import Groupbox from '../libxul/groupbox';
import Checkbox from '../libxul/checkbox';
import VKSelect, { SelectVKMType } from '../libxul/vkselect';
import Label from '../libxul/label';
import {
  handler as handlerH,
  vkSelectHandler as vkSelectHandlerH,
  validPassage,
  bibleChapterText,
} from './printPassageH';
import '../libsword.css';
import '../viewport/atext.css';
import './printPassage.css';

// TODO!: Dictlinks aren't implemented. CSS needs improvement.
// Regular print top margin is too large. Wrong chapter(s) print.
// TODO!: As of 11/22 @page {@bottom-center {content: counter(page);}} does not work

import type { PrintOverlayOptions } from '../../type';

// 0=none, 1=checkbox, 2=placeholder
const switches = [
  [
    [1, 1, 'headings', 'menu.view.headings'],
    [1, 1, 'footnotes', 'menu.view.footnotes'],
    [1, 1, 'usernotes', 'menu.view.usernotes'],
    [1, 1, 'crossrefs', 'menu.view.crossrefs'],
    [1, 1, 'crossrefsText', 'crossrefs.withText.label'],
    [0, 2, '' as never, ''],
  ],
  [
    [1, 1, 'introduction', 'introduction.label'],
    [1, 1, 'versenums', 'menu.view.versenums'],
    [1, 1, 'redwords', 'menu.view.redwords'],
    [1, 1, 'dictlinks', 'menu.view.dictlinks'],
    [2, 1, 'hebcantillation', 'menu.options.hebCant'],
    [0, 1, 'hebvowelpoints', 'menu.options.hebVowel'],
  ],
] as const;

let openedWinState = windowArgument(
  'passageWinState'
) as Partial<PassageWinState> | null;

const notStateProps = {
  progress: -1 as number,
};

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type PassageWinProps = XulProps;

export type PassageWinState = typeof notStateProps & {
  firstChapter: SelectVKMType | null;
  lastChapter: SelectVKMType | null;
  checkbox: {
    [k in typeof switches[number][number][2]]: boolean;
  };
};

export default class PrintPassageWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  renderChapters: Promise<string>[];

  textdiv: React.RefObject<HTMLDivElement>;

  handler: typeof handlerH;

  vkSelectHandler: typeof vkSelectHandlerH;

  constructor(props: PassageWinProps) {
    super(props);

    const s: PassageWinState = {
      ...notStateProps,
      ...(getStatePref('printPassage') as PassageWinState),
      ...(openedWinState || {}),
    };
    openedWinState = {};

    this.state = validPassage(s);
    // Without the next save, prefs would somehow overwrite state
    // before first render!
    this.saveStatePrefs();

    this.renderChapters = [];

    this.textdiv = React.createRef();

    this.handler = handlerH.bind(this);
    this.vkSelectHandler = vkSelectHandlerH.bind(this);
  }

  componentDidMount() {
    this.saveStatePrefs();
    this.forceUpdate(); // for portal DOM target
  }

  componentDidUpdate(_prevProps: PassageWinProps, prevState: PassageWinState) {
    const state = this.state as PassageWinState;
    const { textdiv } = this;
    let { renderChapters } = this;
    const valid = validPassage(state);
    const tdiv = textdiv.current;
    if (diff(state, valid)) {
      this.setState(valid);
    } else if (tdiv) {
      this.saveStatePrefs(prevState);
      const { firstChapter, lastChapter, checkbox } = state;
      if (!firstChapter || !lastChapter) return;
      const { vkmod, v11n } = firstChapter;
      const show = { ...checkbox, strongs: false, morph: false };
      const renderkey = stringHash(vkmod, firstChapter, lastChapter, show);
      if (
        firstChapter &&
        lastChapter &&
        v11n &&
        tdiv.dataset.renderkey !== renderkey
      ) {
        tdiv.dataset.renderkey = renderkey;
        renderChapters = [];
        const settings = {
          module: vkmod,
          show,
          ilModule: undefined,
          ilModuleOption: [],
          modkey: '',
          place: {
            footnotes: 'notebox',
            crossrefs: 'notebox',
            usernotes: 'notebox',
          } as const,
        };
        const chapters: [string, number][] = [];
        let total = 0;
        const bs = G.BkChsInV11n[v11n].findIndex(
          (a) => a[0] === firstChapter.book
        );
        const cs = firstChapter.chapter;
        const be = G.BkChsInV11n[v11n].findIndex(
          (a) => a[0] === lastChapter.book
        );
        const ce = lastChapter.chapter;
        for (let i = bs; i <= be; i += 1) {
          for (
            let ch = i === bs ? cs : 1;
            ch <= (i === be ? ce : G.BkChsInV11n[v11n][i][1]);
            ch += 1
          ) {
            total += 1;
            const bk = G.BkChsInV11n[v11n][i][0];
            chapters.push([bk, ch]);
          }
        }

        // Write first page to DOM for user to see right away
        sanitizeHTML(tdiv, '');
        let pageIsFull = false;
        const pageHtml: string[] = [];
        chapters.forEach((c) => {
          if (!pageIsFull && tdiv) {
            log.silly(`Showing chapter ${c[0]} ${c[1]}`);
            pageHtml.push(
              bibleChapterText({
                ...settings,
                location: { book: c[0], chapter: c[1], v11n },
              })
            );
            sanitizeHTML(tdiv, pageHtml.join());
            if (tdiv.scrollWidth > tdiv.offsetWidth) {
              pageIsFull = true;
            }
          }
        });

        // Then asynchronously generate all other chapters with a progress bar
        const poo: PrintOverlayOptions = {
          disabled: true,
        };
        window.ipc.renderer.printPreview(poo);
        this.setState({ progress: 0 });
        setTimeout(
          () =>
            (async function writeToDOM(xthis: PrintPassageWin, key: string) {
              let prog = 0;
              const funcs = chapters.map((c) => {
                return async (): Promise<string> => {
                  return new Promise((resolve, reject) =>
                    setTimeout(() => {
                      if (tdiv && key === tdiv.dataset.renderkey) {
                        log.silly(`Building chapter ${c[0]} ${c[1]}`);
                        prog += 1;
                        xthis.setState({ progress: prog / total });
                        resolve(
                          bibleChapterText({
                            ...settings,
                            location: {
                              book: c[0],
                              chapter: c[1],
                              v11n,
                            },
                          })
                        );
                      } else reject(new Error(`Canceled`));
                    }, 1)
                  );
                };
              });
              try {
                renderChapters = funcs.map((f) => f());
                // Series calling of funcs runs many times slower than parallel!
                // Although it allows better UI response, such slowdown isn't
                // worth it.
                /*
                for (const func of funcs) {
                  const r = await func();
                  renderChapters.push(Promise.resolve(r);
                }
                */
                const done = await Promise.all(renderChapters);
                sanitizeHTML(tdiv, done.join());
                log.debug(`Finished loading ${total} chapters to DOM!`);
              } catch (er) {
                log.warn(er);
              } finally {
                xthis.setState({ progress: -1 });
                const poo2: PrintOverlayOptions = {
                  disabled: false,
                };
                window.ipc.renderer.printPreview(poo2);
              }
            })(this, renderkey),
          1000
        );
      }
    }
  }

  saveStatePrefs(prevState?: PassageWinState) {
    const state = this.state as PassageWinState;
    if (prevState) {
      const d = diff(prevState, drop(state, notStateProps));
      if (d) {
        G.Prefs.mergeValue('printPassage', d);
      }
    } else G.Prefs.mergeValue('printPassage', drop(state, notStateProps));
  }

  render() {
    const state = this.state as PassageWinState;
    const { checkbox, firstChapter, lastChapter, progress } = state;
    const { textdiv, handler, vkSelectHandler } = this;
    const vkmod = firstChapter?.vkmod;
    const vkmod2 = lastChapter?.vkmod;
    if (!vkmod || !vkmod2 || vkmod !== vkmod2) return null;

    const isHebrew = /^heb?$/i.test(G.Tab[vkmod].lang);
    const tr = isHebrew ? 1 : 0;

    const printControl = document.getElementById(
      'printControl'
    ) as HTMLDivElement | null;

    return (
      <>
        <div
          ref={textdiv}
          className={[
            'text',
            'userFontBase',
            G.Prefs.getBoolPref('print.twoColumns')
              ? 'two-column'
              : 'one-column',
          ].join(' ')}
          dir={G.Tab[vkmod].direction || 'auto'}
        />
        {printControl &&
          ReactDOM.createPortal(
            <>
              <Groupbox caption={i18n.t('print.printpassage')}>
                <Grid>
                  <Columns>
                    <Column />
                    <Column />
                  </Columns>
                  <Rows>
                    <Row>
                      <Label value={`${i18n.t('from.label')}:`} />
                      {firstChapter && (
                        <VKSelect
                          id="from-select"
                          selectVKM={{ ...firstChapter, vkmod }}
                          options={{
                            verses: [],
                            lastchapters: [],
                            lastverses: [],
                          }}
                          onSelectionChange={vkSelectHandler}
                        />
                      )}
                      {!firstChapter && <div />}
                    </Row>
                    <Row>
                      <Label value={`${i18n.t('to.label')}:`} />
                      {lastChapter && (
                        <div className="progress-anchor">
                          <VKSelect
                            id="to-select"
                            selectVKM={{ ...lastChapter, vkmod }}
                            options={{
                              verses: [],
                              lastchapters: [],
                              lastverses: [],
                            }}
                            onSelectionChange={vkSelectHandler}
                          />

                          {progress !== -1 && (
                            <ProgressBar
                              value={progress}
                              intent="primary"
                              animate
                              stripes
                            />
                          )}
                        </div>
                      )}
                      {!lastChapter && <div />}
                    </Row>
                  </Rows>
                </Grid>
              </Groupbox>
              <Groupbox caption={i18n.t('include.label')}>
                <Grid>
                  <Rows>
                    {switches[0]
                      .filter((r) => r[tr] > 0)
                      .map((c) => (
                        <Row key={c.join('.')} />
                      ))}
                  </Rows>
                  <Columns>
                    {switches.map((cols) => (
                      <Column key={[tr, ...cols.map((c) => c[2])].join('.')}>
                        {cols.map((c) => {
                          const key = [c[tr], c[2]].join('.');
                          let cb: ReactElement | null = null;
                          if (c[tr] === 1) {
                            cb = (
                              <Checkbox
                                key={key}
                                id={c[2]}
                                label={i18n.t(c[3])}
                                checked={checkbox[c[2]]}
                                disabled={
                                  c[2] === 'crossrefsText' &&
                                  !checkbox.crossrefs
                                }
                                onChange={handler}
                              />
                            );
                          } else if (c[tr] === 2) {
                            cb = <div key={key} />;
                          }
                          return cb;
                        })}
                      </Column>
                    ))}
                  </Columns>
                </Grid>
              </Groupbox>
            </>,
            printControl
          )}
      </>
    );
  }
}
PrintPassageWin.defaultProps = defaultProps;
PrintPassageWin.propTypes = propTypes;

renderToRoot(<PrintPassageWin />, null, null, {
  printColumnSelect: true,
  printControl: <div id="printControl" />,
  modalInitial: 'outlined',
  printInitial: true,
});
