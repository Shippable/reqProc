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
export IS_PULL_REQUEST=<%=shaData.isPullRequest%>
export IS_PULL_REQUEST_CLOSE=<%=shaData.isPullRequestClose%>
export PULL_REQUEST="<%=shaData.pullRequestNumber%>"
export PULL_REQUEST_BASE_BRANCH="<%=shaData.pullRequestBaseBranch%>"
export PROJECT="<%=name%>"
export PROJECT_KEY_LOCATION="<%=keyLocation%>"
export SHIPPABLE_DEPTH=<%=depth%>
if [ "$IS_PULL_REQUEST" != "false" ]; then
  export BEFORE_COMMIT_SHA="<%=shaData.beforeCommitSha%>"
fi

git_sync() {
  echo "$PRIVATE_KEY" > $PROJECT_KEY_LOCATION
  chmod 600 $PROJECT_KEY_LOCATION
  git config --global credential.helper store

  local git_clone_cmd="git clone $PROJECT_CLONE_URL $PROJECT_CLONE_LOCATION"
  if [ ! -z "$SHIPPABLE_DEPTH" ]; then
    git_clone_cmd="git clone --no-single-branch --depth $SHIPPABLE_DEPTH $PROJECT_CLONE_URL $PROJECT_CLONE_LOCATION"
  fi
  shippable_retry ssh-agent bash -c "ssh-add $PROJECT_KEY_LOCATION; $git_clone_cmd"

  echo "----> Pushing Directory $PROJECT_CLONE_LOCATION"
  pushd $PROJECT_CLONE_LOCATION

  echo "----> Setting git user name"
  git config --get user.name || git config user.name 'Shippable Build'
  git config --get user.email || git config user.email 'build@shippable.com'

  <% _.each(gitConfig, function (config) { %>
  {
    git config <%=config%>
  } || {
    exec_cmd "echo 'Error while setting up git config: <%=config%>'"
    return 1
  }
  <% }); %>

  echo "----> Checking out commit SHA"
  if [ "$IS_PULL_REQUEST" != false ]; then
    local git_fetch_cmd="git fetch origin merge-requests/$PULL_REQUEST/head"
    if [ ! -z "$SHIPPABLE_DEPTH" ]; then
      git_fetch_cmd="git fetch --depth $SHIPPABLE_DEPTH origin merge-requests/$PULL_REQUEST/head"
    fi
    shippable_retry ssh-agent bash -c "ssh-add $PROJECT_KEY_LOCATION; git fetch origin merge-requests/$PULL_REQUEST/head"
    git checkout -f FETCH_HEAD
    merge_result=0
    {
      git merge origin/$PULL_REQUEST_BASE_BRANCH
    } || {
      merge_result=$?
    }
    if [ $merge_result -ne 0 ]; then
      if [ ! -z "$SHIPPABLE_DEPTH" ]; then
        {
          git rev-list FETCH_HEAD | grep $BEFORE_COMMIT_SHA >> /dev/null 2>&1
        } || {
          echo "The PR was fetched with depth $SHIPPABLE_DEPTH, but the base commit $BEFORE_COMMIT_SHA is not present. Please try increasing the depth setting on your project."
        }
      fi
      return $merge_result
    fi
  else
    checkout_result=0
    {
      git checkout $COMMIT_SHA
    } || {
      checkout_result=$?
    }
    if [ $checkout_result -ne 0 ]; then
      if [ ! -z "$SHIPPABLE_DEPTH" ]; then
        {
          git cat-file -t $COMMIT_SHA >> /dev/null 2>&1
        } || {
          echo "The repository was cloned with depth $SHIPPABLE_DEPTH, but the commit $COMMIT_SHA is not present in this depth. Please increase the depth to run this build."
        }
      fi
      return $checkout_result
    fi
  fi

  echo "----> Popping $PROJECT_CLONE_LOCATION"
  popd
}

exec_cmd git_sync
