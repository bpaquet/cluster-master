#!/bin/sh

set -e

if [ "$1" = "" ]; then
	target="tests/test_*"
fi

node_modules/.bin/_mocha --timeout 20000 $target "$@"
