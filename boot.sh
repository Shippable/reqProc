#!/bin/bash -e

cd /home/shippable/reqProc
mkdir -p logs

# REQEXEC_PATH is path to reqExec files packaged inside the reqProc docker image
# REQEXEC_PATH is set during building docker image for reqProc
# REQEXEC_SRC_DIR is the destination path for copying packaged reqExec content
# REQEXEC_SRC_DIR is set during node initialization process
if [ ! -z $REQEXEC_PATH ] && [ ! -z $REQEXEC_SRC_DIR ]; then
  cp -r $REQEXEC_PATH $REQEXEC_SRC_DIR
fi

if [ "$RUN_MODE" == "dev" ]; then
  echo forever is watching file changes
  forever -w -v --minUptime 1000 --spinSleepTime 1000 app.js
else
  echo forever is NOT watching file changes
  node app.js
fi
