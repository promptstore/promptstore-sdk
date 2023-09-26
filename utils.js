
const isEmpty = (value) => {
  if (Array.isArray(value)) {
    return !value.length;
  }
  if (isObject(value)) {
    return !Object.keys(value).length;
  }
  if (typeof value === 'string') {
    return value === '';
  }
  return value === null || typeof value === 'undefined';
};

const isObject = (value) => {
  const type = typeof value;
  return value != null && (type === 'object' || type === 'function');
};

const stripEmpty = (obj) => {
  const inner = (val) => {
    if (Array.isArray(val)) {
      if (val.length) {
        const arr = val.map(inner).filter((x) => x !== null);
        if (arr.length) {
          return arr;
        }
      }
    } else if (isObject(val)) {
      const obj = Object.entries(val).reduce((a, [k, v]) => {
        const value = inner(v);
        if (value !== null) {
          a[k] = value;
        }
        return a;
      }, {});
      if (!isEmpty(obj)) {
        return obj;
      }
    } else {
      if (val !== null && typeof val !== 'undefined' && val !== '') {
        return val;
      }
    }
    return null;
  };

  return inner(obj);
};

module.exports = {
  isEmpty,
  isObject,
  stripEmpty,
};