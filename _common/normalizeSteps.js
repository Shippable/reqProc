'use strict';

var self = normalizeSteps;
module.exports = self;

function normalizeSteps(steps) {
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
