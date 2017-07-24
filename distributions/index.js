'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _nodeNotifier = require('node-notifier');

var _nodeNotifier2 = _interopRequireDefault(_nodeNotifier);

var _through = require('through2');

var _through2 = _interopRequireDefault(_through);

var _tapParser = require('tap-parser');

var _tapParser2 = _interopRequireDefault(_tapParser);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lodash = require('lodash.debounce');

var _lodash2 = _interopRequireDefault(_lodash);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DEFAULT_PASSED_OPTIONS = {
  title: 'Test passed.',
  icon: _path2.default.resolve(__dirname, '../passed.png'),
  sound: false
};

var DEFAULT_FAILED_OPTIONS = {
  title: 'Test failed!',
  icon: _path2.default.resolve(__dirname, '../failed.png'),
  sound: 'Basso'
};

function extractFailureLines(pollutedTap) {
  return [].concat(jsErrorLines(pollutedTap)).concat(tapFailureLines(pollutedTap));
}

// bc stderr has been merged with stdout
// we may not have pure TAP output.
// this will extract syntax or runtime errors
function jsErrorLines(pollutedTap) {
  return pollutedTap.split("\n").filter(function (x) {
    return x.match(jsErrorRegex());
  });
}

function tapFailureLines(pollutedTap) {
  return pollutedTap.split("\n").filter(function (x) {
    return x.match(/^not ok|    at:/);
  }).map(function (x) {
    return x.replace(/^not ok \d+/, '');
  }).map(function (x) {
    return x.replace(/^    at:.*\/([^\/]+)\)/, 'at $1');
  });
}

function jsErrorRegex() {
  return (/^\w+Error:|    at /
  );
}

function getTestsAmount(stdin) {
  var match = stdin.match(/# tests +(\d+)/);
  if (!match) return null;
  var testsAmount = parseInt(match[1], 10);
  return testsAmount;
}

function getPassedTests(stdin) {
  var match = stdin.match(/# pass +(\d+)/);
  if (!match) {
    return 0;
  }
  var testsAmount = parseInt(match[1], 10);
  return testsAmount;
}

function getFailedTests(stdin) {
  var match = stdin.match(/# fail +(\d+)/);
  if (!match) {
    return 0;
  }
  var testsAmount = parseInt(match[1], 10);
  return testsAmount;
}

var createReporter = function createReporter() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      passed = _ref.passed,
      failed = _ref.failed;

  var debouncedNotify = (0, _lodash2.default)(_nodeNotifier2.default.notify.bind(_nodeNotifier2.default), 100);
  var passedOptions = _extends({}, DEFAULT_PASSED_OPTIONS, passed);
  var failedOptions = _extends({}, DEFAULT_FAILED_OPTIONS, failed);
  var p = (0, _tapParser2.default)();
  var stdin = '';
  var stream = (0, _through2.default)(function (chunk, enc, next) {
    stdin += chunk;
    var testsAmount = getTestsAmount(stdin);

    if (testsAmount) {
      var failedTests = getFailedTests(stdin);
      var passedTests = getPassedTests(stdin);
      var failureLines = extractFailureLines(stdin);
      stdin = '';
      if (failedTests > 0) {
        debouncedNotify(_extends({
          message: failedTests + ' of ' + testsAmount + ' tests failed!' + failureLines
        }, failedOptions));
      } else if (passedTests > 0 && testsAmount > 0) {
        debouncedNotify(_extends({
          message: passedTests + ' of ' + testsAmount + ' tests passed!'
        }, passedOptions));
      }
    }
    this.push(chunk);
    next();
  });
  var errorOccuredAt = null;
  stream.pipe(p);

  p.on('assert', function (assert) {
    if (assert.ok) return;

    errorOccuredAt = assert.diag.at;
  });

  p.on('complete', function (result) {
    if (result.ok) {
      debouncedNotify(_extends({
        message: result.pass + ' of ' + result.count + ' tests passed.'
      }, passedOptions));
    } else {
      debouncedNotify(_extends({
        message: (result.fail || 0) + ' of ' + result.count + ' tests failed' + (errorOccuredAt ? ' at ' + errorOccuredAt : '')
      }, failedOptions));
    }
  });

  return stream;
};

exports.default = createReporter;
module.exports = exports['default'];