Function exec_cmd([string]$cmd) {
  $cmd_uuid = [guid]::NewGuid().Guid
  $date_time = (Get-Date).ToUniversalTime()
  $cmd_start_timestamp = [System.Math]::Truncate((Get-Date -Date $date_time -UFormat %s))
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
    $date_time = (Get-Date).ToUniversalTime()
    $cmd_end_timestamp = [System.Math]::Truncate((Get-Date -Date $date_time -UFormat %s))
    Write-Output ""
    Write-Output "__SH__CMD__END__|{`"type`":`"cmd`",`"sequenceNumber`":`"$cmd_end_timestamp`",`"id`":`"$cmd_uuid`",`"exitcode`":`"$cmd_status`"}|$cmd"
    exit $cmd_status
  }
}

# exec_exe executes an exe program and throws a powershell exception if it fails
# $ErrorActionPreference = "Stop" catches only cmdlet exceptions
# Hence exit status of exe programs need to be wrapped and thrown as exception
Function exec_exe([string]$cmd) {
  $global:LASTEXITCODE = 0;
  Invoke-Expression $cmd
  $ret = $LASTEXITCODE
  if ($ret -ne 0) {
    $msg = "$cmd exited with $ret"
    throw $msg
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
  $ssh_dir = Join-Path "$global:HOME" ".ssh"
  $key_file_path = Join-Path "$ssh_dir" "id_rsa"

  if (Test-Path $key_file_path) {
    echo "----> Removing $key_file_path"
    Remove-Item -Force $key_file_path
  }
  [IO.File]::WriteAllLines($key_file_path, $PRIVATE_KEY)
  & $env:OPENSSH_FIX_USER_FILEPERMS

  exec_exe "ssh-agent"
  exec_exe "ssh-add $key_file_path"

  $temp_clone_path = Join-Path "$env:TEMP" "Shippable\syncRepo"

  if (Test-Path $temp_clone_path) {
    echo "----> Removing already existing gitRepo"
    Remove-Item -Recurse -Force $temp_clone_path
  }

  echo "----> Cloning $PROJECT_CLONE_URL"
  exec_exe "git clone $PROJECT_CLONE_URL $temp_clone_path"

  echo "----> Pushing Directory $temp_clone_path"
  pushd $temp_clone_path

  $git_user = Invoke-Expression "git config --get user.name"
  if (-not $git_user) {
    echo "----> Setting git user name"
    exec_exe "git config user.name 'Shippable Build'"
  }

  $git_email = Invoke-Expression "git config --get user.email"
  if (-not $git_email) {
    echo "----> Setting git user email"
    exec_exe "git config user.email 'build@shippable.com'"
  }

  echo "----> Checking out commit SHA"
  if ($IS_PULL_REQUEST) {
    exec_exe "git fetch origin merge-requests/$PULL_REQUEST/head"
    exec_exe "git checkout -f FETCH_HEAD"
    exec_exe "git merge origin/$PULL_REQUEST_BASE_BRANCH"
  } else {
    exec_exe "git checkout $COMMIT_SHA"
  }

  popd

  echo "----> Copying to $PROJECT_CLONE_LOCATION"
  Copy-Item "$temp_clone_path\*" -Destination $PROJECT_CLONE_LOCATION -Recurse -Force

  echo "----> Removing temporary data"
  Remove-Item -Recurse -Force $temp_clone_path
  exec_exe "ssh-add -D"
}

exec_cmd git_sync
