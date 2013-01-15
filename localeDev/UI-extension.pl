#!/usr/bin/perl
use File::Spec;
$NOCONSOLELOG = 1;

if (!@ARGV) {
  print "Creates a xulsword locale Firefox extension from xulsword locale files.\n";
  print "\n";
  print "usage: UI-extension.pl MK MKS locale-code\n";
  print "\n";
  print "MK is the path to xulsword svn\n";
  print "\n";
  print "MKS is the path to a xulsword extras directory.\n";
  print "\n";
  print "locale-code is the ISO language code of the locale extension to build.\n";
  print "\n";
}

$MK = shift;
$MKS = shift;
$LOCALE = shift;
$VERSION = shift;

$MK  =~ s/\\/\//g;
$MKS =~ s/\\/\//g;
if ($MK  =~ /^\s*\./) {$MK  = File::Spec->rel2abs($MK);}
if ($MKS =~ /^\s*\./) {$MKS = File::Spec->rel2abs($MKS);}
$MK  =~ s/\/\s*$//;
$MKS =~ s/\/\s*$//;

require "$MK/localeDev/script/UI-common.pl";

$LOGFILE = "$LOCALEDIR/extension_log.txt";
if (-e $LOGFILE) {unlink($LOGFILE);}
&Log($LOCINFO);

$TEMPDIR = "$MK/localeDev/tmp";
if (-e $TEMPDIR) {remove_tree($TEMPDIR)};
make_path($TEMPDIR);

$ApplicationID = "xulsword\@xulsword.org";
$ExtensionID = "$LOCALE.$ApplicationID";

# create the locale jar file
&makeZIP("$TEMPDIR/chrome/$LOCALE.jar", "$LOCALEDIR/locale/*");

# write the locale manifest file
if (open(MANF, ">:encoding(UTF-8)", "$TEMPDIR/chrome.manifest")) {
  print MANF "locale xulsword $LOCALE jar:chrome/$LOCALE.jar!/xulsword/\n";
  print MANF "\n";
  print MANF "# xulswordVersion=$VERSION\n";
  print MANF "# minMKVersion=$MAP_MIN_VERSION\n";
  close(MANF);
}
else {&Log("ERROR: Could not open .manifest file: \"$TEMPDIR/$LOCALE.locale.manifest\"\n");}

# write the install.rdf
if (open(INSF, ">:encoding(UTF-8)", "$TEMPDIR/install.rdf")) {
  print INSF "<?xml version=\"1.0\"?>\n";
  print INSF "<RDF xmlns=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\" xmlns:em=\"http://www.mozilla.org/2004/em-rdf#\">\n";
  print INSF "  <Description about=\"urn:mozilla:install-manifest\">\n";
  print INSF "    <em:id>$ExtensionID</em:id>\n";
  print INSF "    <em:version>$VERSION</em:version>\n";
  print INSF "    <em:type>8</em:type>\n";
  print INSF "    <em:name>$LOCALE xulsword locale</em:name>\n";
  print INSF "    <em:description>A Bible reading and study tool.</em:description>\n";
  print INSF "    <em:homepageURL>http://code.google.com/p/xulsword</em:homepageURL>\n";
  print INSF "    <em:iconURL>chrome://xulsword/skin/icon.png</em:iconURL>\n";
  print INSF "    <em:targetApplication>\n";
  print INSF "      <Description>\n";
  print INSF "        <em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id>\n";
  print INSF "        <em:minVersion>1.0</em:minVersion>\n";
  print INSF "        <em:maxVersion>99.0</em:maxVersion>\n";
  print INSF "      </Description>\n";
  print INSF "    </em:targetApplication>\n";
  print INSF "    <em:targetApplication>\n";
  print INSF "      <Description>\n";
  print INSF "        <em:id>$ApplicationID</em:id>\n";
  print INSF "        <em:minVersion>$MAP_MIN_VERSION</em:minVersion>\n";
  print INSF "        <em:maxVersion>$MAP_MAX_VERSION</em:maxVersion>\n";
  print INSF "      </Description>\n";
  print INSF "    </em:targetApplication>\n";
  print INSF "</Description>\n";
  print INSF "</RDF>\n";
        
  close(INSF);
}
else {&Log("ERROR: Could not open install.rdf file: \"$TEMPDIR/$LOCALE.locale.manifest\"\n");}

# zip up the extension.xpi
$OUTDIR = "$MK/build-out/LOCALES-$VERSION";
if (!-e $OUTDIR) {
  make_path($OUTDIR);
}
&makeZIP("$OUTDIR/$ExtensionID.xpi", "$TEMPDIR/*");

# make a xsm locale module too
make_path("$TEMPDIR/locale");
cp("$OUTDIR/$ExtensionID.xpi", "$TEMPDIR/locale");
&makeZIP("$OUTDIR/$LOCALE-$VERSION.xsm", "$TEMPDIR/locale");

chdir("..");
remove_tree($TEMPDIR)
