function traverseNatives(object, seen, idToNative, nativeToId) {
  if (object === undefined || object === null || seen.has(object)) {
    return;
  }
  seen.add(object);
  if (typeof object === 'function') {
    const id = seen.size.toString();
    idToNative.set(id, object);
    nativeToId.set(object, id);
  }
  for (const {value} of Object.values(Object.getOwnPropertyDescriptors(object))) {
    traverseNatives(value, seen, idToNative, nativeToId);
  }
}

const idToNative = new Map();
const nativeToId = new Map();
traverseNatives(globalThis, new Set(), idToNative, nativeToId);

const formats = [
  {
    matches: (object) => object === undefined,
    kind: 'undefined',
    ser: (object) => 'undefined',
    de: (value, evil) => undefined,
  },
  {
    matches: (o) => o === null || ['number', 'string', 'boolean'].includes(typeof o),
    kind: 'leaf',
    ser: (object) => object,
    de: (value, evil) => value,
  },
  {
    matches: (object) => typeof object === 'function',
    kind: 'function',
    ser: (object) => {
      if (nativeToId.has(object)) {
        return {scope: 'native', value: nativeToId.get(object)};
      }
      return {scope: 'defined', value: object.toString()};
    },
    de: ({scope, value}, evil) => {
      if (scope === 'native') {
        return idToNative.get(value);
      }
      if (scope === 'defined') {
        return evil(`(${value})`);
      }
    },
  },
  {
    matches: (object) => object instanceof Date,
    kind: 'date',
    ser: (object) => object.toISOString(),
    de: (value, evil) => new Date(value),
  },
  {
    matches: (object) => object instanceof Error,
    kind: 'error',
    ser: (object) => object.message,
    de: (value, evil) => new Error(value),
  },
];

function serialize(object) {
  let idState = 0;
  const objectToReference = new Map();
  const idToObject = new Map();
  const encode = (object) => {
    for (const {matches, kind, ser, de} of formats) {
      if (matches(object)) {
        return {kind, value: ser(object)};
      }
    }
    if (objectToReference.has(object)) {
      return objectToReference.get(object);
    }
    const id = idState++;
    const kind = object instanceof Array ? 'array' : 'object';
    const reference = {kind: 'reference', value: id};
    objectToReference.set(object, reference);
    const represented = kind === 'array' ?
            {kind, value: object.map(encode)} :
            {kind, value: Object.fromEntries(Object.entries(object).map(([k, v]) => [k, encode(v)]))};
    idToObject.set(id.toString(), represented);
    return reference;
  };
  const root = encode(object);
  return JSON.stringify({
    idToObject: Object.fromEntries(idToObject),
    root,
  });
}

function deserialize(string, evilMaybe) {
    let evil = evilMaybe || eval;
  const {idToObject, root} = JSON.parse(string);
  const cannonical = new Map();
  const decode = ({kind, value}) => {
    for (const {matches, kind: k, ser, de} of formats) {
      if (k === kind) {
        return de(value, evil);
      }
    }
    if (kind === 'reference') {
      if (!cannonical.has(value)) {
        const referenceKind = idToObject[value].kind;
        const newObject = referenceKind === 'array' ? [] : {};
        // add the object to the map before we call decode
        cannonical.set(value, newObject);
        const decoding = decode(idToObject[value]);
        return Object.assign(newObject, decoding);
      }
      return cannonical.get(value);
    }
    if (kind === 'array') {
      return value.map(decode);
    }
    if (kind === 'object') {
      return Object.fromEntries(Object.entries(value).map(([s, v]) => [s, decode(v)]));
    }
  };
  return decode(root);
}

module.exports = {
  serialize: serialize,
  deserialize: deserialize,
};

