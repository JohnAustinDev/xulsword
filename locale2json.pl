#!/usr/bin/perl

# usage: locale2json.pl indir outdir

use strict;

my $INDIR  = shift; $INDIR  =~ s/\/$//;
my $OUTDIR = shift; $OUTDIR =~ s/\/$//;

if ($INDIR !~ /^\.\// || $OUTDIR !~ /^\.\//) {
  &abort("in/out directories must start with ./");
}

if ($INDIR !~ /\/([^\/]+)\/xulsword$/) {
  &abort("input directory path must end with '/xulsword': $INDIR");
}
my $LANG = $1; $LANG =~ s/en\-US/en/;
$OUTDIR .= "/$LANG";

if (-e $OUTDIR) {
  &abort("output dir already exists: $OUTDIR");
}

my @files = split(/\n/, `find '$INDIR' -type f`);

my %FILEKEYS;
foreach my $file (@files) {
  &copyConvert($file, $INDIR, $OUTDIR);
}

my @files = split(/\n/, `find '$OUTDIR' -name "*.json"`);
foreach my $file (@files) {
  open(INF, "<:encoding(UTF-8)", $file) || die;
  open(OUTF, ">:encoding(UTF-8)", "$file.tmp") || die;
  print OUTF "{\n";
  my $s; while (<INF>) {$s .= $_;} $s =~ s/,([\s\n]*\Z)/$1/; print OUTF $s;
  print OUTF "}\n";
  close(INF); close(OUTF);
  `mv "$file.tmp" "$file"`;
  print `jsonlint-php "$file"`;
}

print "FINISHED! (without errors)\n";

########################################################################
########################################################################

sub copyConvert {
  my $filepath = shift;
  my $inbase = shift;
  my $outbase = shift;
  
  my $subdirs = $filepath; $subdirs =~ s/^\Q$inbase/./;
  my $file = ($subdirs =~ s/\/([^\/]*)$// ? $1 : ''); 
  if (!$file) {&abort("bad path: $filepath");}
  
  if (! -d "$outbase/$subdirs") {&shell("mkdir -p '$outbase/$subdirs'");}
  
  if ($file !~ s/\.(txt|dtd|properties)$/\.json/) {
    &shell("cp '$filepath' '$outbase/$subdirs/$file'");
    next;
  }
  print "Converting: $file\n";
  
  open(INF, "<:encoding(UTF-8)", "$filepath") || die;
  open(OUTF, ">>:encoding(UTF-8)", "$outbase/$subdirs/$file") || die;

  #print OUTF "\n# $filepath\n"; comments not allowed in json

  while (<INF>) {
    if (/^#/ || /^\s*$/) {
      #print OUTF &val($_); comments not allowed in json
      next;
    }

    my ($key, $s);
    if ($filepath =~ /\.txt$/ && /^\[(.*?)\]:\s*(.*?)\s*$/) {
      $key = $1; $s = $2;
    }
    elsif ($filepath =~ /\.dtd$/ && /<!ENTITY\s+(\S+)\s+"(.*?)"\s*>/) {
      $key = $1; $s = $2;
    }
    elsif ($filepath =~ /\.properties$/ && /^(\S+)\s*=\s*(.*?)\s*$/) {
      $key = $1; $s = $2;
    }
    else {&abort("unparsed line in $filepath: $_");}
    
    if (exists($FILEKEYS{"$outbase/$subdirs/$file"}{$key})) {
      if ($FILEKEYS{"$outbase/$subdirs/$file"}{$key} eq $s) {next;}
      else {
        &abort("file key has two different values: $outbase/$subdirs/$file $key
        $FILEKEYS{'$outbase/$subdirs/$file'}{$key}
        $s");
      }
    }
    $FILEKEYS{"$outbase/$subdirs/$file"}{$key} = $s;
    
    print OUTF "  \"$key\": \"".&val($s)."\",\n";
  }

  close(INF);
  close(OUTF);
}

sub val {
  my $s = shift;
  
  $s =~ s/\%(\d+)\$S/{{v$1}}/g;
  $s =~ s/(?<!\\)"/\\"/g;
  return $s;
}

sub abort {
  my $msg = shift;
  
  print "ABORT: $msg\n";
  die;
}

sub shell {
  my $cmd = shift;
  
  print "Running: $cmd\n";
  return `$cmd`;
}
