#! /bin/bash

HASH=`ipfs add -r -Q .`
perl -pi -e "s/content=\".*\"/content=\"\/ipfs\/$HASH\/\"/" docs/index.html
