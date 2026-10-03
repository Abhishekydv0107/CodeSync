#!/bin/sh
# Usage (set as the container's Cmd): run "<python code>"
# $1 is expected to be "run", $2 is the code to execute.

CODE="$2"
echo "$CODE" > /tmp/snippet.py
python3 /tmp/snippet.py
