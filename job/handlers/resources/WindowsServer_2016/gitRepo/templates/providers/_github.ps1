Function exec_cmd([string]$cmd) {
  $cmd_uuid = [guid]::NewGuid().Guid
  $DateTime = (Get-Date).ToUniversalTime()
  $cmd_start_timestamp = [System.Math]::Truncate((Get-Date -Date $DateTime -UFormat %s))
  #$cmd_start_timestamp = Get-Date -format "%s"
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
    }
  }
  Catch
  {
    $cmd_status = 1
    Write-Output $_
  }
  Finally
  {
    $DateTime = (Get-Date).ToUniversalTime()
    $cmd_end_timestamp = [System.Math]::Truncate((Get-Date -Date $DateTime -UFormat %s))
    #$cmd_end_timestamp = Get-Date -format "%s"
    Write-Output ""
    Write-Output "__SH__CMD__END__|{`"type`":`"cmd`",`"sequenceNumber`":`"$cmd_end_timestamp`",`"id`":`"$cmd_uuid`",`"exitcode`":`"$cmd_status`"}|$cmd"
  }
}

$PRIVATE_KEY = @'
<%=privateKey%>
'@
$PROJECT_CLONE_URL = @'
<%=projectUrl%>
'@
$PROJECT_CLONE_LOCATION = @'
<%=cloneLocation%>
'@
$COMMIT_SHA = @'
<%=commitSha%>
'@
$IS_PULL_REQUEST = <%= shaData.isPullRequest ? "$TRUE" : "$FALSE" %>
$IS_PULL_REQUEST_CLOSE = <%= shaData.isPullRequestClose ? "$TRUE" : "$FALSE" %>
$PULL_REQUEST = @'
<%=shaData.pullRequestNumber%>
'@
$PULL_REQUEST_BASE_BRANCH = @'
<%=shaData.pullRequestBaseBranch%>
'@
$PROJECT = @'
<%=name%>
'@


Function git_sync() {
  $temp_clone_path = "C:\Users\ContainerAdministrator\Shippable\gitRepo"

  if (Test-Path $temp_clone_path) {
    echo "Removing already existing gitRepo"
    Remove-Item -Recurse -Force $temp_clone_path
  }

  echo "Cloning $PROJECT_CLONE_URL"
  git clone $PROJECT_CLONE_URL $temp_clone_path

  echo "Moving to $PROJECT_CLONE_LOCATION"
  Move-Item $temp_clone_path\* -Destination $PROJECT_CLONE_LOCATION
}

exec_cmd git_sync
