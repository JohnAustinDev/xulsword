import React from 'react';
import PropTypes from 'prop-types';
import {
  isRepoLocal,
  repositoryModuleKey,
  sanitizeHTML,
  stringHash,
} from '../../../common.ts';
import C from '../../../constant.ts';
import { G, GI } from '../../G.ts';
import {
  functionalComponentRenderPromise,
  moduleInfoHTML,
} from '../../common.ts';
import { xulPropTypes, type XulProps, htmlAttribs } from './xul.tsx';
import Button from './button.tsx';
import Label from './label.tsx';
import '../../libsword.css'; // modinfo uses .head1
import './modinfo.css';

import type {
  GType,
  ModTypes,
  SwordConfType,
  TabTypes,
} from '../../../type.ts';

// Parent component should have this included in its state and state-type.
export const modinfoParentInitialState = {
  showConf: '' as string,
  editConf: false as boolean,
};

// Parent component should implement this interface.
export type ModinfoParent = {
  modinfoRefs: {
    textarea: React.RefObject<HTMLTextAreaElement>;
    container: React.RefObject<HTMLDivElement>;
  };
  setState: React.Component['setState'];
};

// Parent component should pass this function (bound) to the
// Modinfo buttonHandler prop.
export function modinfoParentHandler(
  this: ModinfoParent,
  e: React.SyntheticEvent,
): void {
  switch (e.type) {
    case 'click': {
      const target = e.currentTarget as HTMLElement;
      const [id, muni] = target.id.split('.');
      switch (id) {
        case 'more': {
          const s: typeof modinfoParentInitialState = {
            showConf: muni,
            editConf: false,
          };
          this.setState(s);
          break;
        }
        case 'less': {
          const s: typeof modinfoParentInitialState = {
            showConf: '',
            editConf: false,
          };
          this.setState(s);
          break;
        }
        case 'edit': {
          const s: Partial<typeof modinfoParentInitialState> = {
            editConf: true,
          };
          this.setState(s);
          break;
        }
        case 'save': {
          if (muni) {
            const { modinfoRefs } = this;
            const { textarea } = modinfoRefs;
            if (textarea?.current?.value) {
              const { dataset } = textarea?.current ?? {};
              const { confPath } = dataset;
              if (confPath) {
                if (Build.isElectronApp)
                  (G as GType).Module.writeConf(
                    confPath,
                    textarea.current.value,
                  );
                const s: Partial<typeof modinfoParentInitialState> = {
                  editConf: false,
                };
                this.setState(s);
              }
            }
          }
          break;
        }
        case 'top': {
          const { modinfoRefs } = this;
          const { container } = modinfoRefs;
          const scrollcont = container.current?.childNodes[0] as HTMLDivElement;
          if (scrollcont) scrollcont.scrollTop = 0;
          break;
        }
        default:
          throw new Error(`Unhandled click event ${id} in modinfo.tsx`);
      }
      break;
    }
    default:
  }
}

// XUL Sword module info and config
const propTypes = {
  ...xulPropTypes,
  configs: PropTypes.arrayOf(PropTypes.object).isRequired,
  showConf: PropTypes.string,
  editConf: PropTypes.bool,
  refs: PropTypes.object.isRequired,
  buttonHandler: PropTypes.func.isRequired,
};

type ModinfoProps = {
  configs: SwordConfType[];
  showConf: string; // unique id of conf to show
  editConf: boolean | undefined; // is showConf editable?
  refs: {
    container: React.RefObject<HTMLDivElement>; // ref to control scrolling
    textarea: React.RefObject<HTMLTextAreaElement>; // ref to retreive conf edits
  };
  buttonHandler: (e: React.SyntheticEvent) => void;
} & XulProps;

type SwordConfExtraType = SwordConfType & {
  confID: string;
  confPath: string | null;
  label: string;
  style: string;
};

function Modinfo({ showConf = '', ...props }: ModinfoProps) {
  const { configs: configsx, editConf, refs, buttonHandler } = props;
  const { container, textarea } = refs;

  const { renderPromise, loadingRef } = functionalComponentRenderPromise();

  // Is not possible to edit or (currently) view a config file unless it
  // is installed locally.
  const configs: SwordConfExtraType[] = configsx
    .map((c) => {
      const m = c.module;
      const data = {
        confPath: null as null | string,
        label: m in G.Tab ? G.Tab[m].label : m,
        style: m in G.Tab ? G.Tab[m].labelClass : 'cs-LTR_DEFAULT',
        confID: stringHash(repositoryModuleKey(c)),
      };
      if (c && isRepoLocal(c.sourceRepository)) {
        data.confPath = [c.sourceRepository.path, 'mods.d', c.filename].join(
          C.FSSEP,
        );
      }
      return {
        ...c,
        ...data,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  const showConfET: SwordConfExtraType | null =
    (showConf && configs.find((c) => c.confID === showConf)) || null;

  const conftext: string[] =
    (Build.isElectronApp &&
      showConfET?.confPath &&
      (G as GType).inlineFile(showConfET.confPath, 'utf8', true).split('\n')) ||
    [];

  const showLinkList = configs.length > 4;

  return (
    <div {...htmlAttribs('modinfo', props)} ref={container}>
      <div ref={loadingRef as React.RefObject<HTMLDivElement>}>
        {showLinkList &&
          [
            'Biblical Texts',
            'Commentaries',
            'Lexicons / Dictionaries',
            'Generic Books',
            'XSM_audio',
          ].map((g) => (
            <div key={`lt${g}`} className="linklist">
              {configs.some((c) => c.moduleType === g || c.xsmType === g) && (
                <>
                  <div className="head1">
                    {GI.i18n.t(
                      '',
                      renderPromise,
                      ((g in C.SupportedTabTypes &&
                        C.SupportedTabTypes[g as ModTypes]) ||
                        'Genbks') as TabTypes,
                    )}
                  </div>
                  <div className="listbox">
                    <ul>
                      {configs.map((c) =>
                        c.moduleType === g || c.xsmType === g ? (
                          <li key={`lm${c.confID}`}>
                            <a
                              href={`#${['module', c.confID].join('.')}`}
                              className={c.style}
                            >
                              {c.label}
                            </a>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
          ))}
        {configs?.map((c) => (
          <div
            key={`ml${c.confID}`}
            id={['module', c.confID].join('.')}
            className={`modlist x-${c.module}`}
          >
            <div className="head1">
              <span className={`cs-${c.module}`}>{c.module}</span>
              {showLinkList && (
                <a
                  href="#"
                  id={['top', c.confID].join('.')}
                  className="top-link"
                  onClick={buttonHandler}
                >
                  ↑
                </a>
              )}
            </div>
            <div
              dangerouslySetInnerHTML={{
                // eslint-disable-next-line @typescript-eslint/naming-convention
                __html: sanitizeHTML(
                  (configs && moduleInfoHTML([c], renderPromise)) || '',
                ),
              }}
            />
            <div>
              {c.confPath && !(showConfET === c) && (
                <>
                  <Button
                    id={['more', c.confID].join('.')}
                    onClick={buttonHandler}
                  >
                    {GI.i18n.t('', renderPromise, 'more.label')}
                  </Button>
                </>
              )}
              {showConfET && showConfET === c && (
                <>
                  <Button
                    id={['less', c.confID].join('.')}
                    onClick={buttonHandler}
                  >
                    {GI.i18n.t('', renderPromise, 'less.label')}
                  </Button>
                  {editConf !== undefined && textarea !== undefined && (
                    <>
                      <Button
                        id={['edit', c.confID].join('.')}
                        onClick={buttonHandler}
                      >
                        {GI.i18n.t('', renderPromise, 'menu.edit')}
                      </Button>
                      <Button
                        id={['save', c.confID].join('.')}
                        disabled={!editConf}
                        onClick={buttonHandler}
                      >
                        {GI.i18n.t('', renderPromise, 'save.label')}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
            {showConfET && showConfET === c && (
              <div>
                <Label
                  className="confpath-label"
                  control={`ta.${c.confID}`}
                  value={c.confPath || ''}
                />
                <textarea
                  id={['ta', c.confID].join('.')}
                  defaultValue={conftext.join('\n')}
                  className={editConf ? 'editable' : 'readonly'}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  wrap="off"
                  readOnly={!editConf}
                  rows={conftext.length}
                  ref={textarea}
                  data-conf-path={c.confPath}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
Modinfo.propTypes = propTypes;

export default Modinfo;
