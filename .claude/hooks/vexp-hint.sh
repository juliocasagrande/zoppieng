#!/bin/bash
# vexp-hint: event-driven orientation hint (UserPromptSubmit). Fails open.
VEXP_BIN="c:/Users/jlcasagrande/.vscode/extensions/vexp.vexp-vscode-2.7.0-win32-x64/binaries/vexp-core-win32-x64/vexp-core.exe"
[ -x "$VEXP_BIN" ] || exit 0
"$VEXP_BIN" prompt-hint 2>/dev/null
exit 0
