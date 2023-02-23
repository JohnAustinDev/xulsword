/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React from 'react';
import ReactDOM from 'react-dom';
import { ProgressBar } from '@blueprintjs/core';
import { clone, diff, drop, dString, sanitizeHTML } from '../../common';
import C from '../../constant';
import G from '../rg';
import renderToRoot from '../renderer';
import log from '../log';
import { windowArgument } from '../rutil';
import {
  PopupParent,
  PopupParentState,
  popupParentHandler as popupParentHandlerH,
  popupHandler as popupHandlerH,
  PopupParentInitState,
} from '../popup/popupParentH';
import Button from '../libxul/button';
import { xulDefaultProps, XulProps, xulPropTypes } from '../libxul/xul';
import { Box, Hbox, Vbox } from '../libxul/boxes';
import Groupbox from '../libxul/groupbox';
import Label from '../libxul/label';
import Menulist from '../libxul/menulist';
import Radio from '../libxul/radio';
import Grid, { Column, Columns, Row, Rows } from '../libxul/grid';
import Textbox from '../libxul/textbox';
import Spacer from '../libxul/spacer';
import Stack from '../libxul/stack';
import ModuleMenu from '../libxul/modulemenu';
import handlerH, {
  search,
  searchArg,
  hilightStrongs,
  formatResult,
  lexicon,
  strongsCSS,
  getSearchResults,
} from './searchH';
import './search.css';

import type { BookGroupType, SearchType } from '../../type';
import Popup from '../popup/popup';

const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
};

type SearchWinProps = XulProps;

const initialState = {
  module: '' as string, // search module
  searchtext: '' as string, // search text
  searchtype: 'SearchExactText' as SearchType['type'], // type of search to do
  scoperadio: 'all' as typeof ScopeRadioOptions[number], // scope radio value
  scopeselect: 'gospel' as BookGroupType | typeof ScopeSelectOptions[number], // scope select value
  moreLess: true as boolean, // more / less state
  displayBible: '' as string, // current module for Bible search results
  results: null as number | null, // count and page-result are returned at different times
  pageindex: 0 as number, // first results index to show
  progress: 0 as number, // -1=indeterminate, 0=hidden, 1=complete
  progressLabel: '' as string, // changing progress label
};

const ScopeRadioOptions = ['all', 'book', 'ot', 'nt', 'other'] as const;

const ScopeSelectOptions = [
  'pentateuch',
  'history',
  'wisdom',
  'prophets',
  'gospel',
  'letters',
] as const;

const Scopemap = {
  pentateuch: 'Gen-Deut',
  history: 'Josh-Esth',
  wisdom: 'Job-Song',
  prophets: 'Isa-Mal',
  gospel: 'Matt-John',
  letters: 'Acts-Rev',
};

// These state properties will not be persisted if xulsword is closed.
const noPersist = ['results', 'pageindex', 'progress', 'progressLabel'].concat(
  Object.keys(PopupParentInitState)
) as (
  | keyof typeof PopupParentInitState
  | 'results'
  | 'pageindex'
  | 'progress'
  | 'progressLabel'
)[];

let resetState = null as null | SearchWinState;

export type SearchWinState = PopupParentState & typeof initialState;

export default class SearchWin extends React.Component implements PopupParent {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  handler: typeof handlerH;

  popupParentHandler: typeof popupParentHandlerH;

  popupHandler: typeof popupHandlerH;

  popupDelayTO: PopupParent['popupDelayTO'];

  popupUnblockTO: PopupParent['popupUnblockTO'];

  resref: React.RefObject<HTMLDivElement>;

  lexref: React.RefObject<HTMLDivElement>;

  destroy: (() => void)[];

  constructor(props: SearchWinProps) {
    super(props);

    const abible = G.Tabs.find((t) => t.type === C.BIBLE);

    const s: SearchWinState = {
      ...PopupParentInitState,
      ...initialState,
      module: searchArg.module,
      searchtext: searchArg.searchtext,
      searchtype: searchArg.type,
      displayBible:
        searchArg.module &&
        searchArg.module in G.Tab &&
        G.Tab[searchArg.module].type === C.BIBLE
          ? searchArg.module
          : abible?.module ?? '',
    };
    // Adjustments for special startup situations
    if (!(s.module in G.Tab)) s.module = abible?.module || '';
    if (searchArg?.scope) {
      s.scoperadio = 'other';
      s.scopeselect = searchArg.scope as any;
    }
    if (!s.moreLess && s.module && !G.LibSword.luceneEnabled(s.module)) {
      s.moreLess = true;
    }

    const pstate = windowArgument('pstate') as SearchWinState;
    this.state = resetState || pstate || s;

    this.handler = handlerH.bind(this);
    this.popupParentHandler = popupParentHandlerH.bind(this);
    this.popupHandler = popupHandlerH.bind(this);

    this.resref = React.createRef();
    this.lexref = React.createRef();
    this.destroy = [];
  }

  componentDidMount() {
    const state = this.state as SearchWinState;
    const { module } = state;
    this.destroy.push(
      window.ipc.on('progress', (prog: number, id?: string) => {
        if (id === 'search.indexer') {
          this.setState({ progressLabel: '', progress: prog });
        }
      })
    );
    if (module && G.LibSword.luceneEnabled(module)) search(this);
  }

  componentDidUpdate(_prevProps: any, prevState: SearchWinState) {
    const state = this.state as SearchWinState;
    resetState = clone(state);
    const pstate = drop(state, noPersist) as Omit<
      SearchWinState,
      typeof noPersist[number]
    >;
    const psx = pstate as any;
    const isx = initialState as any;
    if (
      diff(
        { ...prevState, popupParent: null },
        { ...pstate, popupParent: null }
      )
    ) {
      noPersist.forEach((p) => {
        psx[p] = isx[p];
      });
      G.Window.setComplexValue('pstate', pstate);
    }

    const { displayBible, module, pageindex, results, searchtext } = state;
    const { resref, lexref } = this;
    const res = resref !== null ? resref.current : null;
    const lex = lexref !== null ? lexref.current : null;
    if (res === null || !module) return;
    const count = results || 0;

    function lexupdate(dModule: string, dModuleIsStrongs: boolean) {
      if (lex === null || res === null) return;
      if (
        res.dataset.count !== count.toString() ||
        res.dataset.module !== dModule
      ) {
        // build a lexicon for the search
        if (!dModule || !results || !dModuleIsStrongs) {
          sanitizeHTML(lex, '');
        } else {
          lexicon(lex, state);
        }
      }
      res.dataset.count = count.toString();
      res.dataset.module = dModule;
      res.dataset.pageindex = pageindex.toString();
    }

    if (res.dataset.count !== count.toString()) {
      strongsCSS.added.forEach((r) => {
        strongsCSS.sheet.deleteRule(r);
      });
      strongsCSS.added = [];
    }

    const dModule = G.Tab[module].type === C.BIBLE ? displayBible : module;
    let dModuleIsStrongs = false;
    if (
      res.dataset.count !== count.toString() ||
      res.dataset.module !== dModule ||
      res.dataset.pageindex !== pageindex.toString()
    ) {
      if (!dModule || !results) {
        sanitizeHTML(res, '');
      } else {
        // build a page from results, module and pageindex
        if (G.Tab[dModule].isVerseKey) {
          dModuleIsStrongs = /Strongs/i.test(
            G.LibSword.getModuleInformation(dModule, 'Feature') +
              G.LibSword.getModuleInformation(dModule, 'GlobalOptionFilter')
          );
        }
        if (dModuleIsStrongs && /lemma:/.test(searchtext)) {
          hilightStrongs(searchtext.match(/lemma:\s*\S+/g));
        }
        getSearchResults(
          dModule,
          pageindex,
          C.UI.Search.resultsPerPage,
          dModuleIsStrongs
        )
          .then((result) => {
            sanitizeHTML(res, result);
            formatResult(res, state);
            return lexupdate(dModule, dModuleIsStrongs);
          })
          .catch((er) => {
            log.warn(er);
            sanitizeHTML(res, '');
          });
        return;
      }
    }

    lexupdate(dModule, dModuleIsStrongs);
  }

  componentWillUnmount() {
    this.destroy.forEach((d) => d());
  }

  render() {
    const state = this.state as SearchWinState;
    const { handler, popupHandler, popupParentHandler } = this;
    const {
      module,
      searchtext,
      searchtype,
      scoperadio,
      scopeselect,
      results,
      moreLess,
      pageindex,
      progress,
      progressLabel,
      displayBible,
      popupParent,
      popupReset,
      eleminfo,
      gap,
      elemhtml,
    } = state;

    const searchTypes: SearchType['type'][] = [
      'SearchAnyWord',
      'SearchSimilar',
      'SearchExactText',
      'SearchAdvanced',
    ];

    const sos = ScopeSelectOptions.slice() as SearchWinState['scopeselect'][];

    if (searchArg.scope) sos.unshift(searchArg.scope as any);
    C.SupportedBookGroups.forEach((bg) => {
      if (
        module &&
        !['ot', 'nt'].includes(bg) &&
        G.getBooksInModule(module).some((bk) => {
          const x = C.SupportedBooks[bg] as any;
          return x.includes(bk);
        })
      ) {
        sos.push(bg);
      }
    });

    const scopeOptions = sos.map((option) => {
      return (
        <option
          key={option}
          value={
            option in Scopemap
              ? Scopemap[option as keyof typeof Scopemap]
              : option
          }
        >
          {G.i18n.exists(`${option}.label`)
            ? G.i18n.t(`${option}.label`)
            : option}
        </option>
      );
    });

    const location = G.Prefs.getComplexValue(
      'xulsword.location'
    ) as typeof C.SyncPrefs['xulsword']['location'];

    const searchindex = module && G.LibSword.luceneEnabled(module);

    const count = results || 0;
    const lasti =
      count - pageindex < C.UI.Search.resultsPerPage
        ? count
        : pageindex + C.UI.Search.resultsPerPage;
    let searchStatus = '';
    const { i18n } = G;
    if (count > C.UI.Search.resultsPerPage) {
      searchStatus = G.i18n.t('searchStatusPage', {
        v1: dString(i18n, pageindex + 1),
        v2: dString(i18n, lasti),
        v3: dString(i18n, count),
      });
    } else {
      searchStatus = G.i18n.t('searchStatusAll', {
        v1: dString(i18n, count),
      });
    }

    return (
      <Vbox className="searchwin">
        {popupParent &&
          elemhtml &&
          elemhtml.length &&
          ReactDOM.createPortal(
            <Popup
              key={[gap, elemhtml.length, popupReset].join('.')}
              elemhtml={elemhtml}
              eleminfo={eleminfo}
              gap={gap}
              onMouseMove={popupHandler}
              onPopupClick={popupHandler}
              onSelectChange={popupHandler}
              onMouseLeftPopup={popupHandler}
              onPopupContextMenu={popupHandler}
            />,
            popupParent
          )}
        <Hbox pack="center">
          <Grid
            className={['search-grid', moreLess ? 'more' : 'less'].join(' ')}
          >
            <Columns>
              <Column width="min-content" />
              <Column width="min-content" />
            </Columns>
            <Rows>
              <Row>
                <Groupbox orient="horizontal" align="center">
                  <Button id="moreLess" onClick={handler}>
                    {!moreLess && <Label value={G.i18n.t('more.label')} />}
                    {moreLess && <Label value={G.i18n.t('less.label')} />}
                  </Button>
                  <Spacer flex="1" orient="horizontal" />
                  <Hbox className="searchtextLabel" align="start">
                    <Label
                      control="searchtext"
                      value={`${G.i18n.t('searchtext.label')}:`}
                    />
                  </Hbox>
                  <Vbox className="searchtext">
                    <Textbox
                      id="searchtext"
                      value={searchtext}
                      title={G.i18n.t('searchbox.tooltip')}
                      maxLength="60"
                      onChange={handler}
                    />
                    <ModuleMenu id="module" value={module} onChange={handler} />
                  </Vbox>
                  <Button
                    id="searchButton"
                    icon="search"
                    disabled={progress !== 0 || !module}
                    onClick={handler}
                  >
                    {G.i18n.t('menu.search')}
                  </Button>
                  <Spacer flex="1" orient="horizontal" />
                  <Button id="helpButton" icon="help" onClick={handler} />
                </Groupbox>
              </Row>
              <Row>
                <Stack
                  className="searchType"
                  orient="horizontal"
                  align="stretch"
                >
                  <Groupbox
                    id="searchtype"
                    caption={G.i18n.t('searchType.label')}
                    orient="vertical"
                    onChange={handler}
                  >
                    {searchTypes.map((st) => (
                      <Radio
                        key={['type', st].join('.')}
                        name="type"
                        checked={searchtype === st}
                        value={st}
                        label={G.i18n.t(`${st}.label`)}
                        title={G.i18n.t(`${st}.description`)}
                      />
                    ))}
                  </Groupbox>
                  {!searchindex && (
                    <>
                      <Vbox />
                      <Vbox align="center">
                        <Button
                          id="createIndexButton"
                          disabled={progress !== 0}
                          onClick={handler}
                        >
                          {G.i18n.t('createIndex.label')}
                        </Button>
                      </Vbox>
                    </>
                  )}
                </Stack>
                <Groupbox
                  id="scoperadio"
                  caption={G.i18n.t('searchScope.label')}
                  onChange={handler}
                >
                  <Grid>
                    <Columns>
                      <Column width="min-content" />
                      <Column width="min-content" />
                    </Columns>
                    <Rows>
                      <Row>
                        <Radio
                          name="scope"
                          checked={scoperadio === 'all'}
                          value="all"
                          label={G.i18n.t('search.all')}
                        />
                        <Radio
                          name="scope"
                          checked={scoperadio === 'book'}
                          value="book"
                          label={G.i18n.t('search.currentBook')}
                          disabled={!location?.book}
                        />
                      </Row>
                      <Row>
                        <Radio
                          name="scope"
                          checked={scoperadio === 'ot'}
                          value="ot"
                          label={G.i18n.t('search.ot')}
                        />
                        <Radio
                          name="scope"
                          checked={scoperadio === 'nt'}
                          value="nt"
                          label={G.i18n.t('search.nt')}
                        />
                      </Row>
                      <Row>
                        <div>
                          <Radio
                            name="scope"
                            checked={scoperadio === 'other'}
                            value="other"
                            label={`${G.i18n.t('search.groups')}:`}
                          />
                          <Menulist
                            id="scopeselect"
                            value={scopeselect}
                            options={scopeOptions}
                            disabled={scoperadio !== 'other'}
                            onChange={handler}
                          />
                        </div>
                      </Row>
                    </Rows>
                  </Grid>
                </Groupbox>
              </Row>
            </Rows>
          </Grid>
        </Hbox>

        <Spacer height={moreLess ? '20' : '10'} />

        <Vbox className="result-container" flex="1">
          <Hbox flex="1">
            <Vbox
              className="resultBox"
              flex="1"
              data-context={displayBible}
              onMouseOut={popupParentHandler}
              onMouseOver={popupParentHandler}
              onMouseMove={popupParentHandler}
            >
              {module && G.Tab[module].type === C.BIBLE && (
                <div>
                  <ModuleMenu
                    id="displayBible"
                    value={displayBible}
                    types={[C.BIBLE]}
                    disabled={!module || G.Tab[module].type !== C.BIBLE}
                    onChange={handler}
                  />
                  <span
                    id="lexiconResults"
                    ref={this.lexref}
                    onClick={handler}
                  />
                </div>
              )}
              <Spacer orient="horizontal" />
              <div id="searchResults" ref={this.resref} onClick={handler} />
            </Vbox>
            {count > C.UI.Search.resultsPerPage && (
              <Vbox>
                <Button
                  id="pagefirst"
                  icon="double-chevron-up"
                  disabled={progress !== 0}
                  onClick={handler}
                />
                <Spacer orient="vertical" flex="1" />
                <Button
                  id="pageprev"
                  icon="chevron-up"
                  disabled={progress !== 0}
                  onClick={handler}
                />
                <Button
                  id="pagenext"
                  icon="chevron-down"
                  disabled={progress !== 0}
                  onClick={handler}
                />
                <Spacer orient="vertical" flex="1" />
                <Button
                  id="pagelast"
                  icon="double-chevron-down"
                  disabled={progress !== 0}
                  onClick={handler}
                />
              </Vbox>
            )}
          </Hbox>
          <Hbox className="searchStatus" pack="start" align="center">
            <Box>
              <span>{searchStatus}</span>
            </Box>
            <Spacer flex="1" />
            {progress !== 0 && (
              <Hbox align="center">
                {progressLabel && <Label value={`${progressLabel}:`} />}
                <ProgressBar value={progress === -1 ? undefined : progress} />
              </Hbox>
            )}
          </Hbox>
        </Vbox>
      </Vbox>
    );
  }
}
SearchWin.defaultProps = defaultProps;
SearchWin.propTypes = propTypes;

renderToRoot(<SearchWin height="100%" />, {
  resetOnResize: false,
});
