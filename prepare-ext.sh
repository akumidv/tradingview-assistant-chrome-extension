#!/bin/bash
# Packs the extension (everything under extension/) into assistant-ext.zip at the repository root.

EXT_NAME="assistant-ext"
cd "$(dirname "$0")"

if [ -f ./${EXT_NAME}.zip ]; then
  rm ./${EXT_NAME}.zip
fi
(cd extension && zip -r ../${EXT_NAME}.zip .)
