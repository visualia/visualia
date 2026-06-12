import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Plugin } from 'vite';
import { WebSocketServer, type WebSocket } from 'ws';

/**
 * Dev-server relay between the live board tab and MCP server processes
 * (plans/mcp.md, option A). Agents connect as `?role=agent` and send
 * `{id, method, params}`; requests broadcast to every `?role=board` tab, but
 * only visible tabs execute (the bridge ignores requests while hidden), so
 * background/preview duplicates don't answer with stale docs. Replies fan out
 * to all agents (each filters by its own request ids and takes the first).
 */
export function mcpRelay(path = '/__mcp'): Plugin {
  return {
    name: 'visualia-mcp-relay',
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });
      const boards = new Set<WebSocket>();
      const agents = new Set<WebSocket>();

      server.httpServer?.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        if (!req.url?.startsWith(path)) return; // leave HMR & others alone
        wss.handleUpgrade(req, socket, head, (sock) => wss.emit('connection', sock, req));
      });

      wss.on('connection', (sock: WebSocket, req: IncomingMessage) => {
        const role = new URL(req.url ?? '', 'http://x').searchParams.get('role');
        if (role === 'board') {
          boards.add(sock);
          sock.on('close', () => boards.delete(sock));
          // board replies/events fan out to every connected agent
          sock.on('message', (data) => {
            const s = String(data);
            for (const a of agents) if (a.readyState === a.OPEN) a.send(s);
          });
        } else {
          agents.add(sock);
          sock.on('close', () => agents.delete(sock));
          sock.on('message', (data) => {
            const s = String(data);
            let sent = 0;
            for (const b of boards) {
              if (b.readyState === b.OPEN) {
                b.send(s);
                sent++;
              }
            }
            if (!sent) {
              // fail fast so agents don't hang on a closed tab
              try {
                const { id } = JSON.parse(s) as { id?: unknown };
                sock.send(JSON.stringify({ id, error: 'board tab not connected — open the board in a browser first' }));
              } catch {
                /* not a request */
              }
            }
          });
        }
      });
    },
  };
}
