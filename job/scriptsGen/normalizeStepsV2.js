'use strict';

var self = normalizeStepsV2;
module.exports = self;

function normalizeStepsV2(steps, defaultRuntime) {
  var clonedSteps = _.clone(steps);
  var defaultJobRuntime = _.clone(defaultRuntime) || {};
  var defaultIsContainer = true;
  var defaultContainerOpts = {
    'imageName': 'drydock/u14pytall',
    'imageTag': 'master',
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

      task.execOrder = taskIndex;
      taskIndex += 1;
    }
  );

  return clonedSteps;
}
