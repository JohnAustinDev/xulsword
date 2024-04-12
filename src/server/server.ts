import { Server } from 'socket.io';

const server = require('http').createServer();

const io = new Server(server);
io.listen(3000);
