/* eslint-disable jsx-a11y/media-has-caption */
/* eslint-disable prettier/prettier */
import React from 'react';
import { Translation } from 'react-i18next';
import { jsdump } from '../rutil';
import Chooser from './chooser';
import Text from './text';
import Notepopup from './notepopup';
import { Hbox, Vbox } from '../libxul/boxes';
import Menupopup from '../libxul/menupopup';
import Bookselect from '../libxul/bookselect';
import Spacer from '../libxul/spacer';
import Textbox from '../libxul/textbox';
import Toolbox from '../libxul/toolbox';
import G from '../gr';
import handler from './handler';
import './xulsword.css';

interface ViewportState {
  selectedTab: string;
}

export default class Viewport extends React.Component {

  eHandler = handler;

  constructor(props: Record<string, never>) {
    super(props);
    this.state = {
      selectedTab: undefined,
    };

    this.eHandler = this.eHandler.bind(this);
  }

  render() {
    jsdump(`Rendering Viewport ${JSON.stringify(this.state)}`);

    return (<Translation>{(t) => (
<body id="viewportbody" chooser="bible" print="false" isWindow="false" hasOriginalLanguage="false"
			onload="BibleNavigator.init(); Popup = new PopupObj(); initViewPort();">

		<div id="chbutton_open" onclick="BibleNavigator.mouseHandler(event)"></div>

		<div id="viewport">

      <Chooser />

			<div id="textarea" windows="show3">
				<div id="tabrow" onmouseover="tabMouse(event);" onmouseout="tabMouse(event);" onclick="tabMouse(event);">

					<div id="tabrowf">
						<div id="tabs1" class="tabs" pinned="false" noBibleTabs="false" moduleType="Texts"></div>
						<div id="tabs2" class="tabs" pinned="false" noBibleTabs="false" moduleType="Texts"></div>
						<div id="tabs3" class="tabs" pinned="false" noBibleTabs="false" moduleType="Texts"></div>
					</div>

				</div>

				<div id="textrow"
						onclick="scriptClick(event)"
						ondblclick="scriptDblClick(event)"
						onmouseover="scriptMouseOver(event)"
						onmouseout="scriptMouseOut(event)"
						onmousemove="bbMouseMove(event);"
						onmouseup="bbMouseUp(event);">

					<Text id="text1" class="text userFontSize" textdir="ltr" moduleType="Texts" columns="show1" pinned="false"
							footnotesEmpty="false" footnotesMaximized="false" CanDoNextPage="false" CanDoPreviousPage="false"
							versePerLine="false" />

					<Text id="text2" class="text userFontSize" textdir="ltr" moduleType="Texts" columns="show1" pinned="false"
							footnotesEmpty="false" footnotesMaximized="false" CanDoNextPage="false" CanDoPreviousPage="false"
							versePerLine="false" />

					<Text id="text3" class="text userFontSize" textdir="ltr" moduleType="Texts" columns="show1" pinned="false"
							footnotesEmpty="false" footnotesMaximized="false" CanDoNextPage="false" CanDoPreviousPage="false"
							versePerLine="false" />

				</div>

			</div>
		</div>

		<Notepopup id="npopup" class="userFontSize cs-Program" isWindow="false" puptype="fn" />

  </body>
)}</Translation>)
  }
}
