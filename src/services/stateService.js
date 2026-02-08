// Armazena o estado em memória (para produção, use Redis ou outro armazenamento persistente)
const state = {};

async function get(key) {
  return state[key] || null;
}

async function set(key, value) {
  state[key] = value;
}

async function del(key) {
  delete state[key];
}

module.exports = { get, set, del };
