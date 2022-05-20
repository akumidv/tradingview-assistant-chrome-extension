#!/bin/bash

EXT_NAME="assistnat-ext"


if [ -f ./${EXT_NAME}.zip ]; then
  rm ./${EXT_NAME}.zip
fi
zip ${EXT_NAME}.zip content_scripts/* fonts/* images/* lib/* popup/* manifest.json page-context.js




