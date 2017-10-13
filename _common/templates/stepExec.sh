#!/bin/bash

# Begin environment variables from the Yml
<% _.each(obj.env, function (e) { %>
{
  export <%= e %>;
} || {
  exec_cmd "echo 'An error occurred while trying to export an environment variable: <%= e.split('=')[0] %> '"
  return 1
}
<% }); %>
# End environment variables from the Yml

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

export is_success=false

main() {
  is_success=false
  exec_cmd "<%= obj.scriptPath %>"
  cmd_status=$?
  if [ $cmd_status -gt 0 ]; then
    exit $cmd_status
  fi
  is_success=true
}

on_success() {
  is_success=true
  <% _.each(obj.on_success, function (step) { %>
    <% var cmdEscaped = step.replace(/\\/g, '\\\\')%>
    <% cmdEscaped = cmdEscaped.replace(/'/g, "\\'") %>
    eval $'<%= cmdEscaped %>'
  <% }); %>
}

on_failure() {
  is_success=false
  <% _.each(obj.on_failure, function (step) { %>
    <% var cmdEscaped = step.replace(/\\/g, '\\\\')%>
    <% cmdEscaped = cmdEscaped.replace(/'/g, "\\'") %>
    eval $'<%= cmdEscaped %>'
  <% }); %>
}

always() {
  # adding : so that this isn't an empty function
  :
  <% _.each(obj.always, function (step) { %>
    <% var cmdEscaped = step.replace(/\\/g, '\\\\')%>
    <% cmdEscaped = cmdEscaped.replace(/'/g, "\\'") %>
    eval $'<%= cmdEscaped %>'
  <% }); %>
}

before_exit() {
  echo $1
  echo $2
  if [ "$is_success" == true ]; then
    {
      exec_cmd on_success
    } || true
  else
    {
      exec_cmd on_failure
    } || true
  fi
  {
    exec_cmd always
  } || true
}

trap before_exit EXIT
main
