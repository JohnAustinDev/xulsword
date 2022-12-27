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
- **Comprehensive and lighting fast search capability**. The indexed C++ search
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

**Important**: Each time you open a shell to build xulsword, environment variables
must first be set by running `source ./setenv`.

1. Install nvm on Linux, Windows or Mac.
2. Use nvm to select Node version 16.14.0
3. Run `source ./setenv` to set environment variables.
4. Build the native libxulsword C++ addon for your system:
5. Download Boost 1.80.0 from https://www.boost.org/users/download/ and place it in
   `xulsword/archive` directory (boost doesn't support scripted downloads).
6. Install VirtualBox and Vagrant, and run `vagrant up`. Native libraries for each system
   will eventually appear in the Cpp/lib directories.
7. Install the shared library for your particular operating system by running `yarn installLXS`.
8. Run `yarn` to install dependencies for the the Node.js project.
9. Start xulsword with `yarn start`.

**NOTE:** When the libxulsword interface changes, the Node.js libxulsword addon will need to be
recompiled for each operating system, and the addon committed to git. See libxulsword ReadMe.

---

# Packaging Instructions

Packaged applications for each operating system are created with:

    yarn package-linux
    yarn package-32win
    yarn package-64win

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
