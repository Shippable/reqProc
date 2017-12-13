#!/bin/bash -e

New-Item -ItemType Directory -Force -Path .\logs

# IMAGE_REQEXEC_DIR is the directory path on image.
if (-not ($IMAGE_REQEXEC_DIR)) {
  Write-Error "IMAGE_REQEXEC_DIR env is missing"
  exit 1
}

# REQEXEC_DIR is the directory path on host.
if (-not ($REQEXEC_DIR)) {
  Write-Error "REQEXEC_DIR env is missing"
  exit 1
}

Copy-Item $IMAGE_REQEXEC_DIR\* -Recurse -Destination $REQEXEC_DIR

node app.js
