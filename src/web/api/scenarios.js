const express = require('express');
const { clearSectionsCache } = require('./helpers');
const registerScenarioCrud = require('./handlers/scenario-crud');
const registerStatus = require('./handlers/status');
const registerHistory = require('./handlers/history');
const registerDoctor = require('./handlers/doctor');
const registerDocs = require('./handlers/docs');
const registerUpdate = require('./handlers/update');
const registerGeneratePrompt = require('./handlers/generate-prompt');

module.exports = function (rootDir) {
  const router = express.Router();
  registerScenarioCrud(router, rootDir);
  registerStatus(router, rootDir);
  registerHistory(router, rootDir);
  registerDoctor(router, rootDir);
  registerDocs(router, rootDir);
  registerUpdate(router, rootDir);
  registerGeneratePrompt(router, rootDir);
  return router;
};

// 保留 _clearSectionsCache 以兼容现有测试
module.exports._clearSectionsCache = clearSectionsCache;
