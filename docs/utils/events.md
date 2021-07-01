# Global events

Visualia allows to send and receive global events from any component and page.

## send

```ts
function send(name: string, payload?: any): void;
```

To send a global message, use a `send()` function. Send accepts a `name` parameter (any string value) and an optional `payload` parameter that can be any Javascript data type.

#### Usage

Here we are listening `<button>`'s `click` event and send a global event named `message`.

```md
<button v-on:click="send('message')">💌 Send a message</button>
```

<button v-on:click="send('message')">💌 Send a message</button>

## receive

```ts
function receive(name: string, handler = (payload?: any) => {}): void;
```

To receive an event, use a `receive()` function with `name` parameter and a callback function.

#### Usage

::: tip Waiting for a message...
{{ v.received ? '💌 Message received!' : ''}}
:::

Here we listen for events and set a global variable `received` to `true` using [set()](/utils/variables) when the `message` event is received.

```md
{{ receive("message", () => v.received = true) }}
```

{{ receive("message", () => v.received = true) }}

Finally we show a message when global variable `received` is set to `true`.

```md
::: tip Waiting for a message...
{{ v.received ? '💌 Message received!' : ''}}
:::
```

#### See also

https://visualia.github.io/visualia_original/#live-variables_events
