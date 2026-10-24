# A Bible reading and study tool

xulsword is a Bible reading and study tool intended to be easy to use,
yet very powerful at the same time. It utilizes popular Open Source
technologies such as Node.js, React and The SWORD Project, and will
always be a free program. It is designed for full internationalization,
including right-to-left languages, and is fully functional offline.
Modules may be installed from the Internet however.

## Distinctives include:

- **Direct text download**. Easily download thousands of texts in hundreds of
  languages with the "Add New Module" interface (located under the File menu,
  or else just press F2). Bible translations, commentaries, glossaries, books
  and study materials in many languages can be freely downloaded and installed
  for offline use.
- **Original language study features**. Gain deeper understanding of any Bible
  translation through comparison to ancient original language texts and
  instant concordance lookup.
- **Comprehensive and lightning fast search capability**. The indexed C++ search
  engine works without Internet and enables you to dig deep into God's Word.
- **Complete internationalization** including right-to-left languages.
- **Very readable texts**. Formatted texts are displayed on screen the way they look
  in printed form. Text flows from column to column. Font, font size, line
  spacing etc. are adjustable for each text.
- **Easy Bible browsing**. Instantly jump to any heading in the entire Bible with a
  single click using a Bible navigator widget which also gives a visual
  representation of the Bible.
- **Print capability**. Powerful print features allow Bible texts and
  related information to be easily printed, and includes print preview.
- **Recursive popup windows**. Dictionary links, cross references, footnotes
  and more appear in recursive popup windows that allow instant access to a
  variety of information without necessitating a complex user interface.
- **Bible texts and footnotes include quick links** to associated dictionaries,
  including pictures, maps and tables.
- **Bookmark and personal annotation features**.
- **Integrated audio**. Allows you to listen to the Bible and read along. Export
  audio for other uses, such as mp3 players.
- **Secure texts**. Texts can be encrypted to prevent tampering.
- **Open Source software technology**. Xulsword was developed using the most popular
  Open Source technologies as of 2023, to make it freely available for years to
  come.

---

# Build Instructions

The build has two parts: a Node.js project and a native libxulsword C++ library.

**Important**: First copy the environment script `cp ./scripts/setenv .`. This script can then be updated with any custom settings.
Each time you open a shell to build xulsword, environment variables must be set by running `source ./setenv`.

1. Install [nvm](https://github.com/nvm-sh/nvm).
2. Run `source ./setenv` to set environment variables and node version.
3. Build the native libxulsword C++ dynamic libraries (this step only needs to be done once and won't be needed again unless xulsword/Cpp sources change):

- Download the [boost_1_80_0.tar.gz](https://www.boost.org/users/download/) source code package (check for the right version number; you may need to go to the history section to find previous releases). Create an `archive` sub-directory under `xulsword` and place the source package there (boost doesn't support scripted downloads).
- To also build the Windows and MacOS libraries, set `WINMACHINE` and `MACMACHINE` in `setenv`. The MacOS build also needs a MacOS SDK in the `archive` directory (see [libxulsword ReadMe](libxulsword/Readme.md)).
- Install [Docker](https://docs.docker.com/engine/install/) and run `./docker-build.sh`. Native libraries for each system will appear in the Cpp/lib directories. Your local code is built as it is, including uncommitted changes. Later runs only rebuild what has changed; run `./docker-build.sh --clean` to rebuild everything.
- Install the shared library for your particular operating system by running `yarn install-libxulsword`. The apporpriate binaries will be installed to the libxulsword nodejs module.

4. Run `yarn` to install Node.js dependencies.
5. Start xulsword with `yarn start:app` or start the web app with `yarn start:webapp`.

---

# Packaging Instructions

Packaged applications for each operating system are created with:

    yarn package-linux
    yarn package-32win
    yarn package-64win
    yarn package-mac

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
