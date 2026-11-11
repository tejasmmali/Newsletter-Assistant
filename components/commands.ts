type Handler = () => void;

const handlers = new Map<string, Handler>();

export function onCommand(name: string, handler: Handler) {
  handlers.set(name, handler);
  return () => {
    if (handlers.get(name) === handler) handlers.delete(name);
  };
}

export function runCommand(name: string) {
  const handler = handlers.get(name);
  if (!handler) return false;
  handler();
  return true;
}
