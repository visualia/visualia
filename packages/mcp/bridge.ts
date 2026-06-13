/**
 * In-page side of the agent bridge: connects to the dev server's `/__mcp`
 * relay as the board, executes incoming `{id, method, params}` requests
 * against the host app's verbs, and replies `{id, result | error}`.
 *
 * Engine-generic: the host app supplies the verbs (and decides when to
 * connect — typically only in dev builds).
 */

/** What a board app must implement for agents to drive it. */
export interface AgentVerbs {
  /** Whole-board read: nodes, camera, selection — whatever the app exposes. */
  snapshot(): unknown;
  /** Insert a node of a registered kind; returns the created node. */
  insert(type: string, props: Record<string, unknown>): unknown;
  /** Update fields of a node by id; returns the updated node. */
  patch(id: string, props: Record<string, unknown>): unknown;
  /** Delete nodes by id; returns the number actually removed. */
  delete(ids: string[]): number;
  /** Animate the camera to the given nodes (all content when omitted). */
  zoomTo(ids?: string[]): void;
  /** Capture a URL as a screenshot node; returns the node id + element list. */
  capture(url: string): unknown;
  /** Crop a captured node to an element (id / tag / text / rect). */
  crop(nodeId: string, target: unknown): unknown;
  /** Import images from a local folder path or a list of URLs, gridded. */
  import(params: { path?: string; urls?: string[] }): unknown;
  /** Re-lay-out a node set (or the whole board) with a layout strategy. */
  layout(strategy: string, ids: string[] | undefined, params: Record<string, unknown>): unknown;
}

export interface AgentBridgeOptions {
  /** Relay endpoint; defaults to `/__mcp` on the page's own host. */
  url?: string;
}

export function connectAgentBridge(verbs: AgentVerbs, opts: AgentBridgeOptions = {}): void {
  const url = opts.url ?? `ws://${location.host}/__mcp?role=board`;
  const leads = leaderElection();

  let retry = 1000;
  const connect = (): void => {
    const ws = new WebSocket(url);

    ws.onopen = () => {
      retry = 1000;
      console.info('board: agent bridge connected');
    };

    ws.onmessage = (event) => {
      let req: { id?: unknown; method?: unknown; params?: Record<string, unknown> };
      try {
        req = JSON.parse(String(event.data)) as typeof req;
      } catch {
        return;
      }
      if (req.id === undefined || typeof req.method !== 'string') return;
      // requests broadcast to every tab; exactly one (the elected leader)
      // executes, so duplicate tabs never double-run writes
      if (!leads()) return;

      void (async () => {
        try {
          const result = await run(verbs, req.method as string, req.params ?? {});
          ws.send(JSON.stringify({ id: req.id, result }));
        } catch (err) {
          ws.send(JSON.stringify({ id: req.id, error: err instanceof Error ? err.message : String(err) }));
        }
      })();
    };

    ws.onclose = () => {
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, 15000);
    };
  };
  connect();
}

/**
 * One tab per origin answers agent requests: tabs heartbeat a localStorage
 * claim; the claim holder (or anyone, once a claim goes stale or its tab
 * closes) is the leader. Visible tabs steal leadership on focus so the agent
 * talks to the board the user is looking at.
 */
function leaderElection(): () => boolean {
  const KEY = 'board:bridge-leader';
  const TTL = 5000;
  const tabId = Math.random().toString(36).slice(2);

  const claim = (): void => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ id: tabId, t: Date.now() }));
    } catch {
      /* private mode etc. — every tab acts alone */
    }
  };
  const holds = (): boolean => {
    try {
      const raw = localStorage.getItem(KEY);
      const cur = raw ? (JSON.parse(raw) as { id?: string; t?: number }) : null;
      if (!cur || cur.id === tabId || Date.now() - (cur.t ?? 0) > TTL) {
        claim();
        return true;
      }
      return false;
    } catch {
      return true;
    }
  };

  setInterval(() => {
    if (document.visibilityState === 'visible' || holds()) claim();
  }, TTL / 2);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') claim();
  });
  window.addEventListener('beforeunload', () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw && (JSON.parse(raw) as { id?: string }).id === tabId) localStorage.removeItem(KEY);
    } catch {
      /* best effort */
    }
  });

  return holds;
}

function run(verbs: AgentVerbs, method: string, params: Record<string, unknown>): unknown {
  switch (method) {
    case 'snapshot':
      return verbs.snapshot();
    case 'insert':
      return verbs.insert(String(params.type), (params.props as Record<string, unknown>) ?? {});
    case 'patch':
      return verbs.patch(String(params.id), (params.props as Record<string, unknown>) ?? {});
    case 'delete':
      return { deleted: verbs.delete((params.ids as string[]) ?? []) };
    case 'zoom_to':
      verbs.zoomTo(params.ids as string[] | undefined);
      return { ok: true };
    case 'capture':
      return verbs.capture(String(params.url));
    case 'crop':
      return verbs.crop(String(params.nodeId), params.target);
    case 'import':
      return verbs.import({ path: params.path as string | undefined, urls: params.urls as string[] | undefined });
    case 'layout':
      return verbs.layout(
        String(params.strategy),
        params.ids as string[] | undefined,
        (params.params as Record<string, unknown>) ?? {},
      );
    default:
      throw new Error(`unknown method "${method}"`);
  }
}
