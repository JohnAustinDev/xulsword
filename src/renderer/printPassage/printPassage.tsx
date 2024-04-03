/* eslint-disable react/forbid-prop-types */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-restricted-syntax */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React, { ReactElement } from 'react';
import PropTypes from 'prop-types';
import ReactDOM from 'react-dom';
import { ProgressBar } from '@blueprintjs/core';
import Subscription from '../../subscription';
import { diff, sanitizeHTML, stringHash } from '../../common.ts';
import S from '../../defaultPrefs.ts';
import C from '../../constant.ts';
import G from '../rg.ts';
import renderToRoot, { RootPrintType } from '../renderer';
import {
  windowArguments,
  getStatePref,
  setStatePref,
  libswordImgSrc,
} from '../rutil.tsx';
import log from '../log.ts';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul.tsx';
import Grid, { Column, Columns, Row, Rows } from '../libxul/grid';
import Groupbox from '../libxul/groupbox';
import Checkbox from '../libxul/checkbox';
import SelectVK from '../libxul/selectVK';
import {
  handler as handlerH,
  vkSelectHandler as vkSelectHandlerH,
  validPassage,
  bibleChapterText,
} from './printPassageH';
import '../libsword.css';
import '../libxul/viewport/atext.css';
import './printPassage.css';

import type { OSISBookType } from '../../type.ts';

// TODO: As of 11/22 @page {@bottom-center {content: counter(page);}} does not work

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

const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
  print: PropTypes.object.isRequired,
};

type PrintPassageProps = XulProps & {
  print: Pick<RootPrintType, 'printContainer' | 'controls'>;
};

const notStatePrefDefault = {
  progress: -1 as number,
};

let openedWinState = windowArguments(
  'passageWinState'
) as Partial<PrintPassageState> | null;

export type PrintPassageState = typeof S.prefs.printPassage &
  typeof notStatePrefDefault;

export default class PrintPassageWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  pagebuttons: React.RefObject<HTMLDivElement>;

  handler: typeof handlerH;

  vkSelectHandler: typeof vkSelectHandlerH;

  constructor(props: PrintPassageProps) {
    super(props);

    const s: PrintPassageState = {
      ...notStatePrefDefault,
      ...(getStatePref('prefs', 'printPassage') as typeof S.prefs.printPassage),
      ...(openedWinState || {}),
    };
    openedWinState = {};
    s.chapters = validPassage(s.chapters);
    this.state = s;

    // Without the next save, prefs would somehow overwrite state
    // before first render!
    setStatePref('prefs', 'printPassage', null, s);

    this.pagebuttons = React.createRef();

    this.renderChapters = this.renderChapters.bind(this);
    this.handler = handlerH.bind(this);
    this.vkSelectHandler = vkSelectHandlerH.bind(this);
  }

  componentDidMount() {
    const state = this.state as PrintPassageState;
    setStatePref('prefs', 'printPassage', null, state);
    this.forceUpdate(); // for portal DOM target
  }

  componentDidUpdate(
    _prevProps: PrintPassageProps,
    prevState: PrintPassageState
  ) {
    const state = this.state as PrintPassageState;
    const { print } = this.props as PrintPassageProps;
    const tdiv = print.printContainer.current;
    const { chapters, progress } = state;
    const valid = validPassage(chapters);
    if (prevState.progress !== -1 && progress === -1) {
      Subscription.publish.setRendererRootState({
        printDisabled: false,
      });
    } else if (diff(chapters, valid)) {
      this.setState({ chapters: valid });
    } else if (tdiv) {
      setStatePref('prefs', 'printPassage', prevState, state);
      this.renderChapters();
    }
  }

  renderChapters() {
    const state = this.state as PrintPassageState;
    const { chapters } = state;
    const { print } = this.props as PrintPassageProps;
    const tdiv = print.printContainer.current;
    if (!tdiv || !chapters) return;
    const { checkbox } = state;
    const { vkMod, book, chapter, lastchapter, v11n } = chapters;
    const show = { ...checkbox, strongs: false, morph: false };
    const renderkey = stringHash(vkMod, chapter, lastchapter, show);
    if (lastchapter && tdiv.dataset.renderkey !== renderkey) {
      tdiv.dataset.renderkey = renderkey;
      const settings = {
        module: vkMod,
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
      const renderChaps: [OSISBookType, number][] = [];
      for (let ch = chapter; ch <= lastchapter; ch += 1) {
        if (book) renderChaps.push([book, ch]);
      }

      // Write first page to DOM for user to see right away
      sanitizeHTML(tdiv, '');
      let pageIsFull = false;
      const renderHTML: string[] = [];
      renderChaps.forEach((c) => {
        if (!pageIsFull && tdiv) {
          log.silly(`Showing chapter ${c[0]} ${c[1]}`);
          renderHTML.push(
            bibleChapterText({
              ...settings,
              location: { book: c[0], chapter: c[1], v11n },
            })
          );
          sanitizeHTML(tdiv, renderHTML.join());
          if (tdiv.scrollWidth > tdiv.offsetWidth) {
            pageIsFull = true;
          }
        }
      });
      log.debug(`Finished previewing ${renderHTML.length} chapters to DOM`);

      // Then asynchronously generate all other chapters with a progress bar
      Subscription.publish.setRendererRootState({
        printDisabled: true,
      });
      this.setState({ progress: 0 });
      // Pause here so first page will appear to user.
      setTimeout(async () => {
        let pages = 0;
        const funcs = renderChaps.map((c, i) => {
          return async (): Promise<string> => {
            return new Promise((resolve, reject) =>
              setTimeout(() => {
                if (renderHTML[i]) resolve(renderHTML[i]);
                else {
                  const tdivx = (this.props as PrintPassageProps).print
                    .printContainer.current;
                  if (tdivx && tdivx.dataset.renderkey === renderkey) {
                    // log.debug(`Building chapter ${c[0]} ${c[1]}`);
                    pages += 1;
                    this.setState({
                      progress: pages / C.UI.Print.maxPages,
                    });
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
                }
              }, 1)
            );
          };
        });
        let div = print.printContainer.current;
        if (div && div.dataset.renderkey === renderkey) {
          div.innerHTML = '';
          try {
            while (funcs.length) {
              const func = funcs.shift() as () => Promise<string>;
              log.debug(
                `Loading chapter to DOM: ${renderChaps.length - funcs.length}`
              );
              const h = await func();
              div = print.printContainer.current;
              if (!div || div.dataset.renderkey !== renderkey) break;
              div.innerHTML += sanitizeHTML(h);
              libswordImgSrc(div);
              pages = Math.floor(div.scrollWidth / div.clientWidth);
              if (pages > C.UI.Print.maxPages) {
                log.info(
                  `Stopping passage render at ${pages} pages (skipped ${funcs.length} chapters}).`
                );
                break;
              }
            }
            if (div) {
              log.debug(
                `Finished loading ${Math.floor(
                  div.scrollWidth / div.clientWidth
                )} pages to DOM`
              );
            }
          } catch (er) {
            log.debug(er);
          }
        }
        if (div && div.dataset.renderkey === renderkey) {
          this.setState({ progress: -1 });
        }
      }, 1);
    }
  }

  render() {
    const state = this.state as PrintPassageState;
    const { checkbox, chapters, progress } = state;
    const { print } = this.props as PrintPassageProps;
    const { handler, vkSelectHandler } = this;
    const vkMod = chapters?.vkMod;
    if (!vkMod || !chapters) return null;

    const lang = G.Tab[vkMod].conf.Lang;
    const isHebrew = lang && /^heb?$/i.test(lang);
    const tr = isHebrew ? 1 : 0;

    const { book: b, chapter: c1, lastchapter: c2 } = chapters;
    const keySelectVK = [vkMod, b, c1, c2].join('.');

    return (
      <>
        <div
          ref={print.printContainer}
          className="printContainer userFontBase"
          dir={G.Tab[vkMod].direction || 'auto'}
        />

        {print.controls.current &&
          ReactDOM.createPortal(
            <>
              <Groupbox
                className="passage-selector"
                caption={G.i18n.t('menu.printPassage')}
              >
                <SelectVK
                  id="chapters"
                  key={keySelectVK}
                  initialVK={{ ...chapters, vkMod }}
                  options={{
                    verses: [],
                    lastverses: [],
                  }}
                  onSelection={vkSelectHandler}
                />
                {progress !== -1 && (
                  <ProgressBar
                    value={undefined}
                    intent="primary"
                    animate
                    stripes
                  />
                )}
              </Groupbox>
              <Groupbox
                className="text-options"
                caption={G.i18n.t('include.label')}
              >
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
                                label={G.i18n.t(c[3])}
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
            print.controls.current
          )}
      </>
    );
  }
}
PrintPassageWin.defaultProps = defaultProps;
PrintPassageWin.propTypes = propTypes;

const print: PrintPassageProps['print'] = {
  printContainer: React.createRef() as React.RefObject<HTMLDivElement>,
  controls: React.createRef() as React.RefObject<HTMLDivElement>,
};

renderToRoot(<PrintPassageWin print={print} />, {
  print: { ...print, pageable: true, dialogEnd: 'close' },
  initialState: {
    showPrintOverlay: true,
    modal: 'dropshadow',
    iframeFilePath: '',
    progress: -1,
  },
});
