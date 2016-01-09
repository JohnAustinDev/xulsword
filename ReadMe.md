#A Bible reading and study tool

xulsword is a Bible reading and study tool intended to be easy to use, 
yet very powerful at the same time. It utilizes popular Open Source 
technologies such as The SWORD Project and Firefox and will always be a 
free program. It is designed for full internationalization, including 
right-to-left languages. Potential users include those who are not 
experienced at using a computer, those who might be new to the Bible, 
and those who may not have (or may not want to use) an internet 
connection.

##Distinctives include:

* Direct text download. Allows easy download of hundreds of texts in 
hundreds of languages with the "Add New Module" interface (located under 
the File menu, or else just press F2).
* Single file internationalization. Simple drag-and-drop of an XSM 
(XulSword Module) file automatically adapts the program to a new 
language by installing a user interface translation, new Bible(s), 
glossaries, bookmarks, fonts, audio files, and more. This file can be 
downloaded from the internet, passed from person to person, distributed 
on DVD/CDROM, or even emailed. RTL languages are fully supported (the 
entire UI becomes RTL).
* Very readable texts. Texts can be nicely formatted to appear on screen 
the way they look in printed form. Text flows from column to column (up 
to three columns). Font, font size, line spacing etc are adjustable for 
each text.
* Easy Bible browsing. Go to any heading in the entire Bible with a 
single click using the graphical Bible navigator. This also gives a 
visual representation of the Bible.
* Print capability. A powerful print feature allows Bible texts and 
related information to be easily printed, and includes print preview.
* Integrated audio. Allows you to listen to the Bible and read along. 
Export audio for other uses, such as mp3 players.
* Text Links. Bible texts and footnotes can include quick links to 
associated dictionaries, which may include pictures, maps and tables.
* Recursive popup windows. Dictionary links, cross references, footnotes 
and more appear in multilevel recursive popup windows that allow instant 
access to a variety of information without necessitating a complex user 
interface layout.
* Powerful bookmark and personal annotation features. Annotate texts 
with personal notes, create and organize bookmarks, notes and verse 
lists. Make quality printouts of your notes and verse lists, or export 
them to share with other xulsword users.
* Secure texts. Texts can be encrypted and secured to prevent others 
from tampering with them. There are no encryption keys to enter or lose 
(or find), and users never even know that a text is encrypted.
* The marriage of Firefox with SWORD provides the best of both worlds 
by combining the power and speed of C++ in the back-end SWORD engine 
with the quick and easy programming of a Javascript front-end and CSS3 UI. 

##Plus many other features provided by the SWORD engine, such as:

* Compatible with a wide variety of Bibles, commentaries, glossaries, 
books, and devotionals which are already freely available in the SWORD standard.
* Powerful search capability.
* Parallel and interlinear version display.
* Much more...

-----

# Compilation instructions for Linux

**Native**: Run build.sh

**Cross-compiled**: On MS-Windows, Linux, or MAC install 
[VirtualBox](https://www.virtualbox.org/wiki/Downloads) and 
[Vagrant](https://www.vagrantup.com/downloads.html) and run: 

`$ vagrant up`

Builds will appear in the `/build-out` directory.

-----

# Compilation instructions for MS-Windows

## Build requirements
The following programs need to be in the command path:
  * [Git](http://git-scm.com/download/win)
  * [7-zip](http://www.7-zip.org/download.html) (command line version)
  * [Perl](http://www.activestate.com/activeperl/downloads/)
  * [MSVC8 C++ Express Compiler](http://go.microsoft.com/fwlink/?linkid=57034) and 
  [MSVC8 C++ Express SP1](https://www.microsoft.com/en-us/download/details.aspx?id=804) 
  (VS80sp1-KB926748-X86-INTL.exe) 
  * MS-Windows SDK. Old SDK versions like  
  [Windows Server 2003 SP1 Platform SDK](http://www.microsoft.com/en-us/download/details.aspx?id=6510) 
  work just fine. Full install is unnecessary, but the Build Environment 
  and Tools categories of the Microsoft Windows Core SDK, are both 
  required. Also the Bin directory must be in your PATH. 

## Compilation Steps
  * Get the xulsword code from GitHub.
  * Get the [XulRunner runtime](https://developer.mozilla.org/en/XULRunner).
  * Get [Clucene](http://sourceforge.net/projects/clucene/files/clucene-core-stable/0.9.21b/).
  * Get [SWORD](http://crosswire.org/svn/sword) source code.
  * Check or add paths in `xulsword/build/build_settings.txt` for 
  `XULRunner`, `CluceneSource`, `SwordSource` and `MicrosoftSDK`.
  * Run `xulsword/build/build.pl`
  * Start the program by running `xulsword/build/run-xulsword-dev.pl` (which is 
  created when you build xulsword). The development version of the 
  program has a hidden button which displays useful debugging features 
  when clicked. This invisible button is located JUST under the top 
  menu bar at the FAR right of the xulsword window. Debugging buttons 
  will appear in that same area when the invisible button is clicked.

-----

# Build Controls
Build controls are in `xulsword/build/build_settings.txt`. Build the Development 
version, Portable version, Firefox extension, and Setup installer 
version by setting their values to "true". Install modules with your 
build by adding your repository path(s) and by adding SWORD module names 
to the `IncludeModules` line. Various user preferences can be set in 
`xulsword/build/build_prefs.txt` as well. To help protect texts from tampering, 
a security module is provided. To enable the security module, set 
`UseSecurityModule` to true and set the path of `KeyGenPath` to your key 
generator. 

----

# Locale Creation
##What must be translated?
The phrases used by xulsword's user interface are found in 
`xulsword/localeDev/en-US/UI-en-US.txt`. Optional bits are in 
`xulsword/localeDev/en-US/UI-en-us_2.txt`.

##Add a new locale to xulsword
Locales are automatically packaged when xulsword is built. Create 
`xulsword/extras/localeDev/<locale-code>` and put the locale files there. Edit 
`xulsword/build/build_settings.txt` so IncludeLocales lists `<locale-code>` and 
XulswordExtras is `../extras`. Rebuild and start xulsword.

A new user interface choice will appear in the Options -> Language menu 
of xulsword. Also, a locale extension module will be created under 
build-out which can be used to install the new locale into other 
compatible versions of xulsword.

##Optional user interface possibilities
* Many optional locale configuration settings are found in 
`xulsword/localeDev/en-US/UI-en-us_2.txt` including the order of Bible books, 
short-cut keys for menu commands, CSS font-family, font-size, etc., and 
localization of numerals and search symbols, among other things.
* A locale-files subdirectory, containing a localized splash image 
called `splash-overlay.png` may be included.
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
Compile the extension by going to the `xulsword/Cpp/phpsword` directory and running:

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

