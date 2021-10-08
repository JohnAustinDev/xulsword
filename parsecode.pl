#!/usr/bin/perl

use strict;

my $PATT = shift;

my $PATH = "./xul/content";

my %R; &parse($PATH, $PATT, \%R);

print "Results: $PATT found in $PATH:\n\n";
print sprintf("%32s %5s %s\n", '   MATCH',    'COUNT', 'SOURCE FILE(S)');
print sprintf("%32s %5s %s\n", '-----------', '-----', '--------------');
foreach my $match (sort {$R{$b}{'count'} <=> $R{$a}{'count'}} keys %R) {
  print sprintf("%32s %5i %s\n", 
    $match, 
    $R{$match}{'count'}, 
    join(' ', keys %{$R{$match}{'files'}})
  );
}
print "\n";

sub parse {
  my $dir = shift;
  my $patt = shift;
  my $dataP = shift;
  
  foreach my $f (split(/\n/, `find $dir -type f`)) {
    if (!open(INF, "<$f")) {die;}
    while (<INF>) {
      while ($_ =~ s/($patt)//) {
        my $if = $1;
        $dataP->{$if}{'count'}++;
        $dataP->{$if}{'files'}{$f}++;
      }
    }
    close(INF);
  }
}
