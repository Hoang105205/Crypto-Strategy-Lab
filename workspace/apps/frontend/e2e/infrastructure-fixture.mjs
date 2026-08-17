import { createServer } from 'node:http';
import { Server } from 'socket.io';

const port = 3201;
const httpServer = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok');
    return;
  }
  response.writeHead(404);
  response.end();
});

const io = new Server(httpServer, {
  cors: { origin: '*' },
  transports: ['websocket'],
});

io.of('/infrastructure').on('connection', () => {
  // The E2E browser only needs a real namespace lifecycle; REST is route-mocked.
});

httpServer.listen(port, '127.0.0.1');
