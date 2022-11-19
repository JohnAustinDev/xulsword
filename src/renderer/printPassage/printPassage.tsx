/* eslint-disable react/no-did-update-set-state */
/* eslint-disable react/no-array-index-key */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable react/static-property-placement */
import React, { ReactElement } from 'react';
import ReactDOM from 'react-dom';
import i18n from 'i18next';
import { JSON_stringify, diff, clone } from '../../common';
import C from '../../constant';
import G from '../rg';
import renderToRoot from '../rinit';
import { getValidVK, windowArgument, verseKey } from '../rutil';
import { Vbox } from '../libxul/boxes';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import Grid, { Column, Columns, Row, Rows } from '../libxul/grid';
import Groupbox from '../libxul/groupbox';
import Checkbox from '../libxul/checkbox';
import VKSelect, { SelectVKMType, VKSelectProps } from '../libxul/vkselect';
import Label from '../libxul/label';
import './printPassage.css';

import type { LocationVKType } from '../../type';

// 0=none, 1=checkbox, 2=placeholder
const switches = [
  [
    [1, 1, 'headings', 'menu.view.headings'],
    [1, 1, 'footnotes', 'menu.view.footnotes'],
    [1, 1, 'usernotes', 'menu.view.usernotes'],
    [1, 1, 'crossrefs', 'menu.view.crossrefs'],
    [1, 1, 'crossrefsText', 'crossrefs.withText.label'],
    [0, 2, '', ''],
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

function validPassage(is: PassageWinState): PassageWinState {
  const s = clone(is);
  // To-vkmod must contain its selected book and from-vkmod must
  // contain its selected book
  (['firstChapter', 'lastChapter'] as const).forEach((p) => {
    const books = G.getBooksInModule(s[p].vkmod);
    if (!books.includes(s[p].book)) {
      [s[p].book] = books;
      s[p].chapter = 1;
    }
  });
  // To-book must come after from-book.
  if (s.lastChapter && s.firstChapter) {
    const { book: bookF, chapter: chapterF } = s.firstChapter;
    const { book: bookL, chapter: chapterL } = s.lastChapter;
    if (G.Book[bookF].index > G.Book[bookL].index) {
      s.lastChapter.book = s.firstChapter.book;
      s.lastChapter.chapter = s.firstChapter.chapter;
    }
    // To-chapter must come after from-chapter
    if (bookF === bookL && chapterF > chapterL) {
      s.lastChapter.chapter = s.firstChapter.chapter;
    }
  }
  return s;
}

function vkSelectHandlerH(
  this: PrintPassageWin,
  selection: SelectVKMType,
  id: string
) {
  if (selection) {
    const { book, chapter, vkmod } = selection;
    const v11n = G.Tab[selection.vkmod].v11n || selection.v11n || 'KJV';
    if (book && chapter && vkmod) {
      this.setState((prevState: PassageWinState) => {
        const changed = id === 'from-select' ? 'firstChapter' : 'lastChapter';
        const other = id === 'from-select' ? 'lastChapter' : 'firstChapter';
        const s: Partial<PassageWinState> = {};
        s[changed] = { book, chapter, v11n, vkmod };
        if (book !== prevState[changed].book) {
          const changedx = s[changed];
          if (changedx) changedx.chapter = 1;
        }
        s[other] = {
          ...verseKey(
            (prevState[other] || s[changed]) as LocationVKType,
            v11n
          ).location(),
          vkmod,
        };
        return s;
      });
      return;
    }
  }
  this.setState({ [id]: null });
}

const defaultProps = xulDefaultProps;

const propTypes = xulPropTypes;

type PassageWinProps = XulProps;

const initialState = {
  firstChapter: {} as SelectVKMType,
  lastChapter: {} as SelectVKMType,
  checkbox: {
    introduction: false,
    headings: true,
    versenums: true,
    redwords: false,
    dictlinks: true,
    footnotes: true,
    usernotes: false,
    crossrefs: true,
    crossrefsText: false,
    hebvowelpoints: true,
    hebcantillation: true,
  } as { [k in typeof switches[number][number][2]]: boolean },
};

export type PassageWinState = typeof initialState;

export default class PrintPassageWin extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  vkSelectHandler: VKSelectProps['onSelectionChange'];

  constructor(props: PassageWinProps) {
    super(props);

    const argState = windowArgument(
      'passageWinState'
    ) as Partial<PassageWinState> | null;

    const s: PassageWinState = {
      ...initialState,
      ...(argState || {}),
    };

    let vkmod = s.firstChapter?.vkmod;
    if (!vkmod || !(vkmod in G.Tab)) {
      vkmod = G.Tabs.find((t) => t.type === C.BIBLE)?.module || '';
    }
    if (vkmod && (!s.firstChapter?.vkmod || !s.lastChapter?.vkmod)) {
      s.firstChapter = { ...getValidVK(vkmod), vkmod };
      s.lastChapter = clone(s.firstChapter);
    }

    this.state = validPassage(s);

    this.handler = this.handler.bind(this);
    this.vkSelectHandler = vkSelectHandlerH.bind(this);
  }

  componentDidMount() {
    this.forceUpdate(); // for portal DOM target
  }

  componentDidUpdate() {
    const state = this.state as PassageWinState;
    const valid = validPassage(state);
    if (diff(state, valid)) {
      this.setState(valid);
    }
  }

  handler(e: React.SyntheticEvent) {
    switch (e.type) {
      case 'change': {
        const cbid = e.currentTarget.id as keyof PassageWinState['checkbox'];
        this.setState((prevState: PassageWinState) => {
          const s: Partial<PassageWinState> = {
            checkbox: {
              ...prevState.checkbox,
              [cbid]: !prevState.checkbox[cbid],
            },
          };
          return s;
        });
        break;
      }
      default:
        throw new Error(`Unhandled event type ${e.type} in printPassage.tsx`);
    }
  }

  render() {
    const state = this.state as PassageWinState;
    const { firstChapter, lastChapter } = state;
    const { checkbox } = state;
    const { handler, vkSelectHandler } = this;

    const vkmod = firstChapter?.vkmod;
    if (!vkmod) return null;

    const isHebrew = /^heb?$/i.test(G.Tab[vkmod].lang);
    const tr = isHebrew ? 1 : 0;

    const printControl = document.getElementById(
      'printControl'
    ) as HTMLDivElement | null;

    return (
      <>
        <Vbox
          className="sb"
          pack="start"
          flex="1"
          dir={G.Tab[vkmod].direction || 'auto'}
        >
          {JSON_stringify(state)}
        </Vbox>
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
