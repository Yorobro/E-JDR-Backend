const cleanArchitecture = require("./rules/clean-architecture");
const fileSize = require("./rules/file-size");
const functionSize = require("./rules/function-size");
const parameterCount = require("./rules/parameter-count");
const namingConvention = require("./rules/naming-convention");

const plugin = {
  rules: {
    "clean-architecture": cleanArchitecture,
    "file-size": fileSize,
    "function-size": functionSize,
    "parameter-count": parameterCount,
    "naming-convention": namingConvention,
  },
};

export = plugin;
