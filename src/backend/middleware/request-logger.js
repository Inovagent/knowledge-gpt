const { log } = require("../lib/logger");

function requestLogger(req, res, next) {
  log("API", `${req.method} ${req.url}`);
  next();
}

module.exports = {
  requestLogger
};
