const path = require("path");
const { handleRequest } = require("../handler");

module.exports = (req, res) => {
  handleRequest(req, res, path.resolve(__dirname, ".."));
};
