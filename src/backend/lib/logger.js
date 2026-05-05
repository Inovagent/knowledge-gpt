function log(scope, message, details) {
  if (details === undefined) {
    console.log(`[${scope}] ${message}`);
    return;
  }

  console.log(`[${scope}] ${message}`, details);
}

function error(scope, message, details) {
  if (details === undefined) {
    console.error(`[${scope}] ${message}`);
    return;
  }

  console.error(`[${scope}] ${message}`, details);
}

module.exports = {
  log,
  error
};
