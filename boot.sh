#!/bin/bash -e

cd /home/shippable/reqProc
mkdir -p logs

# REQEXEC_PATH is path to reqExec files packaged inside the reqProc docker image
# REQEXEC_PATH is set during building docker image for reqProc
if [ -z $REQEXEC_PATH ]; then
  echo "REQEXEC_PATH env is missing"
  exit 1
fi

# REQEXEC_BIN_DIR is the destination path for copying packaged reqExec content
# REQEXEC_BIN_DIR is set during node initialization process
if [ -z $REQEXEC_BIN_DIR ]; then
  echo "REQEXEC_BIN_DIR env is missing"
  exit 1
fi

cp -r "$REQEXEC_PATH"/. "$REQEXEC_BIN_DIR"

if [ "$RUN_MODE" == "dev" ]; then
  echo forever is watching file changes
  forever -w -v --minUptime 1000 --spinSleepTime 1000 app.js
else
  echo forever is NOT watching file changes
  node app.js
fi
