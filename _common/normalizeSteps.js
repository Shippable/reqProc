'use strict';

var self = normalizeSteps;
module.exports = self;

function normalizeSteps(payload) {
  _.each(payload.propertyBag.yml.steps,
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

  return payload;
}
