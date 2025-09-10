import { normalizeFontFamily } from '../common.ts';
import C from '../constant.ts';
import { G, GI } from './G.ts';
import RenderPromise from './renderPromise.ts';
import log from './log.ts';

import type { ConfigType } from '../type.ts';
import type S from '../defaultPrefs.ts';

export type StyleType = {
  [i in 'locale' | 'module']: {
    [key in string | 'default']: Partial<ConfigType>;
  };
};

// This default style fills missing config CSS entries.
const defaultStyle: Partial<StyleType> = {
  module: {
    default: {
      lineHeight: '1.4', // must be the same value as chooseFont slider's 50% value
    },
  },
};

// Return a config object corresponding to a styleType object's type and key.
function getConfig(
  styleType?: StyleType,
  type?: keyof StyleType,
  key?: string,
): Partial<ConfigType> | null {
  let config: Partial<ConfigType> | null = null;
  if (styleType && type && key) {
    const type0 = styleType[type] || null;
    if (type0 && key in type0) {
      config = type0[key];
    }
    const typeDef = defaultStyle[type];
    const configDef = typeDef?.[key];
    if (configDef) {
      config = {
        ...configDef,
        ...config,
      };
    }
  }
  return config;
}

function createStyleRule(
  selector: string,
  config: Partial<ConfigType>,
  important?: boolean,
): string {
  let rule = `${selector} {`;
  Object.entries(C.ConfigTemplate).forEach((entry) => {
    const prop = entry[0] as keyof typeof C.ConfigTemplate;
    const [, keyobj] = entry;
    if (keyobj.CSS && config[prop]) {
      rule += `${keyobj.CSS}: ${config[prop]}${
        important ? ' !important' : ''
      }; `;
    }
  });
  rule += '}';
  return rule;
}

function insertRule(
  sheet: CSSStyleSheet,
  prefix: string,
  instance: string,
  config?: Partial<ConfigType> | null,
  important?: boolean,
) {
  if (config) {
    const r = createStyleRule(`.${prefix}-${instance}`, config, important);
    if (r) sheet.insertRule(r, sheet.cssRules.length);
  }
}

function insertModuleCSS(
  sheet: CSSStyleSheet,
  prefix: string,
  module: string,
  path: string,
  renderPromise?: RenderPromise,
) {
  const css = GI.inlineFile('', renderPromise, path, 'utf8').substring(
    'data:text/css;utf8,'.length,
  );

  if (css) {
    const m = css
      .replace(/[\n\r]+/g, ' ')
      .replace(/\/\*.*?\*\//g, '')
      .match(/[^{]+\{[^}]*\}/g);
    if (m) {
      m.forEach((rule) => {
        const selrul = rule.split(/(?={)/);
        if (selrul) {
          const [sel, rul] = selrul;
          const newsel = sel
            .split(',')
            .map((s) => {
              return s
                ? `.${prefix}-${module} ${s.trim()}, ${s.trim()}.${prefix}-${module}`
                : '';
            })
            .join(', ');
          if (rul) {
            try {
              sheet.insertRule(`${newsel} ${rul.trim()}`);
              log.debug(`Added CSS rule: ${newsel} ${rul.trim()}`);
            } catch (er) {
              log.warn(er);
            }
          }
        }
      });
    }
  }
}

// Dynamic Style Sheet
// A dynamic style sheet is added to every window, which provides the following
// CSS classes potentially having any/all properties found in ConfigType. The
// stylesheet contains these CSS classes in this order:
//   .cs-<locale> { a class for each installed locale }
//   .cs-<module> { a class for each installed module }
//   .cs-locale { the current program locale class }
//   .cs-LTR_DEFAULT { the default LTR class which can be used for labels etc. }
// When class rules are created, user preferences, if set, are also added in
// the following order:
//   1) User preference defaults for each rule type (module, locale)
//   2) Config values
//   3) User preference values for each instance (of module or locale)
export default class DynamicStyleSheet {
  sheet: CSSStyleSheet | null;

  style: StyleType;

  constructor(doc: Document) {
    const style = doc.createElement('style');
    doc.head.appendChild(style);
    this.sheet = style.sheet;
    const module = { default: G.ModuleConfigDefault } as Record<
      string,
      ConfigType
    >;
    Object.entries(G.Config).forEach((entry) => {
      const [mod, config] = entry;
      module[mod] = config;
    });
    this.style = {
      locale: G.LocaleConfigs,
      module,
    };
  }

  update(styleConfigs?: StyleType) {
    const { sheet } = this;

    const renderPromise = new RenderPromise(() => {
      this.update(styleConfigs);
    });

    // Create CSS classes and rules according to user pref style.
    const prefStyleConfigs = G.Prefs.getComplexValue(
      'style',
      'style',
    ) as typeof S.style.style;
    const style = styleConfigs || prefStyleConfigs;
    const classPrefixes = ['cs'];
    if (sheet) {
      while (sheet.cssRules.length) {
        sheet.deleteRule(0);
      }
      classPrefixes.forEach((prefix) => {
        Object.entries(this.style).forEach((entry) => {
          const type = entry[0] as keyof StyleType;
          const [, configobj] = entry;
          Object.entries(configobj).forEach((entry2) => {
            const [instance, config] = entry2;
            if (instance !== 'default') {
              // Default for this type (module or locale default)
              insertRule(
                sheet,
                prefix,
                instance,
                getConfig(style, type, 'default'),
              );
              // Config for this type and instance (particular module or locale config)
              insertRule(sheet, prefix, instance, config);
              // This module's PreferredCSSXHTML if provided.
              if (type === 'module' && config.PreferredCSSXHTML) {
                insertModuleCSS(
                  sheet,
                  prefix,
                  instance,
                  config.PreferredCSSXHTML,
                  renderPromise,
                );
              }
              // User Pref for this type and instance
              insertRule(
                sheet,
                prefix,
                instance,
                getConfig(style, type, instance),
                true,
              );
            }
          });
        });
      });

      // Create LTR_DEFAULT class used for module labels.
      insertRule(sheet, 'cs', 'LTR_DEFAULT', G.ModuleConfigDefault);

      // Create font-face rules for xulsword's fonts.
      G.ModuleFonts.forEach((font) => {
        const { fontFamily, path, url } = font;
        let url2 = url;
        if (path) {
          url2 = Build.isWebApp
            ? path
            : GI.inlineFile('', renderPromise, path, 'base64');
        }
        if (url2) {
          const rule = `@font-face {font-family:${normalizeFontFamily(
            fontFamily,
          )}; src:url("${url2}");}`;
          sheet.insertRule(rule, sheet.cssRules.length);
        }
      });

      // Create userFontBase rule according to the global.font user pref.
      const x = G.Prefs.getIntPref(
        'global.fontSize',
      ) as typeof S.prefs.global.fontSize;
      const px = C.UI.Atext.fontSize + C.UI.Atext.fontSizeOptionDelta * (x - 2);
      sheet.insertRule(
        `.userFontBase {font-size:${px}px;}`,
        sheet.cssRules.length,
      );

      log.silly('Stylesheet: ', sheet);
    }
    renderPromise.dispatch();
  }
}
