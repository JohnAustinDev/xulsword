# A Bible reading and study tool

xulsword is a Bible reading and study tool intended to be easy to use,
yet very powerful at the same time. It utilizes popular Open Source
technologies such as Node.js, React and The SWORD Project, and will
always be a free program. It is designed for full internationalization,
including right-to-left languages. Potential users include those who
are not necessarily computer savvy, those who might be new to the
Bible, and those who may not have (or may not want to use) an internet
connection.

## Distinctives include:

- Direct text download. Allows easy download of hundreds of texts in
  hundreds of languages with the "Add New Module" interface (located under
  the File menu, or else just press F2).
- Complete internationalization including right-to-left languages.
- Very readable texts. Texts can be nicely formatted to appear on screen
  the way they look in printed form. Text flows from column to column. Font,
  font size, line spacing etc are adjustable for each text.
- Easy Bible browsing. Go to any heading in the entire Bible with a
  single click using a Bible navigator widget which also gives a visual
  representation of the Bible.
- Print capability. A powerful print feature allows Bible texts and
  related information to be easily printed, and includes print preview.
- Recursive popup windows. Dictionary links, cross references, footnotes
  and more appear in multilevel recursive popup windows that allow instant
  access to a variety of information without necessitating a complex user
  interface layout.
- Integrated audio. Allows you to listen to the Bible and read along.
  Export audio for other uses, such as mp3 players.
- Textual Links. Bible texts and footnotes can include quick links to
  associated dictionaries, which may include pictures, maps and tables.
- Powerful bookmark and personal annotation features. Annotate texts
  with personal notes, create and organize bookmarks, notes and verse
  lists. Make quality printouts of your notes and verse lists, or export
  them to share with other xulsword users.
- Secure texts. Texts can be encrypted and secured to prevent others
  from tampering with them.
- Built using the most reliable and well supported Open Source tech
  available. Although originally built using Mozilla's XUL markup and being
  dependent on XULRunner, xulsword is now written completely in Javascript
  (with the exception of the C++ SWORD engine). Under the hood, XUL is now
  rendered by a Javascript React library, and XULRunner has been replaced
  by Node.js.

## Plus many other features provided by the SWORD engine, such as:

- Compatible with a wide variety of Bibles, commentaries, glossaries,
  books, and devotionals which are already freely available in the SWORD standard.
- Powerful search capability.
- Parallel and interlinear version display.
- Much more...

---

# Compilation instructions for Linux

**Linux (Ubuntu Xenial/Bionic)**: Run init.sh

**Cross-compiled to Linux 64/32 bit**: On MS-Windows, Linux, or MAC install
[VirtualBox](https://www.virtualbox.org/wiki/Downloads) and
[Vagrant](https://www.vagrantup.com/downloads.html) and run:

`$ vagrant up`

---

# (OUTDATED) Compilation instructions for MAC OSX El Capitan:

Install Firefox and Homebrew. Then run build.sh.

---

# (OUTDATED) Compilation instructions for MS-Windows

## Build requirements

The following programs need to be in the command path:

- [Git](http://git-scm.com/download/win)
- [7-zip](http://www.7-zip.org/download.html) (command line version)
- [Perl](http://www.activestate.com/activeperl/downloads/)
- [Microsoft SDK](https://www.microsoft.com/en-us/download/details.aspx?id=8442) (GRMSDKX_EN_DVD.iso for 64 bit builds)
  You may need to run Setup/SDKSetup.exe (instead of setup.exe) to allow compiler installation.
  Unfortunately this version of cvtres.exe is broken which adds custom launcher
  icons. The official fix creates yet another bug by deleting amnintrin.h
  so that nothing compiles... Workaround in progress...

## Compilation Steps

- Get the xulsword code from GitHub.
- Get the [XulRunner runtime (version 41.0b9)](https://developer.mozilla.org/en/XULRunner).
- Get [Clucene (version 0.9.21b)](http://sourceforge.net/projects/clucene/files/clucene-core-stable/0.9.21b/).
- Get [SWORD (svn revision 3203)](http://crosswire.org/svn/sword) source code.
- Check or add paths in `xulsword/build/build_settings.txt` for
  `XULRunner`, `CluceneSource`, `SwordSource`, `MicrosoftVS` and `MicrosoftSDK`.
- Run `xulsword/build/build.pl`
- Start the program by running `xulsword/build/run-xulsword-dev.pl` (which is
  created when you build xulsword). The development version of the
  program has a hidden button which displays useful debugging features
  when clicked. This invisible button is located JUST under the top
  menu bar at the FAR right of the xulsword window. Debugging buttons
  will appear in that same area when the invisible button is clicked.

---

# Audio Modules

Translations may have associated audio readings of the text. These audio
files can be packaged in zip files for easy installation into xulsword.
After installation, audio icons will appear above the associated texts
to play their audio recording. Audio files may be exported from xulsword
with File -> Export Audio.

## Packaging an audio module

An audio module is a zip archive with a directory structure containing
ogg audio files like:

`/audio/<audio-code>/<osis-bible-book-name>/001.ogg`

The audio-code can be chosen three different ways:

- Usually, it is simply the name of a SWORD Bible module (and module
  names are case sensitive, so make sure the directory name exactly
  matches the module name).
- Sometimes, when audio files need to target more than one Bible module
  (for instance two modules of the same translation using different
  scripts), then any unique audio-code may be used, but in this case all
  SWORD modules associated with the audio files need to have
  `AudioCode=<audio-code>` in their .conf files.
- It is also possible to use the ISO-639 language code as the
  audio-code, which will then associate the audio files with all SWORD
  modules shareing that language code.

## Audio file coverage

An ogg file should cover an entire Bible chapter. It's perfectly ok if
only certain chapters have audio files. It's possible to have multiple
chapters recorded in a single audio file, but this is not recommended
because users will only be notified of the existence of the first
chapter's recording (the audio icon will only appear in the first
chapter which is covered by the audio file).

## Audio file tagging

Audio files can be exported from xulsword, so it's also a good idea to
tag the audio files. But xulsword itself does not require or utilise
audio file tags.

---

# PECL extension: phpsword

The PHP extension brings libxulsword's API into php.

## Compilation and use

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
