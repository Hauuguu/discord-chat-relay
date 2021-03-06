const { sysmsg } = require('tera-data-parser');

sysmsg.load(require.resolve('tera-data'));

const map = new WeakMap();
const known = new Set();

for (const sysmsgs of sysmsg.maps.values()) {
  for (const name of sysmsgs.name.keys()) {
    known.add(name);
  }
}

function parseSysmsg(str) {
  if (!str.startsWith('@')) {
    return null;
  }

  const [id, ...args] = str.slice(1).split('\x0B');
  const params = {};
  while (args.length > 0) {
    params[args.shift()] = args.shift();
  }

  return { id, params };
}

class Sysmsg {
  constructor(dispatch) {
    const { base } = dispatch;

    this.base = base;
    this.sysmsgs = sysmsg;

    if (!map.has(base)) {
      map.set(base, {});

      dispatch.hook('S_SYSTEM_MESSAGE', 1, (event) => {
        const data = parseSysmsg(event.message);
        if (!data) {
          return;
        }

        const msgmap = sysmsg.maps.get(base.protocolVersion);
        if (!msgmap) {
          return;
        }

        const name = msgmap.code.get(parseInt(data.id, 10));
        if (!name) {
          return;
        }

        const hooks = map.get(base)[name];
        if (!hooks) {
          return;
        }

        for (const hook of hooks) {
          const result = hook(data.params);

          // TODO handle other cases
          if (result === false) {
            return false;
          }
        }
      });
    }
  }

  static parse(...args) {
    return parseSysmsg(...args);
  }

  parse(...args) {
    return Sysmsg.parse(...args);
  }

  on(msg, cb) {
    if (msg.indexOf('_') === -1) {
      // WARNING: NUMBERS ARE AMBIGUOUS.
      // Proper sysmsg name case is preferred.
      msg = msg.replace(/[A-Z]/g, '_$&').toUpperCase();
    }

    if (!known.has(msg)) {
      console.warn(`[sysmsg] Unknown system message "${msg}"`);
      return;
    }

    const hooks = map.get(this.base);
    if (!hooks[msg]) {
      hooks[msg] = [];
    }
    hooks[msg].push(cb);
  }
}

module.exports = Sysmsg;
