'use strict';

var self = normalizeStepsV2;
module.exports = self;

function normalizeStepsV2(steps) {
  _.each(steps,
    function (step) {
      if (!step.TASK) return;
      if (!step.TASK.script) return;

      // if script is not an array, then add it to an array
      if (typeof step.TASK.script === 'string')
        step.TASK.script = [step.TASK.script];
    }
  );

  return steps;
}
