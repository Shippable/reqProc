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

get_disk_info() {
  exec_cmd "df -h"
}

get_mem_info() {
  exec_cmd "free -m"
}

get_machine_info() {
  exec_cmd "uname -a"
  exec_cmd "uptime"
}

check_docker_daemon() {
  local max_retries=5
  local wait_time_secs=3
  for i in $(seq 1 $max_retries); do
    {
      sudo docker info > /dev/null 2>&1
      exec_cmd "echo 'Docker daemon successfully running on the host'"
      break
    } || {
      exec_cmd "echo 'Waiting for Docker daemon to boot, retry $i'"
      sleep $wait_time_secs
    }
  done
}

get_docker_info() {
  exec_cmd "sudo docker info"
}

get_docker_containers() {
  exec_cmd "sudo docker ps -a"
}

get_bash_info() {
  exec_cmd "bash --version"
}

job_node_info() {
  get_machine_info
  ret=$?
  [ "$ret" != 0 ] && return $ret;
  is_success=true

  get_disk_info
  ret=$?
  [ "$ret" != 0 ] && return $ret;
  is_success=true

  get_mem_info
  ret=$?
  [ "$ret" != 0 ] && return $ret;
  is_success=true

  check_docker_daemon
  ret=$?
  [ "$ret" != 0 ] && return $ret;
  is_success=true

  get_docker_info
  ret=$?
  [ "$ret" != 0 ] && return $ret;
  is_success=true

  get_docker_containers
  ret=$?
  [ "$ret" != 0 ] && return $ret;
  is_success=true

  get_bash_info
  ret=$?
  [ "$ret" != 0 ] && return $ret;
  is_success=true
}

job_node_info
