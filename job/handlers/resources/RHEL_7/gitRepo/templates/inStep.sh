#!/bin/bash -e
exec_cmd() {
  cmd=$@
  cmd_uuid=$(cat /proc/sys/kernel/random/uuid)
  cmd_start_timestamp=`date +"%s"`
  echo "__SH__CMD__START__|{\"type\":\"cmd\",\"sequenceNumber\":\"$cmd_start_timestamp\",\"id\":\"$cmd_uuid\"}|$cmd"
  eval "$cmd"
  cmd_status=$?
  if [ "$2" ]; then
    echo $2;
  fi

  cmd_end_timestamp=`date +"%s"`
  # If cmd output has no newline at end, marker parsing
  # would break. Hence force a newline before the marker.
  echo ""
  echo "__SH__CMD__END__|{\"type\":\"cmd\",\"sequenceNumber\":\"$cmd_start_timestamp\",\"id\":\"$cmd_uuid\",\"exitcode\":\"$cmd_status\"}|$cmd"
  return $cmd_status
}

export PRIVATE_KEY="<%=privateKey%>"
export PROJECT_CLONE_URL="<%=projectUrl%>"
export PROJECT_CLONE_LOCATION="<%=cloneLocation%>"
export COMMIT_SHA="<%=commitSha%>"
export PROJECT="<%=name%>"
export PROJECT_KEY_LOCATION="<%=keyLocation%>"

git_sync() {
  echo "$PRIVATE_KEY" > $PROJECT_KEY_LOCATION
  chmod 600 $PROJECT_KEY_LOCATION
  git config --global credential.helper store

  ssh-agent bash -c "ssh-add $PROJECT_KEY_LOCATION; git clone $PROJECT_CLONE_URL $PROJECT_CLONE_LOCATION"

  echo "----> Pushing Directory $PROJECT_CLONE_LOCATION"
  pushd $PROJECT_CLONE_LOCATION

  echo "----> Checking out commit SHA"
  git checkout $COMMIT_SHA

  echo "----> Popping $PROJECT_CLONE_LOCATION"
  popd
}

exec_cmd git_sync
