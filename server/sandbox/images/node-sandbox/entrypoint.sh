#!/bin/sh
# Usage (set as the container's Cmd): run "<javascript code>"
# $1 is expected to be "run", $2 is the code to execute.

CODE="$2"
echo "$CODE" > /tmp/snippet.js
node /tmp/snippet.js
