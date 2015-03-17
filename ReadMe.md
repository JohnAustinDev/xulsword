# Compilation instructions for Linux

**Native**: Run build.sh

**Cross-compiled**: On MS-Windows, Linux, or MAC install 
[VirtualBox](https://www.virtualbox.org/wiki/Downloads) and 
[Vagrant](https://www.vagrantup.com/downloads.html). 
Change into the xulsword directory and run:

`$ vagrant up precise32`

or

`$ vagrant up precise64`

Builds will appear in the `/build-out` directory.

-----

# Compilation instructions for MS-Windows

## Build requirements
The following programs need to be in the command path:
  * [7-zip](http://www.7-zip.org/download.html) (command line version)
  * [Perl](http://www.activestate.com/activeperl/downloads/)
  * [MSVC8 C++ Compiler](http://www.softpedia.com/get/Programming/Other-Programming-Files/Microsoft-Visual-C-Toolkit.shtml) 
  (the Express Edition works great)
  * MS-Windows SDK. Old SDK versions like 
  [Windows Server 2003 SP1 Platform SDK](http://www.microsoft.com/en-us/download/details.aspx?id=6510) 
  work just fine. For quickest install, use the web-install and choose 
  what parts you want to download. All that is required to build 
  xulsword is the `Include` and `Lib` subdirectories.

## Compilation Steps
  * Get the xulsword code from GitHub.
  * Get the [XulRunner runtime](https://developer.mozilla.org/en/XULRunner).
  * Get [Clucene](http://sourceforge.net/projects/clucene/files/clucene-core-stable/0.9.21b/).
  * Get [SWORD](http://crosswire.org/svn/sword) source code.
  * Check the paths for these in the `/build/build_settings.txt` file.
  * Run `/build/build.pl`
  * Start the program by running `/build/run-xulsword-dev.pl` (which is 
  created when you build xulsword). The development version of the 
  program has a hidden button which displays useful debugging features 
  when clicked. This invisible button is located JUST under the top 
  menu bar at the FAR right of the xulsword window. Debugging buttons 
  will appear in that same area when the invisible button is clicked.

-----

# Build Controls
Build controls are in `/build/build_settings.txt`. Build the Development 
version, Portable version, Firefox extension, and Setup installer 
version by setting their values to "true". Install modules with your 
build by adding your repository path(s) and by adding SWORD module names 
to the `IncludeModules` line. Various user preferences can be set in 
`/build/build_prefs.txt` as well. To help protect texts from tampering, 
a security module is provided. To enable the security module, set 
`UseSecurityModule` to true and set the path of `KeyGenPath` to your key 
generator. 

----

# Locale Creation
##What must be translated?
The phrases used by xulsword's user interface are found in 
`/localeDev/en-US/UI-en-US.txt`. Optional bits are in 
`/localeDev/en-US/UI-en-us_2.txt`.

##Add a new locale to xulsword
Locales are automatically packaged when xulsword is built. Create 
`/extras/localeDev/<locale-code>` and put the locale files there. Edit 
`build/build_settings.txt` so IncludeLocales lists '<locale-code>' and 
so XulswordExtras is `../extras`. Rebuild and start xulsword.

A new user interface choice will appear in the Options -> Language menu 
of xulsword. Also, a locale extension module will be created under 
build-out which can be used to install the new locale into other 
compatible versions of xulsword.

##Optional user interface possibilities
* Many optional locale configuration settings are found in 
`/localeDev/en-US/UI-en-us_2.txt` including the order of Bible books, 
short-cut keys for menu commands, CSS font-family, font-size, etc., and 
localization of numerals and search symbols, among other things.
* A locale-files subdirectory, containing a localized splash image 
called splash-overlay.png may be included.
* A skin-files subdirectory, containing files which will overwrite the 
default skin, may also be included. This allows you to run xulsword with 
a customized skin for your locale.
* Some scripts (like Arabic), which cannot simply be printed vertically, 
will need images for vertical texts. These images should be placed under 
the locale-files subdirectory.

-----

#Audio Modules
Translations may have associated audio readings of the text. These audio 
files can be packaged in zip files for easy installation into xulsword. 
After installation, audio icons will appear above the associated texts 
to play their audio recording. Audio files may be exported from xulsword 
with File -> Export Audio.

##Packaging an audio module
An audio module is a zip archive with a directory structure containing 
ogg audio files like:

`/audio/<audio-code>/<osis-bible-book-name>/001.ogg`

The audio-code can be chosen three different ways:
* Usually, it is simply the name of a SWORD Bible module (and module 
names are case sensitive, so make sure the directory name exactly 
matches the module name).
* Sometimes, when audio files need to target more than one Bible module 
(for instance two modules of the same translation using different 
scripts), then any unique audio-code may be used, but in this case all 
SWORD modules associated with the audio files need to have 
`AudioCode=<audio-code>` in their .conf files.
* It is also possible to use the ISO-639 language code as the 
audio-code, which will then associate the audio files with all SWORD 
modules shareing that language code.

##Audio file coverage
An ogg file should cover an entire Bible chapter. It's perfectly ok if 
only certain chapters have audio files. It's possible to have multiple 
chapters recorded in a single audio file, but this is not recommended 
because users will only be notified of the existence of the first 
chapter's recording (the audio icon will only appear in the first 
chapter which is covered by the audio file).

##Audio file tagging
Audio files can be exported from xulsword, so it's also a good idea to 
tag the audio files. But xulsword itself does not require or utilise 
audio file tags.

-----

#PECL extension: phpsword
The PHP extension brings libxulsword's API into php.

##Compilation and use
Compile the extension by going to the phpsword directory and running:

    $ phpize
    $ ./configure
    $ make
    $ sudo make install

This will install the extension to your php shared extensions directory.

Next, to enable the extension you can add the following to your php.ini:

    [PHP]
    extension=phpsword.so

And then restart PHP:

`$ sudo apache2ctl restart`

Finally, to access phpsword from PHP, do something like this:

    if (!extension_loaded("phpsword")) {
        header('Location: ' . $redirect_URL); 
        exit;
    }

    $Sword = new phpsword($repository_path);

    $My_modlist = $Sword->getModuleList();

