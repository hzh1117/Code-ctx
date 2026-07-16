function createInitLogger(consoleImpl = console) {
  let verbose = false;

  return {
    setVerbose(value) {
      verbose = !!value;
    },
    isVerbose() {
      return verbose;
    },
    log(...args) {
      consoleImpl.log(...args);
    },
    verbose(...args) {
      if (verbose) consoleImpl.log('[详细]', ...args);
    },
    step(step, ...args) {
      consoleImpl.log(`\n[${step}]`, ...args);
    },
    warn(...args) {
      consoleImpl.warn(...args);
    },
    error(...args) {
      consoleImpl.error(...args);
    }
  };
}

module.exports = { createInitLogger };
