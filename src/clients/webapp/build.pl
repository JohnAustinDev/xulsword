#!/usr/bin/perl

use strict;

my $DIST_PARENT_DIR = shift;
my $IS_DEVELOPMENT = shift;

if (! "$DIST_PARENT_DIR" || ! -d "$DIST_PARENT_DIR/dist/") {
  print "Usage: build.sh DIST_PARENT_DIR [IS_DEVELOPMENT]";
  print "ERROR: Not a directory: $DIST_PARENT_DIR/dist";
  exit 1;
}

if ("$DIST_PARENT_DIR" =~ /^\./) {
  $DIST_PARENT_DIR=`pwd` . "/./$DIST_PARENT_DIR";
}

{ my $path = $0; $path =~ s/\/[^\/]+$//; chdir("$path/../../.."); }

`rm "$DIST_PARENT_DIR/dist/"*`;
`rm -rf "./build/app/dist/"*`;

# Sourcing for environment variables does not work in Perl, so a wrapper
# build.sh must be used to set the environment.
# doesn't work -> `source ./setenv`;

if ("$IS_DEVELOPMENT" eq "1") {
  open(YARN, "yarn webpack --env development --env webappClients |");
} else {
  open(YARN, "yarn webpack --env production --env webappClients |");
}
while (<YARN>) { print $_;}
close(YARN);

if ("$?" eq "0") {
  my $dist = "$DIST_PARENT_DIR/dist";
  `cp "./build/webapp/dist/webappClients/"* "$dist"`;
  my $cmd = "sed -i 's/<\\/head>/<link href=\"\\/modules\\/custom\\/ibt\\/css\\/bibleBrowser.css\" rel=\"stylesheet\"><\\/head>/' \"$dist/bibleBrowser.html\"";
  print $cmd . "\n";
  `$cmd`;
  my $libs = "ibt.libraries.yml";
  chdir "$DIST_PARENT_DIR" || die;
  if (-e "$libs") {
    opendir(JSF, "$dist") || die;
    my @files = readdir(JSF);
    closedir(JSF);
    my $file; foreach my $f (@files) {if ($f =~ /^widgets_.*\.js$/) {$file = $f; last;}}
    open(INF, "<:encoding(UTF-8)", "$libs") || die;
    open(OUTF, ">:encoding(UTF-8)", "$libs.tmp") || die;
    while(<INF>) {s/(?<=\bdist\/)widgets_.*\.js(?=:)/$file/; print OUTF $_;}
    close(INF); close(OUTF); `mv "$libs.tmp" "$libs"`;
  }
} else {
  `echo "ERROR: react build failed."`;
  exit 1;
}
