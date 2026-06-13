#!/usr/bin/env node
// Stdio MCP server for a live visualia board (plans/mcp.md, option A).
// Relays tool calls over the dev server's /__mcp websocket (the mcpRelay vite
// plugin) to the open board tab, which executes them against the live Board
// API (undoable, sanitized). Requires the dev server running and the board
// open in a browser. Override the relay url with BOARD_WS for other ports.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import WebSocket from 'ws';

const WS_URL = process.env.BOARD_WS ?? 'ws://localhost:5180/__mcp?role=agent';
const RPC_TIMEOUT_MS = 10000;

// -- ws rpc to the board tab -------------------------------------------------

const prefix = Math.random().toString(36).slice(2, 8);
let seq = 0;
let sock = null;
let opening = null;
const pending = new Map();

function open() {
  if (sock?.readyState === WebSocket.OPEN) return Promise.resolve(sock);
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    ws.on('open', () => {
      sock = ws;
      opening = null;
      resolve(ws);
    });
    ws.on('error', (err) => {
      opening = null;
      reject(new Error(`cannot reach the board dev server at ${WS_URL} — run \`npm run dev\` first (${err.message})`));
    });
    ws.on('close', () => {
      if (sock === ws) sock = null;
    });
    ws.on('message', (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      const entry = pending.get(msg.id);
      if (!entry) return; // another agent's reply
      pending.delete(msg.id);
      clearTimeout(entry.timer);
      if (msg.error !== undefined) entry.reject(new Error(String(msg.error)));
      else entry.resolve(msg.result);
    });
  });
  return opening;
}

async function rpc(method, params = {}) {
  const ws = await open();
  const id = `${prefix}-${++seq}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('board tab did not respond — is http://localhost:5180 open in a browser?'));
    }, RPC_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

// -- mcp tools ----------------------------------------------------------------

const server = new McpServer({ name: 'visualia-board', version: '0.1.0' });

const asResult = (data) => ({ content: [{ type: 'text', text: JSON.stringify(data, null, 1) }] });
const asError = (err) => ({
  isError: true,
  content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
});
const call = (method) => async (params) => {
  try {
    return asResult(await rpc(method, params));
  } catch (err) {
    return asError(err);
  }
};

server.registerTool(
  'board_snapshot',
  {
    description:
      'Read the whole board: all nodes (with ids, types, positions, content), camera, current selection and render mode. The read for everything — call before editing.',
    inputSchema: {},
  },
  call('snapshot'),
);

server.registerTool(
  'board_insert',
  {
    description:
      'Insert a node. Position is resolved by the board\'s placement policy (stacks into the selected/nearest frame) unless explicit x/y are given in props. ' +
      'Types and their props: text {content, fontSize?, bold?}, card (a frame) {w?, h?, fill?}, image {src (any host — proxied), w?, h?}, video {src}, three {src (.glb)}, widget {component}. ' +
      'Returns the inserted node with its id and resolved rect.',
    inputSchema: {
      type: z
        .string()
        .describe('a node kind registered by the connected board app — e.g. text, card, image, video, three, widget'),
      props: z.record(z.string(), z.unknown()).optional().describe('node props; x/y/w/h override auto-placement'),
    },
  },
  call('insert'),
);

server.registerTool(
  'board_patch',
  {
    description: 'Update fields of an existing node by id (position, size, content, src, …). Undoable.',
    inputSchema: { id: z.string(), props: z.record(z.string(), z.unknown()) },
  },
  call('patch'),
);

server.registerTool(
  'board_delete',
  {
    description: 'Delete nodes by id. Undoable.',
    inputSchema: { ids: z.array(z.string()) },
  },
  call('delete'),
);

server.registerTool(
  'board_zoom_to',
  {
    description: 'Animate the camera to fit the given node ids, or the whole board when ids is omitted.',
    inputSchema: { ids: z.array(z.string()).optional() },
  },
  call('zoom_to'),
);

server.registerTool(
  'board_capture',
  {
    description:
      'Capture a website as a full-page screenshot node on the board (a headless browser renders the page). ' +
      'The node shows the whole page through a croppable window. Returns the node id and its element list ' +
      '([{id, tag, text}]) — feed those to board_crop to reframe the window to a region.',
    inputSchema: { url: z.string().describe('the page URL to screenshot') },
  },
  call('capture'),
);

server.registerTool(
  'board_crop',
  {
    description:
      'Crop a captured website node in place — reframe its window to one of its elements (or a raw region). ' +
      'target: an element id from board_capture, a tag (e.g. "img"), a text fragment, or {rect:[x,y,w,h]} in source px.',
    inputSchema: {
      nodeId: z.string(),
      target: z.union([z.string(), z.object({ rect: z.array(z.number()).length(4) })]),
    },
  },
  call('crop'),
);

server.registerTool(
  'board_import',
  {
    description:
      'Import images onto the board as a grid. Either `path` — a local folder (or file) under the user\'s home dir, ' +
      'read by the dev sidecar — or `urls` — a list of image URLs (proxied). Returns the inserted node ids.',
    inputSchema: {
      path: z.string().optional().describe('a local folder/file path under $HOME to import images from'),
      urls: z.array(z.string()).optional().describe('image URLs to import'),
    },
  },
  call('import'),
);

await server.connect(new StdioServerTransport());
