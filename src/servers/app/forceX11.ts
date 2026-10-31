import { spawn } from 'child_process';

// Since Electron 38, Linux runs natively on Wayland when the desktop session
// is Wayland. Wayland does not let apps read or set window positions, so
// windows can't be opened over a panel or popup (towindow), and persisted
// window positions are ignored. Before Electron 38, Linux always ran on X11
// (XWayland), where this works.
//
// The display backend is chosen before any app JavaScript runs, so
// app.commandLine.appendSwitch('ozone-platform', 'x11') is too late. Instead,
// relaunch once with --ozone-platform=x11 and exit this process before it
// does anything else. Call this first in the main process entry point. Any
// --ozone-platform* argument prevents the relaunch, so --ozone-platform=wayland
// can still be used to run on Wayland.
export default function forceX11() {
  if (
    process.platform === 'linux' &&
    (process.env.XDG_SESSION_TYPE === 'wayland' ||
      process.env.WAYLAND_DISPLAY) &&
    process.env.DISPLAY && // XWayland is available
    !process.env.SNAP && // snap launchers set their own display backend
    !process.argv.some((a) => a.startsWith('--ozone-platform'))
  ) {
    // An AppImage's files are unmounted when its process exits, so relaunch
    // the AppImage file itself rather than the binary inside it.
    const exe = process.env.APPIMAGE || process.execPath;
    spawn(exe, [...process.argv.slice(1), '--ozone-platform=x11'], {
      detached: true,
      stdio: 'inherit',
    }).unref();
    process.exit(0);
  }
}
