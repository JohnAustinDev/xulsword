import React, { ChangeEvent } from 'react';
import PropTypes from 'prop-types';
import WebAppViewport from '../../webapp/viewport.ts';
import { ofClass } from '../../../common.ts';
import { xulPropTypes, htmlAttribs } from '../libxul/xul.tsx';
import { AnchorButton } from '../libxul/button.tsx';
import Menupopup from '../libxul/menupopup.tsx';
import ModuleMenu from '../libxul/modulemenu.tsx';
import { G, GI } from '../../G.ts';
import RenderPromise from '../../renderPromise.ts';
import './tabs.css';

import type { XulswordStateArgType } from '../../../type.ts';
import type {
  RenderPromiseComponent,
  RenderPromiseState,
} from '../../renderPromise.ts';
import type { XulProps } from '../libxul/xul.tsx';
import type { TonCellClick } from '../libxul/table.tsx';
import { doUntilDone } from '../../common.tsx';

const propTypes = {
  ...xulPropTypes,
  isPinned: PropTypes.bool.isRequired,
  module: PropTypes.string,
  panelIndex: PropTypes.number.isRequired,
  tabs: PropTypes.arrayOf(PropTypes.string).isRequired,
  ilModule: PropTypes.string,
  ilModuleOption: PropTypes.arrayOf(PropTypes.string).isRequired,
  mtModule: PropTypes.string,
  xulswordState: PropTypes.func,
};

type TabsProps = {
  isPinned: boolean;
  module: string | undefined;
  panelIndex: number;
  tabs: string[];
  ilModule: string | undefined;
  ilModuleOption: Array<string | undefined>;
  mtModule: string | undefined;
  xulswordState: (s: XulswordStateArgType) => void;
} & XulProps;

type TabsState = RenderPromiseState & {
  multiTabs: string[];
  multiTabMenupopup: any;
};

// XUL Tabs
class Tabs extends React.Component implements RenderPromiseComponent {
  static propTypes: typeof propTypes;

  renderPromise: RenderPromise;

  loadingRef: React.RefObject<HTMLDivElement>;

  resizeObserver: ResizeObserver;

  constructor(props: TabsProps) {
    super(props);

    this.state = {
      multiTabMenupopup: null,
      multiTabs: [],
      renderPromiseID: 0,
    } as TabsState;

    this.checkTabWidth = this.checkTabWidth.bind(this);
    this.multiTabButtonClick = this.multiTabButtonClick.bind(this);
    this.getTab = this.getTab.bind(this);
    this.getMultiTabSelection = this.getMultiTabSelection.bind(this);
    this.toggleTab = this.toggleTab.bind(this);

    this.loadingRef = React.createRef();
    this.renderPromise = new RenderPromise(this, this.loadingRef);
    this.resizeObserver = new ResizeObserver(() =>
      this.setState({ multiTabs: [] }),
    );
  }

  // Only when the tabs key prop changes will React instantiate a new tabs
  // component and thus resize the tabs to the current window.
  componentDidMount() {
    const { renderPromise, resizeObserver, loadingRef } = this;
    if (loadingRef && loadingRef.current) {
      resizeObserver.observe(loadingRef.current);
    }
    renderPromise.dispatch();
  }

  componentWillUnmount() {
    const { resizeObserver, loadingRef } = this;
    if (loadingRef && loadingRef.current) {
      resizeObserver.unobserve(loadingRef.current);
    }
  }

  componentDidUpdate() {
    const { checkTabWidth, renderPromise } = this;
    if (!renderPromise.waiting()) checkTabWidth();
    renderPromise.dispatch();
  }

  toggleTab(e: React.SyntheticEvent<ChangeEvent>) {
    const { target } = e;
    if (target) {
      const { value } = target as HTMLSelectElement;
      const { panelIndex, xulswordState } = this.props as TabsProps;
      const vp = Build.isWebApp ? WebAppViewport : G.Viewport;
      doUntilDone((renderPromise2) => {
        const xs = vp.setXulswordTabs(
          {
            panelIndex,
            whichTab: value,
            doWhat: 'toggle',
          },
          renderPromise2,
        );
        if (!renderPromise2.waiting()) {
          const tabBank = xs.tabs[panelIndex];
          if (tabBank && tabBank.includes(value)) {
            xulswordState((prevState) => {
              let { panels } = prevState;
              panels = panels.slice();
              panels[panelIndex] = value;
              return { panels };
            });
          }
        }
      });
    }
  }

  getTab(
    m: string | undefined,
    type: string,
    classes: string,
    children: any = null,
    renderPromise: RenderPromise,
  ) {
    const { panelIndex: i } = this.props as TabsProps;
    const tabType = !m || type === 'ilt-tab' ? 'Texts' : G.Tab[m].tabType;
    const label =
      !m || type === 'ilt-tab'
        ? GI.i18n.t('', renderPromise, 'ORIGLabelTab')
        : G.Tab[m].label;
    return (
      <div
        key={`${type}_${i}_${m}`}
        className={`${type} tab tab${tabType} ${classes}`}
        data-module={m}
        data-index={i}
        title={(m && m in G.Tab && G.Tab[m].description.locale) || undefined}
      >
        <div className="border">
          <div className="tab-label">{label}</div>
          {children}
        </div>
      </div>
    );
  }

  getMultiTabSelection(multiTabs: string[]) {
    const { module, mtModule } = this.props as TabsProps;
    if (module && multiTabs.includes(module)) return module;
    if (mtModule && multiTabs.includes(mtModule)) return mtModule;
    if (multiTabs.length && multiTabs[0]) return multiTabs[0];
    return null;
  }

  // Move tabs to the multi-tab until there is no overflow.
  checkTabWidth() {
    const { loadingRef } = this;
    const { tabs, panelIndex } = this.props as TabsProps;
    const tabsrow = loadingRef.current;
    const state = this.state as TabsState;
    if (tabsrow && !state.multiTabs.length) {
      const multiTabs: string[] = [];
      const pttab = tabsrow.getElementsByClassName(
        'tabPlus',
      )[0] as HTMLElement | null;
      const tdivs = tabsrow.getElementsByClassName(
        'reg-tab',
      ) as HTMLCollectionOf<HTMLElement>;
      const iltab = tabsrow.getElementsByClassName(
        'ilt-tab',
      )[0] as HTMLElement | null;

      const fudge = 10;
      const padding = 30; // .tabs {padding-inline-start: 20px; padding-inline-end: 10px;}
      const tm = 3; // .tabs .tab {margin: 0px 3px 0px 3px;}
      const mtwidthMax = tabsrow.clientWidth / 2; // .tabs .mts-tab {max-width: 50%;}
      const ptwidth = pttab ? pttab.offsetWidth + tm + tm : 0;
      const towids =
        (tdivs && Array.from(tdivs).map((d) => d.offsetWidth)) || [];
      const iltwidth = iltab ? iltab.offsetWidth + tm + tm : 0;

      let contentWidth = 0;
      for (;;) {
        // The future mts-tab width must be recalculated for each width check.
        const mtselect = this.getMultiTabSelection(multiTabs);
        const mtindex = mtselect !== null ? tabs.indexOf(mtselect) : -1;
        let mtwidth = mtindex > -1 ? towids[mtindex] + tm + tm : 0;
        if (mtwidth > mtwidthMax) mtwidth = mtwidthMax; // done by css

        // Get the index of the ntext tab to be moved if this tab bank is too wide.
        const nextTabIndex = multiTabs.length
          ? tabs.indexOf(multiTabs[0]) - 1
          : tabs.length - 1;

        // Calculate width of all regular tabs, including their margins.
        const ntwidth = towids
          .slice(0, nextTabIndex + 1)
          .reduce((p, c) => p + c + tm + tm, 0);

        contentWidth = fudge + padding + ptwidth + ntwidth + mtwidth + iltwidth;
        /*
        log.debug(`Tab row ${panelIndex}: ${JSON_stringify({
          calcWidth: contentWidth,
          realWidth: tabsrow.clientWidth,
          fudge,
          padding,
          ptwidth,
          ntwidth,
          mtwidth,
          iltwidth,
        })}`);
*/
        if (nextTabIndex === -1 || contentWidth < tabsrow.clientWidth) {
          break;
        }
        // It's still too wide, so move the next tab into the multi-tab.
        multiTabs.unshift(tabs[nextTabIndex]);
      }

      // If tab bank is too narrrow to display required tabs, remove the iltab.
      if (iltab && contentWidth > tabsrow.clientWidth) {
        iltab.style.display = 'none';
      }

      if (multiTabs.length) this.setState({ multiTabs });
    }
  }

  multiTabButtonClick(e: React.SyntheticEvent<TonCellClick>) {
    const { renderPromise } = this;
    const { multiTabMenupopup } = this.state as TabsState;
    if (
      !multiTabMenupopup ||
      (multiTabMenupopup && ofClass('button-box', e.target))
    )
      e.stopPropagation();
    this.setState((prevState: TabsState) => {
      let newpup = null;
      if (!prevState.multiTabMenupopup) {
        const { multiTabs } = prevState;
        const textrow = document.getElementsByClassName('textrow');
        const height = textrow.length ? textrow[0].clientHeight : null;
        newpup = (
          <Menupopup style={height ? { maxHeight: `${height}px` } : undefined}>
            {multiTabs.map((m) => {
              return this.getTab(
                m,
                'mto-tab',
                m === this.getMultiTabSelection(multiTabs) ? 'selected' : '',
                null,
                renderPromise,
              );
            })}
          </Menupopup>
        );
      }
      return { multiTabMenupopup: newpup };
    });
  }

  render() {
    const { multiTabs, multiTabMenupopup } = this.state as TabsState;
    const { module, isPinned, panelIndex, tabs, ilModule, ilModuleOption } =
      this.props as TabsProps;
    const { loadingRef, renderPromise, toggleTab } = this;

    let ilTabLabel = GI.i18n.t('', renderPromise, 'ORIGLabelTab');
    if (!ilTabLabel) ilTabLabel = 'ilt';

    const mtMod = this.getMultiTabSelection(multiTabs);

    let ilcls = '';
    if (ilModule) ilcls = 'active';
    if (ilModule === 'disabled') ilcls = 'disabled';

    let cls = `tabs${panelIndex}`;
    if (isPinned) cls += ' pinned';
    if (multiTabMenupopup) cls += ' open';

    return (
      <div
        ref={loadingRef}
        {...htmlAttribs(`tabs ${cls}`, this.props)}
        data-index={panelIndex}
        data-ispinned={isPinned}
      >
        {module &&
          isPinned &&
          this.getTab(module, 'reg-tab', 'active', null, renderPromise)}
        {!isPinned && G.Prefs.getBoolPref('xulsword.tabcntl') && (
          <div
            className={`tabPlus tab active`}
            title={GI.i18n.t('', renderPromise, 'Add a tab, or remove a tab.')}
          >
            <div className="border">
              <ModuleMenu
                value={''}
                language
                description
                onChange={toggleTab}
              />
            </div>
          </div>
        )}
        {tabs.map((m: string) => {
          if (isPinned || !m || multiTabs.includes(m)) return null;
          const selected = m === module ? 'active' : '';
          return this.getTab(m, 'reg-tab', selected, null, renderPromise);
        })}
        {!isPinned &&
          multiTabs.length > 0 &&
          mtMod &&
          this.getTab(
            mtMod,
            'mts-tab',
            module === mtMod ? 'active' : '',
            <AnchorButton onClick={this.multiTabButtonClick}>
              {multiTabMenupopup}
            </AnchorButton>,
            renderPromise,
          )}
        {!isPinned &&
          (ilModule === 'disabled' || ilModuleOption[0]) &&
          this.getTab(ilModuleOption[0], 'ilt-tab', ilcls, null, renderPromise)}
      </div>
    );
  }
}
Tabs.propTypes = propTypes;

export default Tabs;
