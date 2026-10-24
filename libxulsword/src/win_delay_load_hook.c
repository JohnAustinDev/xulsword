/*
 * Delay-load hook for the Windows libxulsword.node addon.
 *
 * The addon calls Node-API functions (napi_*), which are part of the Node.js
 * runtime. On Windows that runtime is built into the program that loads the
 * addon: node.exe, electron.exe, or the packaged app's renamed copy of
 * electron.exe (such as MK.exe). There is no separate Node.js DLL.
 *
 * A Windows DLL must name the file that each of its imported functions comes
 * from. (Linux and MacOS can leave such functions to be found in the running
 * program instead.) So init.sh links the addon with an import library that
 * says the napi_* functions come from node.exe. If these were normal imports,
 * Windows would look for a file called node.exe as soon as the addon was
 * loaded, which fails in Electron.
 *
 * Instead, init.sh links with --delayload=node.exe. Then nothing is looked
 * up when the addon is loaded. The first call to a napi_* function goes to
 * __delayLoadHelper2 (from the MinGW-w64 runtime, linked into the addon),
 * which loads the DLL, finds the function, and saves its address so later
 * calls go straight to it. Before it loads the DLL, the helper calls the hook
 * in __pfnDliNotifyHook2, if there is one. The hook below gives the helper
 * the running program instead of a file called node.exe, so the napi_*
 * functions are found in whichever program loaded the addon.
 *
 * node-gyp adds the same hook (src/win_delay_load_hook.cc) to the addons it
 * builds, but its version only compiles with MSVC.
 */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <delayimp.h>
#include <string.h>

/*
 * The helper calls this hook at several points (events) while it finds a
 * function. Only dliNotePreLoadLibrary is used here: it comes just before
 * the helper loads the DLL named by info->szDll. Returning a module handle
 * makes the helper use that module instead of loading the DLL. Returning
 * NULL lets the helper carry on as usual. DLL names are not case sensitive
 * on Windows, hence _stricmp.
 */
static FARPROC WINAPI load_exe_hook(unsigned int event, PDelayLoadInfo info) {
  if (event != dliNotePreLoadLibrary) return NULL;
  if (_stricmp(info->szDll, "node.exe") != 0) return NULL;
  // GetModuleHandle(NULL) is the handle of the running program's .exe file.
  return (FARPROC) GetModuleHandle(NULL);
}

/*
 * The helper finds the hook through this variable. The MinGW-w64 runtime
 * has a default definition set to NULL (no hook), which this one replaces.
 */
PfnDliHook __pfnDliNotifyHook2 = load_exe_hook;
