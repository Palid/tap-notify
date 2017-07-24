import notifier from 'node-notifier';
import through2 from 'through2';
import parser from 'tap-parser';
import path from 'path';
import debounce from 'lodash.debounce';

const DEFAULT_PASSED_OPTIONS = {
  title: 'Test passed.',
  icon: path.resolve(__dirname, '../passed.png'),
  sound: false,
};

const DEFAULT_FAILED_OPTIONS = {
  title: 'Test failed!',
  icon: path.resolve(__dirname, '../failed.png'),
  sound: 'Basso',
};

function extractFailureLines(pollutedTap) {
  return [].concat(jsErrorLines(pollutedTap))
    .concat(tapFailureLines(pollutedTap));
}

// bc stderr has been merged with stdout
// we may not have pure TAP output.
// this will extract syntax or runtime errors
function jsErrorLines(pollutedTap) {
  return pollutedTap.split("\n").filter(x => x.match(jsErrorRegex()));
}

function tapFailureLines(pollutedTap) {
  return pollutedTap
    .split("\n")
    .filter(x => x.match(/^not ok|    at:/))
    .map(x => x.replace(/^not ok \d+/, ''))
    .map(x => x.replace(/^    at:.*\/([^\/]+)\)/, 'at $1'))
}

function jsErrorRegex() {
  return /^\w+Error:|    at /
}

function getTestsAmount(stdin) {
  const match = stdin.match(/# tests +(\d+)/);
  if (!match) return null;
  const testsAmount = parseInt(match[1], 10);
  return testsAmount;
}

function getPassedTests(stdin) {
  const match = stdin.match(/# pass +(\d+)/);
  if (!match) {
    return 0;
  }
  const testsAmount = parseInt(match[1], 10);
  return testsAmount;
}

function getFailedTests(stdin) {
  const match = stdin.match(/# fail +(\d+)/);
  if (!match) {
    return 0;
  }
  const testsAmount = parseInt(match[1], 10);
  return testsAmount;
}

const createReporter = ({
  passed,
  failed
} = {}) => {
  const debouncedNotify = debounce(notifier.notify.bind(notifier), 100);
  const passedOptions = Object.assign({}, DEFAULT_PASSED_OPTIONS, passed);
  const failedOptions = Object.assign({}, DEFAULT_FAILED_OPTIONS, failed);
  const p = parser();
  let stdin = '';
  const stream = through2(function(chunk, enc, next) {
    stdin += chunk;
    const testsAmount = getTestsAmount(stdin);

    if (testsAmount) {
      const failedTests = getFailedTests(stdin);
      const passedTests = getPassedTests(stdin);
      const failureLines = extractFailureLines(stdin);
      stdin = '';
      if (failedTests > 0) {
        debouncedNotify(Object.assign({
          message: `${failedTests} of ${testsAmount} tests failed!` + failureLines
        }, failedOptions));
      } else if (passedTests > 0 && testsAmount > 0){
        debouncedNotify(Object.assign({
          message: `${passedTests} of ${testsAmount} tests passed!`,
        }, passedOptions));
      }
    }
    this.push(chunk);
    next();
  });
  let errorOccuredAt = null;
  stream.pipe(p);

  p.on('assert', assert => {
    if (assert.ok) return;

    errorOccuredAt = assert.diag.at
  });

  p.on('complete', result => {
    if (result.ok) {
      debouncedNotify(Object.assign({
        message: `${result.pass} of ${result.count} tests passed.`,
      }, passedOptions));
    } else {
      debouncedNotify(Object.assign({
        message: `${result.fail || 0} of ${result.count} tests failed` +
          (errorOccuredAt ? ` at ${errorOccuredAt}` : ''),
      }, failedOptions));
    }
  });

  return stream;
};

export default createReporter;
