#!/bin/bash

#usage: mac_dmg.sh <srcdir> <name> <size> <imgpath.png> <filename.dmg>
srcdir=$1
name=$2
size=$3
img=$4
out=$5

hdiutil create -srcfolder "${srcdir}/${name}.app" -volname "${name}" -fs HFS+ -fsargs "-c c=64,a=16,e=16" -format UDRW -size ${size}k pack.temp.dmg

device=$(hdiutil attach -readwrite -noverify -noautoopen "pack.temp.dmg" | egrep '^/dev/' | sed 1q | awk '{print $1}')

sleep 3

mkdir /Volumes/${name}/.background
cp ${img} /Volumes/${name}/.background/dmg_background.png

echo '
   tell application "Finder"
     tell disk "'${name}'"
           open
           set current view of container window to icon view
           set toolbar visible of container window to false
           set statusbar visible of container window to false
           set the bounds of container window to {400, 100, 885, 430}
           set theViewOptions to the icon view options of container window
           set arrangement of theViewOptions to not arranged
           set icon size of theViewOptions to 72
           set background picture of theViewOptions to file ".background:dmg_background.png"
           make new alias file at container window to POSIX file "/Applications" with properties {name:"Applications"}
           set position of item "'${name}'" of container window to {100, 100}
           set position of item "Applications" of container window to {375, 100}
           update without registering applications
           delay 5
           close
     end tell
   end tell
' | osascript

chmod -Rf go-w /Volumes/${name}
sync
sync
hdiutil detach /Volumes/${name}
hdiutil convert "./pack.temp.dmg" -format UDZO -imagekey zlib-level=9 -o "${out}"
rm -f ./pack.temp.dmg 
