#!/bin/bash
# Packs extension/ into assistant-ext.zip for the Chrome Web Store after the release checks (see _aitna/tools/release).
cd "$(dirname "$0")" && exec node _aitna/tools/release/cli.mjs pack "$@"
