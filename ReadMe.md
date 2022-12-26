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

- Direct text download. Easily download thousands of texts in hundreds of 
  languages with the "Add New Module" interface (located under the File menu, 
  or else just press F2). In addition to Bibles, also commentaries, glossaries, 
  books and devotionals can be installed and used offline without an Internet 
  connection.
- Complete internationalization including right-to-left languages.
- Very readable texts. Texts can be nicely formatted to appear on screen
  the way they look in printed form. Text flows from column to column. Font,
  font size, line spacing etc are adjustable for each text.
- Easy Bible browsing. Go to any heading in the entire Bible with a
  single click using a Bible navigator widget which also gives a visual
  representation of the Bible.
- Print capability. A powerful print feature allows Bible texts and
  related information to be easily printed, and includes print preview.
- Comprehensive and lighting fast search capability. The indexed C++ search
  engine works without Internet and enables you to dig deep into God's Word.
- Parallel and interlinear version display with original languages.
- Recursive popup windows. Dictionary links, cross references, footnotes
  and more appear in multilevel popup windows that allow instant access to a
  variety of information without necessitating a complex user interface layout.
- Bible texts and footnotes include quick links to associated dictionaries,
  including pictures, maps and tables.
- Bookmark and personal annotation features.
- Integrated audio. Allows you to listen to the Bible and read along.
  Export audio for other uses, such as mp3 players.
- Secure texts. Texts can be encrypted to prevent tampering.
- Built using the most popular Open Source technologies available as of 2023,
  to make xulsword freely available for years to come.

---

# Build Instructions

A working build has two parts: a Node.js project and a native libxulsword C++ library as
a Node.js addon. First download Boost 1.80.0 from https://www.boost.org/users/download/ and 
place it in the `xulsword/archive` directory (boost doesn't support scripted downloads).

**IMPORTANT**: Each time you open a shell to build xulsword, set its environment variables 
by running `source ./setenv`, otherwise builds will fail.

**Node.js Project**: Install nvm on Linux, Windows or Mac and use yarn to build the
Node.js project. After the libxulsword C++ library has been built or otherwise placed in the
Cpp/lib directory (see below) install it with `yarn installLXS`. Then start xulsword with
`yarn start`.

**Libxulsword C++ Addon**: Install VirtualBox and Vagrant on Linux, Windows or Mac, and
run `vagrant up`. The Node.js native addon's shared library for each operating system will 
eventually appear in the appropriate xulsword/Cpp/lib directory. The shared library for your 
particular operating system should then be installed with `yarn installLXS`.

When the libxulsword interface changes, the Node.js libxulsword addon will need to be 
recompiled for each operating system, and committed to git. See the libxulsword Readme.

---

# Packaging Instructions

Once the project has been built (see above) packaged applications for each operating system are
built with:

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
