#!/bin/bash -e

cd /home/shippable/reqProc
mkdir -p logs

cp -r $REQEXEC_PATH $REQEXEC_SRC_DIR

if [ "$RUN_MODE" == "dev" ]; then
  echo forever is watching file changes
  forever -w -v --minUptime 1000 --spinSleepTime 1000 app.js
else
  echo forever is NOT watching file changes
  node app.js
fi
