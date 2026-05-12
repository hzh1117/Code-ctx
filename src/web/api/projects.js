const express = require('express');
const { detectProjects } = require('../../scanner/project-detector');

module.exports = function (rootDir) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const projects = detectProjects(rootDir);
    res.json(projects);
  });

  return router;
};
