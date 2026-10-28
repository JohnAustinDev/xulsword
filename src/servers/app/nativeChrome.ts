import path from 'path';
import { execFileSync } from 'child_process';
import { nativeImage, nativeTheme } from 'electron';

import type { NativeImage } from 'electron';
import type S from '../../defaultPrefs.ts';

// The native window chrome follows the skin. nativeTheme.themeSource gives dark
// menus and title bars on Windows (the macOS menu bar is separate from xulsword
// windows and does not follow the skin). On Linux, Electron draws the menu
// bar and popup menus with GTK, which is only dark when GTK's dark theme
// variant is loaded. So at startup GTK_THEME is set (unless the user has set
// it) before GTK is initialized, and removed again by releaseGtkTheme() once
// the main window is ready, so that programs started by the app do not inherit
// it. GTK loads the theme only at startup, so Linux menus follow a skin change
// only after a restart. (Linux title bars are drawn by the window manager,
// which may ignore the dark hint that Electron gives it.)

let gtkThemeWasSet = false;

// True when Linux menus are drawn with GTK's dark theme variant.
let gtkMenusAreDark = false;

// Whether menus are drawn dark. On Windows they follow nativeTheme, which may
// change at any time (see the nativeTheme 'updated' listener in server.ts).
function menusAreDark(): boolean {
  if (process.platform === 'win32') return nativeTheme.shouldUseDarkColors;
  if (process.platform === 'linux') return gtkMenusAreDark;
  return false;
}

export function setNativeChrome(
  skin: typeof S.prefs.global.skin,
  startup = false,
) {
  nativeTheme.themeSource = skin === 'dark' ? 'dark' : 'system';
  if (
    startup &&
    process.platform === 'linux' &&
    skin === 'dark' &&
    !process.env.GTK_THEME
  ) {
    let theme = 'Adwaita';
    try {
      theme =
        execFileSync(
          'gsettings',
          ['get', 'org.gnome.desktop.interface', 'gtk-theme'],
          { encoding: 'utf8', timeout: 2000 },
        )
          .trim()
          .replace(/^'(.*)'$/, '$1') || theme;
    } catch {
      // no gsettings, so use GTK's own Adwaita theme
    }
    process.env.GTK_THEME = /-dark$/i.test(theme) ? theme : `${theme}:dark`;
    gtkThemeWasSet = true;
    gtkMenusAreDark = true;
  }
}

// GTK reads GTK_THEME lazily, so call this only after the main window and its
// menu bar have been created.
export function releaseGtkTheme() {
  if (gtkThemeWasSet) {
    delete process.env.GTK_THEME;
    gtkThemeWasSet = false;
  }
}

const invertedIcons: Record<string, NativeImage> = {};

// A menu item icon. The icons are dark, for light menus, so when menus are
// drawn dark the icon's lightness is inverted (its alpha is kept).
export function menuIcon(...pathSegments: string[]): string | NativeImage {
  const file = path.join(...pathSegments);
  if (!menusAreDark()) return file;
  if (!(file in invertedIcons)) {
    const image = nativeImage.createFromPath(file);
    const { width, height } = image.getSize();
    // The bitmap is BGRA with premultiplied alpha, so a color value c inverts
    // to alpha - c.
    const bitmap = image.toBitmap();
    for (let i = 0; i < bitmap.length; i += 4) {
      const alpha = bitmap[i + 3];
      bitmap[i] = alpha - bitmap[i];
      bitmap[i + 1] = alpha - bitmap[i + 1];
      bitmap[i + 2] = alpha - bitmap[i + 2];
    }
    invertedIcons[file] = nativeImage.createFromBitmap(bitmap, {
      width,
      height,
    });
  }
  return invertedIcons[file];
}
