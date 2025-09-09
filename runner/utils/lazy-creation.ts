/** Helper for lazily creating instances conveniently. */
export function lazy<T>(creationFn: () => T): () => T {
  let instance: T | undefined;
  return () => {
    if (!instance) {
      instance = creationFn();
    }
    return instance;
  };
}
