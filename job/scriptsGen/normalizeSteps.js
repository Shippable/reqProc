'use strict';

var self = normalizeSteps;
module.exports = self;

function normalizeSteps(steps, defaultRuntime) {
  var clonedSteps = _.clone(steps);
  clonedSteps = _convertOldFormatStepsToNew(clonedSteps);
  clonedSteps = _normalizeNewFormatSteps(clonedSteps, defaultRuntime);

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

function _normalizeNewFormatSteps(steps, defaultRuntime) {
  var clonedSteps = _.clone(steps);
  var defaultJobRuntime = _.clone(defaultRuntime) || {};
  var defaultIsContainer = true;
  // TODO: This needs to be OS/Arch specific.
  var defaultContainerOpts = {
    'imageName': 'drydock/microbase',
    'imageTag': 'latest',
    'pull': true,
    'options': '',
    'envs': {}
  };
  var defaultHostOpts = {
    'envs': {}
  };

  if (defaultJobRuntime.container === false)
    defaultIsContainer = false;
  if (defaultJobRuntime.container)
    _.extend(defaultContainerOpts, defaultJobRuntime.options);
  else
    _.extend(defaultHostOpts, defaultJobRuntime.options);

  var taskIndex = 0;
  _.each(clonedSteps,
    function (step) {
      if (!step.TASK) return;
      if (!step.TASK.script) return;

      var task = step.TASK;
      if (_.isString(task.script))
        task.script = [task.script];

      task.runtime = task.runtime || {};
      if (_.isUndefined(task.runtime.container))
        task.runtime.container = defaultIsContainer;

      task.runtime.options = task.runtime.options || {};
      if (task.runtime.container)
        task.runtime.options =
          _.extend(_.clone(defaultContainerOpts), task.runtime.options);
      else
        task.runtime.options =
          _.extend(_.clone(defaultHostOpts), task.runtime.options);

      if (_.isUndefined(task.name))
        task.name = 'Task ' + taskIndex;

      task.taskIndex = taskIndex;
      taskIndex += 1;
    }
  );

  return clonedSteps;
}
