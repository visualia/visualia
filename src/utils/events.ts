import mitt from "mitt";

const emitter = mitt();

export function send(name: string, payload?: any): void {
  emitter.emit(name, payload);
}

export function receive(name: string, handler = (payload?: any) => {}): void {
  emitter.on(name, handler);
}
