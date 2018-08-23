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
Function exec_exe([string]$cmd, [string]$error_msg) {
  $global:LASTEXITCODE = 0;
  Invoke-Expression $cmd
  $ret = $LASTEXITCODE
  if ($ret -ne 0) {
    if ($error_msg) {
      $msg = "$cmd exited with $ret `n$error_msg"
    } else {
      $msg = "$cmd exited with $ret"
    }
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
$SHIPPABLE_DEPTH = <%= depth %>
if ($IS_PULL_REQUEST) {
  $BEFORE_COMMIT_SHA = @'
<%=shaData.beforeCommitSha%>
'@
}

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

  $temp_clone_path = Join-Path "$env:TEMP" "Shippable\gitRepo"

  if (Test-Path $temp_clone_path) {
    echo "----> Removing already existing gitRepo"
    Remove-Item -Recurse -Force $temp_clone_path
  }

  <% _.each(gitConfig, function (config) { %>
  echo "----> Setting up gitConfig: <%=config%>"
  exec_exe "git config <%=config%>" "Error while setting up git config: <%=config%>"
  <% }); %>

  echo "----> Cloning $PROJECT_CLONE_URL"
  if ($SHIPPABLE_DEPTH) {
    exec_exe "git clone --depth $SHIPPABLE_DEPTH --no-single-branch $PROJECT_CLONE_URL $temp_clone_path"
  } else {
    exec_exe "git clone $PROJECT_CLONE_URL $temp_clone_path"
  }

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
    if ($SHIPPABLE_DEPTH) {
      exec_exe "git fetch --depth $SHIPPABLE_DEPTH origin pull/$PULL_REQUEST/head"
    } else {
      exec_exe "git fetch origin pull/$PULL_REQUEST/head"
    }
    exec_exe "git checkout -f FETCH_HEAD"
    if ($SHIPPABLE_DEPTH) {
      exec_exe "git merge origin/$PULL_REQUEST_BASE_BRANCH" "The PR was fetched with depth $SHIPPABLE_DEPTH. Please check whether the base commit $BEFORE_COMMIT_SHA is present in the provided depth."
    } else {
      exec_exe "git merge origin/$PULL_REQUEST_BASE_BRANCH"
    }
  } else {
    if ($SHIPPABLE_DEPTH) {
      exec_exe "git checkout $COMMIT_SHA" "The repository was cloned with depth $SHIPPABLE_DEPTH, but the commit $COMMIT_SHA is not present in this depth. Please ensure that the $COMMIT_SHA is present in the provided depth."
    } else {
      exec_exe "git checkout $COMMIT_SHA"
    }
  }

  popd

  echo "----> Copying to $PROJECT_CLONE_LOCATION"
  Copy-Item "$temp_clone_path\*" -Destination $PROJECT_CLONE_LOCATION -Recurse -Force

  echo "----> Removing temporary data"
  Remove-Item -Recurse -Force $temp_clone_path

  exec_exe "ssh-add -D"
}

exec_cmd git_sync
