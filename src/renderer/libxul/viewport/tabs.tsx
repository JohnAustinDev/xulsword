/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/static-property-placement */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import PropTypes from 'prop-types';
import C from '../../../constant';
import { ofClass } from '../../../common';
import { xulDefaultProps, xulPropTypes, XulProps, htmlAttribs } from '../xul';
import { AnchorButton } from '../button';
import Menupopup from '../menupopup';
import G from '../../rg';
import './tabs.css';

const defaultProps = xulDefaultProps;

const propTypes = {
  ...xulPropTypes,
  isPinned: PropTypes.bool.isRequired,
  module: PropTypes.string,
  panelIndex: PropTypes.number.isRequired,
  tabs: PropTypes.arrayOf(PropTypes.string).isRequired,
  ilModule: PropTypes.string,
  ilModuleOption: PropTypes.arrayOf(PropTypes.string).isRequired,
  mtModule: PropTypes.string,
};

interface TabsProps extends XulProps {
  isPinned: boolean;
  module: string | undefined;
  panelIndex: number;
  tabs: string[];
  ilModule: string | undefined;
  ilModuleOption: (string | undefined)[];
  mtModule: string | undefined;
}

interface TabsState {
  multiTabs: string[];
  multiTabMenupopup: any;
}

// XUL Tabs
class Tabs extends React.Component {
  static defaultProps: typeof defaultProps;

  static propTypes: typeof propTypes;

  tabsref: React.RefObject<HTMLDivElement>;

  constructor(props: TabsProps) {
    super(props);

    this.state = {
      multiTabMenupopup: null,
      multiTabs: [],
    };
    this.tabsref = React.createRef();
    this.checkTabWidth = this.checkTabWidth.bind(this);
    this.multiTabButtonClick = this.multiTabButtonClick.bind(this);
    this.getTab = this.getTab.bind(this);
    this.getMultiTabSelection = this.getMultiTabSelection.bind(this);
  }

  // Only when the tabs key prop changes will React instantiate a new tabs
  // component and thus resize the tabs to the current window.
  componentDidMount() {
    this.checkTabWidth();
  }

  getTab(
    m: string | undefined,
    type: string,
    classes: string,
    children: any = null
  ) {
    const { panelIndex: i } = this.props as TabsProps;
    const tabType = !m || type === 'ilt-tab' ? 'Texts' : G.Tab[m].tabType;
    const label =
      !m || type === 'ilt-tab' ? G.i18n.t('ORIGLabelTab') : G.Tab[m].label;
    return (
      <div
        key={`${type}_${i}_${m}`}
        className={`${type} tab tab${tabType} ${classes}`}
        data-module={m}
        data-index={i}
        title={
          (m && m in G.Tab && G.Tab[m].conf.Description?.locale) || undefined
        }
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
    const { tabsref } = this;
    const { tabs } = this.props as TabsProps;
    const { multiTabs } = this.state as TabsState;
    const newMultiTabs = multiTabs.slice();
    const tabsdiv = tabsref.current;
    const tdivs = tabsdiv?.getElementsByClassName(
      'reg-tab'
    ) as HTMLCollectionOf<HTMLElement>;
    const twids =
      (tdivs &&
        Array.from(tdivs).map(
          (d) => d.offsetWidth + 2 * C.UI.Viewport.TabMargin
        )) ||
      [];
    const iltab = tabsdiv?.getElementsByClassName(
      'ilt-tab'
    )[0] as HTMLElement | null;
    const iltwidth =
      (iltab && iltab.offsetWidth + 2 * C.UI.Viewport.TabMargin) || 0;
    for (;;) {
      // The future mts-tab width must be recalculated for each width check.
      const mtsel = this.getMultiTabSelection(newMultiTabs);
      const mtindex = mtsel !== null ? tabs.indexOf(mtsel) : -1;
      const mtwidth = mtindex > -1 ? twids[mtindex] : 0;
      // Get the index of the ntext tab to be moved.
      const nextTabIndex = newMultiTabs.length
        ? tabs.indexOf(newMultiTabs[0]) - 1
        : tabs.length - 1;
      if (nextTabIndex < 0) break;
      const contentWidth =
        C.UI.Viewport.TabRowMargin +
        2 * C.UI.Viewport.TabMarginFirstLast +
        twids.slice(0, nextTabIndex + 1).reduce((p, c) => p + c, 0) +
        mtwidth +
        iltwidth;
      if (
        !tabsdiv ||
        tabs.length <= 2 ||
        (newMultiTabs.length !== 1 && contentWidth <= tabsdiv.clientWidth)
      ) {
        break;
      }
      // Move next tab to the multi-tab.
      newMultiTabs.unshift(tabs[nextTabIndex]);
    }
    if (multiTabs.length !== newMultiTabs.length) {
      this.setState({ multiTabs: newMultiTabs });
    }
  }

  multiTabButtonClick(e: any) {
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
                m === this.getMultiTabSelection(multiTabs) ? 'selected' : ''
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

    let ilTabLabel = G.i18n.t('ORIGLabelTab');
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
        {...htmlAttribs(`tabs ${cls}`, this.props)}
        ref={this.tabsref}
        data-index={panelIndex}
        data-ispinned={isPinned}
      >
        {module && isPinned && this.getTab(module, 'reg-tab', 'active')}
        {tabs.map((m: string) => {
          if (isPinned || !m || multiTabs.includes(m)) return null;
          const selected = m === module ? 'active' : '';
          return this.getTab(m, 'reg-tab', selected);
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
            </AnchorButton>
          )}
        {!isPinned &&
          (ilModule === 'disabled' || ilModuleOption[0]) &&
          this.getTab(ilModuleOption[0], 'ilt-tab', ilcls, null)}
      </div>
    );
  }
}
Tabs.defaultProps = defaultProps;
Tabs.propTypes = propTypes;

export default Tabs;
