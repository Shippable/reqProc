Function exec_cmd([string]$cmd) {
  $cmd_uuid = [guid]::NewGuid().Guid
  $cmd_start_timestamp = Get-Date -format "%s"
  Write-Output "__SH__CMD__START__|{`"type`":`"cmd`",`"sequenceNumber`":`"$cmd_start_timestamp`",`"id`":`"$cmd_uuid`"}|$cmd"

  $cmd_status = 0
  $ErrorActionPreference = "Stop"

  Try
  {
    $global:LASTEXITCODE = 0;
    Invoke-Expression $cmd
    $ret = $LASTEXITCODE
    if ($ret -ne 0) {
      $cmd_status = $ret
      Throw
    }
  }
  Catch
  {
    $cmd_status = 1
    Write-Output $_
    Throw
  }
  Finally
  {
    $cmd_end_timestamp = Get-Date -format "%s"
    Write-Output ""
    Write-Output "__SH__CMD__END__|{`"type`":`"cmd`",`"sequenceNumber`":`"$cmd_end_timestamp`",`"id`":`"$cmd_uuid`",`"exitcode`":`"$cmd_status`"}|$cmd"
  }
}

$PRIVATE_KEY = "<%=privateKey%>"
$PROJECT_CLONE_URL = "<%=projectUrl%>"
$PROJECT_CLONE_LOCATION = "<%=cloneLocation%>"
$COMMIT_SHA = "<%=commitSha%>"
$PROJECT = "<%=name%>"

Function git_sync() {
  echo "git_sync should happen for windows here"
}

exec_cmd git_sync
