# Compute pools: who else shares machines for AI work

Researched 2026-11-14, web only, nothing installed or run. READ means a page says it (linked). INFERRED means I
concluded it. Numbers are what the page said on the day.

**Verdict.** Nobody else runs what `plans/pool.md` describes: one class, whole jobs, outbound sockets only, nothing
about a job kept, no asker identity at the worker. The closest is **AI Horde** (whole jobs, workers poll out, prompts
held in memory only), but it is public and strangers serve. Browser swarms (SwarmLLM, pooled) are rooms of trusted
devices that split one model. Paid markets rent containers and trust the host contract or crypto stakes. Nothing built
for classrooms pools student machines. The pool's choices hold up. Three things are worth taking: a quick hardware
check before a worker gets jobs (Salad, io.net), occasional duplicate jobs to catch a junk worker (BOINC), and a
"trusted workers only" route, which `only: 'mine'` already is.

## 1. MutualGPU

- **What it says:** on the TripoSplat page, "Qualified Chrome devices can receive one remote requestor's TripoSplat
  assignment at a time"; MutualGPU mode "uploads the selected image to the exchange and assigned provider"; tasks are
  tied to "this browser's anonymous MutualGPU requestor cookie"; a sleeping tab "interrupts the WebGPU provider
  connection". On the day: "MutualGPU is online, but no TripoSplat provider is currently enrolled." READ
  ([page](https://triposplat-webgpu.vercel.app/e2e-web)).
- **Who:** a project of Yosun Chang (AIMagical), listed on Devpost as "MutualGPU uses NetCats fibers to pool idle GPUs,
  bringing shared AI compute to the 99%". READ, search snippet only, Devpost answered 403
  ([portfolio](https://devpost.com/yosun)). Hugging Face models sit under
  [Yosun/TripoSplat-WebGPU](https://huggingface.co/Yosun/TripoSplat-WebGPU/).
- **Provider:** a Chrome tab with WebGPU, which downloads the same 6.5 GB model cache. READ (page). Browser, not native.
- **Code:** the exchange is not in [ai3d-dev/TripoSplatWebGPU](https://github.com/ai3d-dev/TripoSplatWebGPU) (4 stars,
  MIT); its API docs describe local runs only. READ.
- **Could not establish:** how providers are matched, who runs the exchange server, what it keeps, whether there is
  payment (the page names none), what "NetCats fibers" is. INFERRED: a hackathon-stage exchange, one job per tab,
  anonymous cookie on the asking side.

## 2. Volunteer AI compute

- **AI Horde** (Stable Horde, KoboldAI Horde). Run by Haidra, "a volunteer-run, registered non-profit in Luxembourg".
  Workers poll the server with `POST /v2/generate/pop`, declaring what they can do on each poll. Kudos set queue
  priority and "cannot be bought or sold"; everyone is served. READ ([repo](https://github.com/Haidra-Org/AI-Horde),
  [workers](https://aihorde.net/contribute/workers/)). Workers get no requester ID or IP, but their operators can see
  prompts and images; prompts and results live in memory and are deleted after delivery; "Trusted Workers Only" limits
  jobs to people who ran a worker a week and earned enough kudos. READ, search summary of
  [aihorde.net docs](https://aihorde.net/faq/). Native workers (Python, ComfyUI, KoboldCpp), image and text models.
  Alive: commits 2026-11-13; 27 image and 56 text workers, 30,435 tokens in the past minute. READ
  ([status](https://stablehorde.net/api/v2/status/performance)).
- **Petals.** Splits a big model's layers over volunteers. "Your data will be processed with the help of other people in
  the public swarm"; private swarms possible. READ ([repo](https://github.com/bigscience-workshop/petals)). Last commit
  2024-08-25, so effectively stopped. READ
  ([commits](https://api.github.com/repos/bigscience-workshop/petals/commits)).
- **Browser swarms.** [SwarmLLM](https://github.com/dojime/swarmllm) and [pooled](https://github.com/Nehanth/pooled)
  (647 stars, MIT): devices in a room each run a slice of a 27B to 35B model in WebGPU, passing 4 to 10 KB hidden states
  over WebRTC; signalling only on a server; "hidden states aren't private against determined peers", meant for trusted
  groups. READ. [AI Grid](https://webgpu.com/showcase/browser-ai-llms-share-gpu-compute/) (Ryan Smith, WebLLM tabs that
  donate or borrow) gives no routing or privacy details. READ.

## 3. Local clusters and LAN pooling

- **exo.** Devices with the same cluster name find each other on the network and split one model by tensor parallelism;
  Apple Silicon first, Linux CPU. v1.0.71, 2026-04-23; 48.4k stars. READ
  ([repo](https://github.com/exo-explore/exo), [releases](https://api.github.com/repos/exo-explore/exo/releases)). No
  authentication described. READ.
- **llama.cpp RPC.** Offloads layers to remote `rpc-server`s; "fragile and insecure. Never run the RPC server on an open
  network". READ ([README](https://github.com/ggml-org/llama.cpp/blob/master/tools/rpc/README.md)).
- **distributed-llama.** One root plus 2^n - 1 workers on port 9999, Ethernet, tensor parallel. 3.1k stars. READ
  ([repo](https://github.com/b4rtaz/distributed-llama)).
- **Ollama pools.** Ollama has no built-in pooling; people put a load balancer in front.
  [Ollama Herd](https://ollamaherd.com/) (MIT, v0.12.3) finds nodes by mDNS and scores eight signals including "model
  load state" and "memory fit". READ. All inbound on the LAN.
- **LocalAI federation.** libp2p and EdgeVPN with a shared token; federated mode routes whole requests, worker mode
  shards llama.cpp models; one model per cluster. READ ([docs](https://localai.io/docs/features/distribute/)).
- **GPUStack.** Cluster manager for vLLM and SGLang; Linux workers join with a server URL and token, in Docker. v2.3.1,
  2026-11-11. READ ([repo](https://github.com/gpustack/gpustack),
  [releases](https://api.github.com/repos/gpustack/gpustack/releases)).
- **Kalavai.** Seed node plus Linux or Windows workers in Docker, vLLM, llama.cpp, Ray. 225 stars. READ
  ([repo](https://github.com/kalavai-net/kalavai-client)).

## 4. Paid GPU markets

- **Salad** (no crypto). Home "Chefs" run a desktop app, paid in Salad Balance for PayPal or gift cards; 16,000+ daily
  GPUs; from $0.015 per GPU hour; every device benchmarked before admission and scored continuously; workloads in a VM
  behind a hypervisor. READ ([salad.com](https://salad.com/)).
- **Vast.ai** (no crypto, Stripe, PayPal, Wise). On community and verified hosts the host "retains Docker host access"
  and can inspect containers; "Secure Cloud" means ISO 27001 data centres. READ, the first via a
  [2026 review](https://fast.io/resources/vast-ai-review-2026/), the second in
  [Vast's security FAQ](https://docs.vast.ai/guides/reference/faq/security).
- **io.net** (crypto, IO token). Suppliers stake 200 IO per chip and pass an hourly proof of work; about 327,000 GPUs
  registered and about 6,700 verified on a given day in April 2026. READ, secondary
  ([review](https://ownyourmind.ai/projects/io-net/)).
- **Akash** (crypto, AKT). Container market; 58 average active providers in Q1 2026; Homenode for consumer RTX cards.
  READ, secondary ([review](https://ownyourmind.ai/projects/akash/)).
- **Golem** (crypto, GLM). GPU provider since 2024; a critical task-directory escape fixed in yagna v0.17.10 in
  September 2026. READ, secondary ([news](https://coinmarketcap.com/cmc-ai/golem-network-tokens/latest-updates/)).
- **Nosana** (crypto, NOS on Solana). Operators bid for jobs; 50,000+ hosts claimed. READ, secondary
  ([CoinMarketCap](https://coinmarketcap.com/cmc-ai/nosana/what-is/)).
- **Prime Intellect** (no crypto to rent). Aggregates GPUs from 50+ data centres; raised $130M in July 2026. READ,
  secondary ([blocmates](https://www.blocmates.com/articles/what-is-prime-intellect-the-compute-exchange)). Its
  **TOPLOC** checks an untrusted worker's output with 258 bytes per 32 tokens and caught changed models, prompts or
  precision in tests. READ ([paper](https://arxiv.org/abs/2501.16007)).

## 5. Classic volunteer computing

- **BOINC.** Same job to several hosts, a quorum must agree, and adaptive replication sends fewer copies to reliable
  hosts. READ ([wiki](https://github.com/BOINC/boinc/wiki/ValidationIntro)). Client 8.2.15, June 2026. READ
  ([releases](https://api.github.com/repos/BOINC/boinc/releases)).
- **Folding@home.** Client asks a central server for a work unit sized for its hardware; "F@h never sends the same WU
  to two donors as a redundant check". READ ([FAQ](https://foldingathome.org/faq/running)). Client 8.5.6, July 2026.
  READ, secondary.

## 6. Built for schools

Nothing found that pools students' own machines. What exists is a shared server: JupyterHub with GPUs
([NAIRR pilot](https://nairrpilot.org/pilotresources/q/awards)), or a boxed classroom app on one AI PC
([AMD, Tsinghua](https://www.amd.com/en/blogs/2026/reimagining-ai-native-education-through-multi-agent-interactive-classroom-on-amd-rocm.html)).
READ.

## 7. Comparison

| | Who sees the work | Job reaches machine by | Browser | Pay | Alive |
| --- | --- | --- | --- | --- | --- |
| visualia pool | worker in the same class, no asker id | worker's outbound WebSocket | yes, plus app | $0, paid model fallback | building |
| MutualGPU | an anonymous provider | not established | yes | none stated | no provider enrolled |
| AI Horde | stranger operator | worker polls `pop` | no | kudos | yes |
| Petals | swarm peers | layers over peers | no | none | stopped 2024 |
| SwarmLLM, pooled | everyone in the room | WebRTC slices | yes | none | 2026 |
| exo, distributed-llama, RPC | LAN devices | inbound LAN | no | none | yes |
| Ollama Herd, LocalAI, GPUStack, Kalavai | own cluster | inbound or p2p token | no | none | yes |
| Salad, Vast.ai | host (VM or container) | container rental | no | money | yes |
| io.net, Akash, Golem, Nosana | host | container, staking | no | crypto | yes |
| BOINC, Folding@home | project server | client polls | no | credit | yes |

## 8. What visualia's pool can learn

- **Onboarding.** Salad benchmarks before admission, io.net re-checks hourly. The pool could run one fixed test prompt
  when a worker says `hello`, compare it to a known answer, and record its speed, before sending real work (INFERRED).
- **Matching.** Horde matches each poll against what the worker declares on that poll. The pool does the same with
  `hello {models}`. Ollama Herd scores "model load state" and memory fit, which suits the no warm-keeping rule:
  prefer a worker that already has the model loaded (INFERRED).
- **Trust.** Others use three things: redundancy (BOINC quorum), reputation (Horde's trusted workers, BOINC's adaptive
  replication), and stakes or contracts (io.net, Vast). Folding@home does no redundancy at all and trusts its donors.
  For a class, a cheap version is: occasionally send the same small job to two workers, or to a worker and the paid
  model, and compare (INFERRED). TOPLOC needs the verifier to hold the model's hidden states, so it fits only when the
  gateway can rerun a model (INFERRED). Nobody stops a provider reading the work. Horde says so, Petals and pooled say
  so, Vast says so. The pool's line "a worker sees the prompts it runs" is the honest standard.
- **Energy and fairness.** Horde's kudos and BOINC's credit reward serving with priority. The pool records energy per
  job, which none of these do per job (INFERRED from what the pages show). A fairness view per person (served vs asked)
  would come from the existing `served_by` rows.
- **Browser vs native.** Browser workers exist only in demos and small rooms (MutualGPU, AI Grid, SwarmLLM). Every
  network with real throughput uses native workers. The pool's tab is the easy door, the app does the volume (INFERRED).
- **Where visualia differs on purpose.** One class, not the public: no reputation economy needed. Whole jobs, not
  split layers: no hidden states cross machines, and a lost worker is a fallback, not a broken model. Nothing about a
  job kept, like Horde, while the paid markets keep containers on the host's disk. No identity at the worker, like
  Horde. Pinned models by SHA-256: none of the projects above describe checking model files by hash before loading
  (not established either way). Every job visible to the class: no other project shows its jobs to everyone in the
  pool. Outbound only: exo, distributed-llama, llama.cpp RPC, Ollama Herd and LocalAI all need open ports on the LAN.

## Could not establish

MutualGPU's server, matching, storage and operator details; Horde's FAQ answers first hand (the page rendered only
headings); exo's authentication; whether any of these pin model files by hash; io.net, Akash and Nosana figures beyond
secondary sources.
