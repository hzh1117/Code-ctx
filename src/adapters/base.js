class BaseAdapter {
  get type() {
    throw new Error('Adapter must implement type getter');
  }

  detect(pkg, files) {
    throw new Error('Adapter must implement detect()');
  }

  get scanPatterns() {
    return [];
  }
}

module.exports = { BaseAdapter };
