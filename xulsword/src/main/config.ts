/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable new-cap */
import { app } from 'electron';
import path from 'path';
import i18next from 'i18next';
import Dirs from './modules/dirs';
import Prefs from './modules/prefs';
import LibSword from './modules/libsword';
import { ConfigType, GType } from '../type';
import C from '../constant';
import { deepClone } from '../common';
import { jsdump } from './mutil';
import nsILocalFile from './components/nsILocalFile';
import getFontFamily from './fontfamily';

// Config's properties are all the properties which Config type objects will have.
// The Config property objects map the property for its various uses:
//   - modConf = Name of a possible entry in a module's .conf file
//   - localeConf = Name of a possible property in a locale's config.properties file
//   - CSS = Name of a possible corresponding CSS property (should also be specified in cs-Program style)
/* eslint-disable prettier/prettier */
const Config = {
  direction:        { modConf:"Direction", localeConf:"Direction", CSS:"direction" },
  fontFamily:       { modConf:"Font", localeConf:"Font", CSS:"font-family" },
  fontSizeAdjust:   { modConf:"FontSizeAdjust", localeConf:"FontSizeAdjust", CSS:"font-size-adjust" },
  lineHeight:       { modConf:"LineHeight", localeConf:"LineHeight", CSS:"line-height" },
  fontSize:         { modConf:"FontSize", localeConf:"FontSize", CSS:"font-size" },
  color:            { modConf:"FontColor", localeConf:"FontColor", CSS:"color" },
  background:       { modConf:"FontBackground", localeConf:"FontBackground", CSS:"background" },
  AssociatedModules:{ modConf:null, localeConf:"DefaultModule", CSS:null },
  AssociatedLocale: { modConf:"Lang", localeConf:null, CSS:null },
  StyleRule:        { modConf:null, localeConf:null, CSS:null },
  TreeStyleRule:    { modConf:null, localeConf:null, CSS:null },
  PreferredCSSXHTML:{ modConf:"PreferredCSSXHTML", localeConf:null, CSS:null }
};

const LocaleConfigDefaultCSS: ConfigType = {
  fontFamily: "'Arial'",
  direction: 'ltr',
  fontSizeAdjust: 'none',
  lineHeight: 'unspecified',
  fontSize: 'unspecified',
  color: 'unspecified',
  background: 'unspecified',
};

function getModuleConfigDefaultCSS(): ConfigType {
  return {
    fontFamily: Prefs.getPrefOrCreate('user.fontFamily.default', 'string', "'Arial'"),
    direction: Prefs.getPrefOrCreate('user.direction.default', 'string', 'ltr'),
    fontSizeAdjust: Prefs.getPrefOrCreate('user.fontSizeAdjust.default', 'string', 'none'),
    lineHeight: Prefs.getPrefOrCreate('user.lineHeight.default', 'string', '1.6em'),
    fontSize: Prefs.getPrefOrCreate('user.fontSize.default', 'string', '1em'),
    color: Prefs.getPrefOrCreate('user.color.default', 'string', '#202020'),
    background: Prefs.getPrefOrCreate('user.background.default', 'string', 'unspecified'),
  };
}
/* eslint-enable prettier/prettier */

function createStyleRule(selector: string, config: ConfigType) {
  let rule = `${selector} {`;
  const entries = Object.entries(Config);
  entries.forEach((entry) => {
    const [key, val]: [string, { [i: string]: string | null }] = entry;
    if (!val.CSS || config[key] === 'unspecified') return;
    rule += `${val.CSS}: ${config[key]}; `;
  });
  rule += '}';

  return rule;
}

function localeConfig(locale: string) {
  const lconfig = {} as ConfigType;
  const toptions = { lng: locale, ns: 'common/config' };

  // All config properties should have a valid value, and it must not be null.
  // Read values from locale's config.properties file
  const entries = Object.entries(Config);
  entries.forEach((entry) => {
    const [key, val]: [string, { [i: string]: string | null }] = entry;
    if (typeof val.localeConf !== 'string') return;

    const k = key as keyof typeof LocaleConfigDefaultCSS;
    const def =
      typeof LocaleConfigDefaultCSS[k] === 'string'
        ? LocaleConfigDefaultCSS[k]
        : null;

    let r = i18next.t(val.localeConf, toptions);
    if (/^\s*$/.test(r)) r = C.NOTFOUND;

    if (r === C.NOTFOUND && val.CSS && def) {
      r = def;
    }

    lconfig[key] = r;
  });

  lconfig.AssociatedLocale = locale;

  // Insure there are single quotes around font names
  lconfig.fontFamily = lconfig.fontFamily.replace(/"/g, "'");
  if (lconfig.fontFamily !== C.NOTFOUND && !/'.*'/.test(lconfig.fontFamily))
    lconfig.fontFamily = `'${lconfig.fontFamily}'`;

  // Save the CSS style rules for this locale, which may be appended to CSS stylesheets
  lconfig.StyleRule = createStyleRule(`.cs-${locale}`, lconfig);
  lconfig.TreeStyleRule = createStyleRule(
    `treechildren::-moz-tree-cell-text(${locale})`,
    lconfig
  );

  return lconfig;
}

export function getLocaleConfigs() {
  const ret = {} as { [i: string]: ConfigType };
  Prefs.getComplexValue('global.locales').forEach((l: any) => {
    const [lang] = l;
    ret[lang] = localeConfig(lang);
  });

  return ret;
}

export function getProgramConfig() {
  const ret = deepClone(localeConfig(i18next.language));
  ret.StyleRule = createStyleRule('.cs-Program', ret);
  ret.TreeStyleRule = createStyleRule(
    'treechildren::-moz-tree-cell-text(Program)',
    ret
  );

  return ret;
}

function fontURL(mod: string) {
  // if fontFamily specifies a font URL, rather than a fontFamily, then create a
  // @font-face CSS entry and use it for this module.
  const url = LibSword.getModuleInformation(mod, 'Font').match(
    /(\w+:\/\/[^"')]+)\s*$/
  );
  return url
    ? { name: `_${url[1].replace(/[^\w\d]/g, '_')}`, url: url[1] }
    : null;
}

// Read fonts which are in xulsword's xsFonts directory
export function getFontFaceConfigs() {
  if (!LibSword.libSwordReady()) {
    throw Error(`getFontFaceConfigs must not be run until LibSword is ready!`);
  }

  const ret = {} as ConfigType;
  const fontdir = Dirs.xsFonts.directoryEntries;
  const fonts: string[] = [];
  fontdir?.forEach((dir) => {
    const font = new nsILocalFile(path.join(Dirs.path.xsFonts, dir));
    if (!font.isDirectory()) fonts.push(font.path);
  });

  for (let i = 0; i < fonts.length; i += 1) {
    const fontFamily = getFontFamily(fonts[i]);
    if (fontFamily) {
      ret[fontFamily] = `file://${fonts[i]}`;
      if (process.platform === 'win32')
        ret[fontFamily] = ret[fontFamily].replace(/\\/g, '/');
    }
  }

  // if fontFamily specifies a font URL, rather than a fontFamily, then create a
  // @font-face CSS entry and use it for this module.
  const mods = LibSword.getModuleList();
  if (mods && mods !== 'No Modules') {
    const modulelist = mods.split('<nx>');
    const modules = modulelist.map((m: string) => m.split(';')[0]);
    modules.forEach((m) => {
      const url = fontURL(m);
      if (url) ret[url.name] = url.url;
    });
  }

  return ret;
}

// Return a locale (if any) to associate with a module:
//    Return a Locale with exact same language code as module
//    Return a Locale having same base language code as module, prefering current Locale over any others
//    Return a Locale which lists the module as an associated module
//    Return null if no match
function getLocaleOfModule(module: string) {
  let myLocale: string | null = null;

  const progLocale = i18next.language;
  let ml: any = LibSword.getModuleInformation(module, 'Lang').toLowerCase();
  if (ml === C.NOTFOUND) ml = undefined;

  let stop = false;
  Prefs.getComplexValue('global.locales').forEach((l: any) => {
    const [locale] = l;
    if (stop) return;
    const lcs = locale.toLowerCase();

    if (ml && ml === lcs) {
      myLocale = locale;
      stop = true;
      return;
    }
    if (ml && lcs && ml.replace(/-.*$/, '') === lcs.replace(/-.*$/, '')) {
      myLocale = locale;
      if (myLocale === progLocale) stop = true;
    }
  });

  if (myLocale) return myLocale;

  const regex = new RegExp(`(^|s|,)+${module}(,|s|$)+`);
  Prefs.getComplexValue('global.locales').forEach((l: any) => {
    const [locale] = l;
    const toptions = {
      lng: locale,
      ns: 'common/config',
    };
    if (i18next.t('DefaultModule', toptions).match(regex)) myLocale = locale;
  });

  return myLocale;
}

function getModuleConfig(mod: string) {
  if (!LibSword.libSwordReady() && mod !== 'LTR_DEFAULT') {
    throw Error(
      `getModuleConfig(modname) must not be called until LibSword is ready!`
    );
  }
  const moduleConfig: ConfigType = {};

  const moduleConfigDefaultCSS = getModuleConfigDefaultCSS();

  // All config members should have a valid value, and it must not be null.
  // Read values from module's .conf file
  const entries = Object.entries(Config);
  entries.forEach((entry) => {
    const [p, v] = entry;
    let val = '';
    if (typeof v.modConf !== 'string') return;
    if (mod !== 'LTR_DEFAULT') {
      val = LibSword.getModuleInformation(mod, v.modConf);
    }

    if (/^\s*$/.test(val)) val = C.NOTFOUND;

    if (
      val === C.NOTFOUND &&
      v.CSS &&
      typeof moduleConfigDefaultCSS[p] === 'string'
    ) {
      val = moduleConfigDefaultCSS[p];
    }

    // allow user to overwrite module defaults
    try {
      const userVal = Prefs.getCharPref(`user.${p}.${mod}`);
      if (userVal) val = userVal;
    } catch (er) {
      /* ignore */
    }

    moduleConfig[p] = val;
  });

  // Assign associated locales
  if (mod !== 'LTR_DEFAULT') {
    const lom = getLocaleOfModule(mod);
    moduleConfig.AssociatedLocale = lom || C.NOTFOUND;
  } else {
    moduleConfig.AssociatedLocale = C.DEFAULTLOCALE;
    moduleConfig.AssociatedModules = C.NOTFOUND;
  }

  // Normalize direction value
  moduleConfig.direction =
    moduleConfig.direction.search(/RtoL/i) !== -1 ? 'rtl' : 'ltr';

  // if fontFamily specifies a font URL, rather than a fontFamily, then create a
  // @font-face CSS entry and use it for this module.
  const url = fontURL(mod);
  if (url) moduleConfig.fontFamily = url.name;

  // Insure there are single quotes around font names
  moduleConfig.fontFamily = moduleConfig.fontFamily.replace(/"/g, "'");
  if (
    moduleConfig.fontFamily !== C.NOTFOUND &&
    !/'.*'/.test(moduleConfig.fontFamily)
  )
    moduleConfig.fontFamily = `'${moduleConfig.fontFamily}'`;

  // Save the CSS style rules for this module, which can be appended to CSS stylesheets
  moduleConfig.StyleRule = createStyleRule(`.cs-${mod}`, moduleConfig);
  // "m" is prepended to mod because some module names begin with a digit,
  // which would otherwise result in an invalid selector
  moduleConfig.TreeStyleRule = createStyleRule(
    `treechildren::-moz-tree-cell-text(m${mod})`,
    moduleConfig
  );

  return moduleConfig;
}

export function versionCompare(v1: string | number, v2: string | number) {
  const p1 = String(v1).split('.');
  const p2 = String(v2).split('.');
  do {
    let n1: any = p1.shift();
    let n2: any = p2.shift();
    if (!n1) n1 = 0;
    if (!n2) n2 = 0;
    if (Number(n1) && Number(n2)) {
      if (n1 < n2) return -1;
      if (n1 > n2) return 1;
    } else if (n1 < n2) {
      return -1;
    } else if (n1 > n2) {
      return 1;
    }
  } while (p1.length || p2.length);

  return 0;
}

export function getModuleConfigDefault() {
  return getModuleConfig('LTR_DEFAULT');
}

export function getModuleConfigs() {
  if (!LibSword.libSwordReady()) {
    throw Error(`getModuleConfigs must not be called until LibSword is ready!`);
  }

  const ret: GType['ModuleConfigs'] = {};

  // Gets list of available modules
  const mods = LibSword.getModuleList();
  if (!mods || mods === 'No Modules') return false;
  const modules = mods.split('<nx>');

  for (let m = 0; m < modules.length; m += 1) {
    const [mod, type] = modules[m].split(';');

    // Weed out unsupported module types
    if (Object.values(C.SupportedModuleTypes).includes(type)) {
      // Weed out incompatible module versions. The module installer shouldn't
      // allow bad mods, but this is just in case.
      let xsversion = LibSword.getModuleInformation(mod, C.VERSIONPAR);
      xsversion = xsversion !== C.NOTFOUND ? xsversion : C.MINVERSION;
      let modminxsvers;
      try {
        modminxsvers = Prefs.getCharPref('MinXSMversion');
      } catch (er) {
        modminxsvers = C.MINVERSION;
      }
      if (versionCompare(xsversion, modminxsvers) < 0) {
        jsdump(
          `ERROR: Dropping module "${mod}". xsversion:${xsversion} < modminxsvers:${modminxsvers}`
        );
      } else {
        let xsengvers = LibSword.getModuleInformation(mod, 'MinimumVersion');
        xsengvers = xsengvers !== C.NOTFOUND ? xsengvers : '0';
        let enginevers;
        try {
          enginevers = Prefs.getCharPref('EngineVersion');
        } catch (er) {
          enginevers = C.NOTFOUND;
        }
        if (
          enginevers !== C.NOTFOUND &&
          versionCompare(enginevers, xsengvers) < 0
        ) {
          jsdump(
            `ERROR: Dropping module "${mod}". enginevers:${enginevers} < xsengvers:${xsengvers}`
          );
        } else {
          ret[mod] = getModuleConfig(mod);
        }
      }
    } else {
      jsdump(`ERROR: Dropping module "${mod}". Unsupported type "${type}".`);
    }
  }

  return ret;
}

export function getModuleFeature() {
  const r = {
    dailyDevotion: [],
    greek: ['KJV'],
    greekDef: [],
    greekParse: [],
    hebrew: ['KJV'],
    hebrewDef: [],
  };
  /*
  const modlist: any = LibSword.getModuleList();
  const re = '(^|<nx>)([^;]+);([^<]+)(<nx>|$)';
  const reg = new RegExp(re, 'g');
  const re1 = new RegExp(re);
  modlist.match(reg).forEach((match: string) => {
    const m = match.match(re1);
    if (m === null) return;
    const [, name, longType] = m;
    const mlang = LibSword.getModuleInformation(name, 'Lang');
    const mlangs = mlang.substr(0, mlang.indexOf('-'));
    if (longType === C.BIBLE && /^grc$/i.test(mlang)) r.greek.push(name);
    if (
      longType === C.BIBLE &&
      /^heb?$/i.test(mlang) &&
      !/HebModern/i.test(name)
    )
      r.hebrew.push(name);
    // up to line 156 of xulswordInit.js
  });
*/
  return r;
}
