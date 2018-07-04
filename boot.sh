#!/bin/bash -e

cd $IMAGE_REQPROC_DIR
mkdir -p logs

# IMAGE_REQEXEC_DIR is the directory path on image.
if [ -z $IMAGE_REQEXEC_DIR ]; then
  echo "IMAGE_REQEXEC_DIR env is missing"
  exit 1
fi

# REQEXEC_DIR is the directory path path on host.
if [ -z $REQEXEC_DIR ]; then
  echo "REQEXEC_DIR env is missing"
  exit 1
fi

cp -r "$IMAGE_REQEXEC_DIR"/. "$REQEXEC_DIR"

if [ -n "$KEY_STORE_LOCATION" ]; then
  rm -rf $KEY_STORE_LOCATION/*
fi

if [ -n "$MESSAGE_STORE_LOCATION" ]; then
  rm -rf $MESSAGE_STORE_LOCATION/*
fi

if [ "$RUN_MODE" == "dev" ]; then
  echo forever is watching file changes
  forever -w -v --minUptime 1000 --spinSleepTime 1000 app.js
else
  echo forever is NOT watching file changes
  node app.js
fi
