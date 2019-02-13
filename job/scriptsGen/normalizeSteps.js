'use strict';

var self = normalizeSteps;
module.exports = self;

var path = require('path');

function normalizeSteps(yml, buildJobId, buildScriptsDir, buildStatusDir,
  group, runtimeTemplate) {
  var clonedSteps = _.clone(yml.steps);
  clonedSteps = _convertOldFormatStepsToNew(clonedSteps);
  clonedSteps = _normalizeNewFormatSteps(clonedSteps, yml.runtime,
    __convertOldFormatTerminalGroupToNew(yml.on_success),
    __convertOldFormatTerminalGroupToNew(yml.on_failure),
    __convertOldFormatTerminalGroupToNew(yml.always), buildJobId,
    buildScriptsDir, buildStatusDir, group, runtimeTemplate
  );

  return clonedSteps;
}

function _convertOldFormatStepsToNew(steps) {
  _.each(steps,
    function (step) {
      if (!step.TASK)
        return;

      // if TASK is in old format convert it to new format
      if (_.isArray(step.TASK)) {
        var newTask = {
          script: []
        };
        _.each(step.TASK,
          function (oldTask) {
            if (oldTask.script)
              newTask.script.push(oldTask.script);
          }
        );
        step.TASK = newTask;
      }
    }
  );

  return steps;
}

function _normalizeNewFormatSteps(steps, defaultRuntime, onSuccess,
  onFailure, always, buildJobId, buildScriptsDir, buildStatusDir, group,
  runtimeTemplate) {
  var clonedSteps = _.clone(steps);
  // This is the top-level defaults defined in the job.
  var defaultJobRuntime = _.clone(defaultRuntime) || {};

  // TODO: Handle defaults in rSync.
  // Assume the default is container first. Override based on priority next.
  var defaultIsContainer = true;
  if (_.isBoolean(defaultJobRuntime.container))
    defaultIsContainer = defaultJobRuntime.container;
  else if (global.config.shippableNodeOperatingSystem === 'macOS_10.12')
    defaultIsContainer = false;

  // Default image.
  var imageName =  util.format('%s/%s', runtimeTemplate.drydockOrg,
    runtimeTemplate.defaultTaskImage);
  var imageTag = runtimeTemplate.drydockTag;
  // use 6.2.4 tag for all 'microbase' taks images.
  // otherwise use the drydockTag
  if (runtimeTemplate.defaultTaskImage === 'microbase')
    imageTag = 'v6.2.4';
  // Default options for container tasks.
  var defaultContainerOpts = {
    imageName: imageName,
    imageTag: imageTag,
    pull: true,
    options: util.format('%s %s',
      global.config.defaultTaskContainerOptions,
      global.config.defaultTaskContainerMounts),
    env: {}
  };

  // TODO: Add proxy support for Windows, macOS later.
  if (!_.contains(['WindowsServer_2016', 'macOS_10.12'],
    global.config.shippableNodeOperatingSystem
  )) {
    if (process.env.http_proxy)
      defaultContainerOpts.options = util.format('%s -e http_proxy=%s',
        defaultContainerOpts.options, process.env.http_proxy);

    if (process.env.https_proxy)
      defaultContainerOpts.options = util.format('%s -e https_proxy=%s',
        defaultContainerOpts.options, process.env.https_proxy);

    if (process.env.no_proxy)
      defaultContainerOpts.options = util.format('%s -e no_proxy=%s',
        defaultContainerOpts.options, process.env.no_proxy);
  }

  // Default options for hosts tasks.
  var defaultHostOpts = {
    env: {}
  };

  var lastTask;
  var taskIndex = 0;
  _.each(clonedSteps,
    function (step) {
      if (!step.TASK) return;
      if (!step.TASK.script) return;

      var task = step.TASK;

      // Normalize a string script into an array.
      if (_.isString(task.script))
        task.script = [task.script];

      task.runtime = task.runtime || {};

      // Use the default task runtime if it is not specified.
      if (_.isUndefined(task.runtime.container))
        task.runtime.container = defaultIsContainer;

      if (task.runtime.container) {
        if (_.isUndefined(task.runtime.options))
          task.runtime.options = {};

        // If an imageName is not specified, set both imageName and imageTag.
        // We cannot rely on the the imageTag given in the YML if we use
        // the default image.
        if (_.isEmpty(task.runtime.options.imageName)) {
          task.runtime.options.imageName = defaultContainerOpts.imageName;
          task.runtime.options.imageTag = defaultContainerOpts.imageTag;
        }

        if (_.isEmpty(task.runtime.options.imageTag))
          task.runtime.options.imageTag = 'latest';

        if (!_.isBoolean(task.runtime.options.pull))
          task.runtime.options.pull = defaultContainerOpts.pull;

        if (_.isEmpty(task.runtime.options.options))
          task.runtime.options.options = '';
        // Apply the container opts _after_ the user defined ones, so our
        // options do not get overwritten.
        task.runtime.options.options = util.format('%s %s',
           task.runtime.options.options,
           defaultContainerOpts.options).trim();

        if (_.isEmpty(task.runtime.options.env))
          task.runtime.options.env = _.clone(defaultContainerOpts.env);
      } else {
        if (_.isEmpty(task.runtime.options))
          task.runtime.options = _.clone(defaultHostOpts);
        if (_.isEmpty(task.runtime.options.env))
          task.runtime.options.env = _.clone(defaultHostOpts.env);
      }

      // Add a name if its not specified.
      if (_.isUndefined(task.name))
        task.name = 'Task ' + taskIndex;
      task.taskIndex = taskIndex;
      taskIndex += 1;

      // Always add always and onFailure sections to tasks as they need
      // to run if the task fails.
      task.always = always;
      task.onFailure = onFailure;

      __generateRuntimeInfo(task, buildJobId, buildScriptsDir, buildStatusDir,
        group);
      task.runtime.options.env = __normalizeEnvs(task.runtime.options.env);

      // Keep track of the lastTask for adding onSuccess.
      lastTask = task;
    }
  );

  // onSuccess can only happen in the last task
  if (lastTask)
    lastTask.onSuccess = onSuccess;

  return clonedSteps;
}

function __generateRuntimeInfo(task, buildJobId, buildScriptsDir,
  buildStatusDir, group) {
  var defaultENVs = {
    shippableNodeArchitecture: global.config.shippableNodeArchitecture,
    shippableNodeOperatingSystem: global.config.shippableNodeOperatingSystem,
    isRestrictedNode: global.config.isRestrictedNode
  };
  var taskEnvs = _.extend({}, defaultENVs);
  _.extend(taskEnvs, {
    taskName: task.name || util.format('task_%s', task.taskIndex),
    isTaskInContainer: task.runtime.container
  });
  task.taskScriptFileName = util.format('%s_task_%s.%s', group,
    task.taskIndex, global.config.scriptExtension);
  if (task.runtime.container) {
    var containerName =  util.format('reqExec.%s.%s', buildJobId,
      task.taskIndex);
    task.runtime.options.options = util.format('%s --name %s',
      task.runtime.options.options, containerName);
    task.bootScriptFileName = util.format('%s_boot_%s.%s', group,
      task.taskIndex, global.config.scriptExtension);
    task.buildScriptFileName = util.format('build.%s',
      global.config.scriptExtension);
    task.killContainerScriptFileName = util.format('%s_kill_%s.%s', group,
      task.taskIndex, global.config.scriptExtension);
    // sets container task envs
    var taskContainerEnvs = {
      taskContainerOptions: task.runtime.options.options,
      taskContainerImage: util.format('%s:%s',
        task.runtime.options.imageName, task.runtime.options.imageTag),
      shouldPullTaskContainerImage: task.runtime.options.pull,
      taskContainerCommand: util.format('%s %s %s',
        path.join(buildScriptsDir, task.buildScriptFileName),
        path.join(buildScriptsDir, task.taskScriptFileName),
        path.join(buildStatusDir, 'job.env')
      ),
      taskContainerName: containerName,
      shippableDindImage: global.config.shippableDindImage,
      shippableDindContainerName: global.config.shippableDindContainerName
    };

    // Windows expects powershell scripts to be called with
    // powershell.exe explicitly
    if (global.config.shippableNodeOperatingSystem === 'WindowsServer_2016')
      taskContainerEnvs.taskContainerCommand = util.format('powershell.exe %s',
        taskContainerEnvs.taskContainerCommand);

    _.extend(taskEnvs, taskContainerEnvs);
  }
  task.shippableRuntimeEnvs = taskEnvs;
  task.group = group;
}

function __convertOldFormatTerminalGroupToNew(terminalGroup) {
  var clonedTerminalGroup = _.clone(terminalGroup);
  var newTerminalGroup = {
    script: []
  };

  // If the group is not defined, return the default group.
  if (_.isEmpty(clonedTerminalGroup))
    return newTerminalGroup;
  // If the group is of array type (old), convert it into object.
  else if (_.isArray(clonedTerminalGroup))
    _.each(clonedTerminalGroup,
      function (section) {
        if (section.script)
          newTerminalGroup.script.push(section.script);
      }
    );
  // If the group is of object type (new), convert any string script to array.
  else if (_.isObject(terminalGroup))
    if (_.isString(clonedTerminalGroup.script))
      newTerminalGroup.script.push(clonedTerminalGroup.script);
    else if(_.isArray(clonedTerminalGroup.script))
      _.each(clonedTerminalGroup.script,
        function (script) {
          newTerminalGroup.script.push(script);
        }
      );

  return newTerminalGroup;
}


function __normalizeEnvs(envs) {
  var clonedEnvs = _.clone(envs);
  var escapedEnvs = [];
  if (_.isArray(clonedEnvs)) {
    var envObject = {};
    _.each(clonedEnvs,
      function (clonedEnvObjects) {
        _.each(clonedEnvObjects,
          function (value, key) {
            var envJson = {};
            envJson[key] = value;
            envObject = _.extend(envObject, envJson);
          }
        );
      }
    );
    clonedEnvs = envObject;
  }
  _.each(clonedEnvs,
    function (value, key) {
      value = ___escapeEnvironmentVariable(value);
      escapedEnvs.push({
        key: key.replace(/[^A-Za-z0-9_]/g, ''),
        value: value
      });
    }
  );
  return escapedEnvs;
}

function ___escapeEnvironmentVariable(value) {
  // TODO: move escaping logic to respective execTemplates
  if (global.config.shippableNodeOperatingSystem === 'WindowsServer_2016')
    return value;
  if (!value || !_.isString(value)) return value;

  var specialCharacters = ['\\\\', '\\\"', '\\\`', '\\\$'];

  _.each(specialCharacters,
    function (specialChar) {
      var regex = new RegExp(specialChar, 'g');
      value = value.replace(regex, specialChar);
    }
  );

  return value;
}
