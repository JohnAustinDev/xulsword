BUILDING XULSWORD

WINDOWS Native build: 
See https://code.google.com/p/xulsword/wiki/Compile_Instructions

LINUX Native build: Run build.sh

LINUX Cross-compiled build: Any Linux variety can be built on MS-Windows, 
Linux, or MAC machines (with at least 2GB RAM recommended) by installing 
VirtualBox (https://www.virtualbox.org/wiki/Downloads) and
Vagrant (https://www.vagrantup.com/downloads.html). From a Linux or MAC 
command prompt, or from a MS-Windows Git Bash command prompt (Git Bash 
should have been installed with Git for MS-Windows), change into the 
xulsword directory and run:

$ vagrant up precise32
or
$ vagrant up precise64

Builds are then put in the /build-out directory.
