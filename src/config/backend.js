const BACKEND_PORT = 3456;
const BACKEND_HOST = window.location.hostname || 'localhost';

export const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;
export const WEBSOCKET_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}`;

export default {
  port: BACKEND_PORT,
  host: BACKEND_HOST,
  url: BACKEND_URL,
  wsUrl: WEBSOCKET_URL,
};
