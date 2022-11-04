/* eslint-disable react/forbid-prop-types */
/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */

import React from 'react';
import i18n from 'i18next';
import PropTypes from 'prop-types';
import { sanitizeHTML } from '../../common';
import { moduleInfoHTML } from '../rutil';
import G from '../rg';
import { addClass, xulDefaultProps, xulPropTypes, XulProps } from './xul';
import { Vbox } from './boxes';
import Button from './button';
import Label from './label';
import './modinfo.css';

import type { SwordConfType } from '../../type';

// XUL Sword module info and config
const defaultProps = {
  ...xulDefaultProps,
  configs: undefined,
  showConf: undefined,
  editConf: undefined,
  conftextRef: undefined,
  handler: undefined,
};

const propTypes = {
  ...xulPropTypes,
  modules: PropTypes.arrayOf(PropTypes.string),
  configs: PropTypes.arrayOf(PropTypes.object),
  showConf: PropTypes.number,
  editConf: PropTypes.bool,
  conftextRef: PropTypes.object,
  handler: PropTypes.func,
};

interface ModinfoProps extends XulProps {
  modules: string[]; // modules to show
  configs: (SwordConfType | null)[] | undefined; // required only if modules are not already installed
  showConf: number | undefined; // index of module whose conf to show, or -1 to show none
  editConf: boolean | undefined; // is that conf editable?
  conftextRef: React.RefObject<HTMLTextAreaElement> | undefined; // ref to retreive conf edits
  handler: (e: React.SyntheticEvent) => void | Promise<void> | undefined;
}
function Modinfo(props: ModinfoProps) {
  const {
    modules: ms,
    configs: cs,
    showConf,
    editConf,
    conftextRef,
    handler,
  } = props;

  const modules: string[] = [];
  const configs: SwordConfType[] = [];
  ms.forEach((m, i) => {
    const csi = G.SwordConf[m] || (cs && cs[i]);
    if (csi) {
      modules.push(m);
      configs.push(csi);
    }
  });

  // Currently it is not possible to access the config file text for a
  // module unless it is installed locally (aw shucks).
  const confPath =
    (showConf !== undefined &&
      showConf !== -1 &&
      modules[showConf] in G.Tab &&
      G.Tab[modules[showConf]].confPath) ||
    '';
  const conftext: string[] =
    showConf === -1 || !confPath
      ? []
      : G.inlineFile(confPath, 'utf8', true).split('\n');

  return (
    <Vbox {...addClass('modinfo', props)}>
      {modules?.map((m, i) => (
        <div id={`mod_${m}`} className="modlist" key={`ml${m}`}>
          <div className="head1">
            <span className={`cs-${m}`}>{configs[i].module}</span>{' '}
            <a href="#" id={`top.${m}`} onClick={handler}>
              ↑
            </a>
          </div>
          <div
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: sanitizeHTML(moduleInfoHTML([configs[i]])),
            }}
          />
          <div>
            {showConf !== undefined &&
              (showConf === -1 || modules[showConf] !== m) && (
                <>
                  <Button id={`more.${m}`} onClick={handler}>
                    {i18n.t('more.label')}
                  </Button>
                </>
              )}
            {showConf !== undefined &&
              showConf !== -1 &&
              modules[showConf] === m && (
                <>
                  <Button id={`less.${m}`} onClick={handler}>
                    {i18n.t('less.label')}
                  </Button>
                  {editConf !== undefined && conftextRef !== undefined && (
                    <>
                      <Button id={`edit.${m}`} onClick={handler}>
                        {i18n.t('editMenu.label')}
                      </Button>
                      <Button
                        id={`save.${m}`}
                        disabled={!editConf}
                        onClick={handler}
                      >
                        {i18n.t('save.label')}
                      </Button>
                    </>
                  )}
                </>
              )}
          </div>
          {showConf !== undefined &&
            showConf !== -1 &&
            modules[showConf] === m && (
              <div>
                <Label
                  className="confpath-label"
                  control={`ta.${m}`}
                  value={confPath}
                />
                <textarea
                  id={`ta.${m}`}
                  className={editConf ? 'editable' : 'readonly'}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  wrap="off"
                  readOnly={!editConf}
                  rows={conftext.length}
                  ref={conftextRef}
                >
                  {conftext.join('\n')}
                </textarea>
              </div>
            )}
        </div>
      ))}
    </Vbox>
  );
}
Modinfo.defaultProps = defaultProps;
Modinfo.propTypes = propTypes;

export default Modinfo;
