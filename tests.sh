#!/bin/sh

set -e

if [ "$1" = "" ]; then
	target="tests/test_*"
fi

node_modules/.bin/_mocha --reporter spec --bail --timeout 60000 $target "$@"
