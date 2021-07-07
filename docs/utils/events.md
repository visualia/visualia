# Global events

Visualia allows to send and receive global events from any component and page.

## emit

```ts
function emit(name: string, payload?: any): void;
```

To send a global message, use a `emit()` function. Send accepts a `name` parameter (any string value) and an optional `payload` parameter that can be any Javascript data type.

#### Usage

Here we are listening `<button>`'s `click` event and send a global event named `message`.

```md
<button v-on:click="emit('message')">💌 Send a message</button>
```

<button v-on:click="emit('message')">💌 Send a message</button>

## on

```ts
function on(name: string, handler = (payload?: any) => {}): void;
```

To receive an event, use a `on()` function with `name` parameter and a callback function.

#### Usage

Here we listen for events and set a global variable `v.sent` to `true`.

```md
{{ on("message", () => v.sent = true) }}

::: tip Waiting for a message to be sent...
{{ v.sent ? '💌 Message sent!' : ''}}
:::
```

{{ on("message", () => v.sent = true) }}

::: tip Waiting for a message to be sent...
{{ v.sent ? '💌 Message sent!' : ''}}
:::

#### Prior art

https://visualia.github.io/visualia_original/#live-variables_events
