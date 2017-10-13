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

clean_docker() {
  DOCKER_CONFIG_PATH=~/.docker
  if [ -d "$DOCKER_CONFIG_PATH" ]; then
    {
      exec_cmd "rm -rf $DOCKER_CONFIG_PATH"
    } || true
  fi
}

clean_aws() {
  AWS_CONFIG_PATH=~/.aws
  if [ -d "$AWS_CONFIG_PATH" ]; then
    {
      exec_cmd "rm -rf $AWS_CONFIG_PATH"
    } || true
  fi
}

clean_gcloud() {
  GCLOUD_CONFIG_PATH=~/.config/gcloud
  if [ -d "$GCLOUD_CONFIG_PATH" ]; then
    {
      exec_cmd "rm -rf $GCLOUD_CONFIG_PATH"
    } || true
  fi
}

clean_kube() {
  KUBE_CONFIG_PATH=~/.kube
  if [ -d "$KUBE_CONFIG_PATH" ]; then
    {
      exec_cmd "rm -rf $KUBE_CONFIG_PATH"
    } || true
  fi
}

clean_jfrog() {
  JFROG_CONFIG_PATH=~/.jfrog
  if [ -d "$JFROG_CONFIG_PATH" ]; then
    {
      exec_cmd "rm -rf $JFROG_CONFIG_PATH"
    } || true
  fi
}

clean_git_credentials() {
  GIT_CREDENTIALS_PATH=~/.git-credentials
  if [ -f "$GIT_CREDENTIALS_PATH" ]; then
    {
      exec_cmd "rm -rf $GIT_CREDENTIALS_PATH"
    } || true
  fi
}

run_cleanup() {

  clean_docker
  clean_aws
  clean_kube
  clean_gcloud
  clean_jfrog
  clean_git_credentials
  exec_cmd "echo 'cleanup complete'"
}

run_cleanup
