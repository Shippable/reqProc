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

export NO_VERIFY_SSL="<%=noVerifySSL%>"
export PRIVATE_KEY="<%=privateKey%>"
export PROJECT_CLONE_URL="<%=projectUrl%>"
export PROJECT_CLONE_LOCATION="<%=cloneLocation%>"
export COMMIT_SHA="<%=commitSha%>"
export IS_PULL_REQUEST=<%=shaData.isPullRequest%>
export IS_PULL_REQUEST_CLOSE=<%=shaData.isPullRequestClose%>
export PULL_REQUEST="<%=shaData.pullRequestNumber%>"
export PULL_REQUEST_BASE_BRANCH="<%=shaData.pullRequestBaseBranch%>"
export PROJECT="<%=name%>"
export PROJECT_KEY_LOCATION="<%=keyLocation%>"

git_sync() {
  if [ "$NO_VERIFY_SSL" == "true" ]; then
    git config --global http.sslVerify false
  fi

  echo "$PRIVATE_KEY" > $PROJECT_KEY_LOCATION
  chmod 600 $PROJECT_KEY_LOCATION
  git config --global credential.helper store

  shippable_retry ssh-agent bash -c "ssh-add $PROJECT_KEY_LOCATION; git clone $PROJECT_CLONE_URL $PROJECT_CLONE_LOCATION"

  echo "----> Pushing Directory $PROJECT_CLONE_LOCATION"
  pushd $PROJECT_CLONE_LOCATION

  echo "----> Setting git user name"
  git config --get user.name || git config user.name 'Shippable Build'
  git config --get user.email || git config user.email 'build@shippable.com'

  echo "----> Checking out commit SHA"
  if [ "$IS_PULL_REQUEST" != false ]; then
    shippable_retry ssh-agent bash -c "ssh-add $PROJECT_KEY_LOCATION; git fetch origin pull/$PULL_REQUEST/head"
    git checkout -f FETCH_HEAD
    git merge origin/$PULL_REQUEST_BASE_BRANCH
  else
    git checkout $COMMIT_SHA
  fi

  echo "----> Popping $PROJECT_CLONE_LOCATION"
  popd
}

exec_cmd git_sync
