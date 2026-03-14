/**
 * Async queue that bridges push-based callbacks to pull-based async iteration.
 * Used to pipe agent text chunks into grammY's replyWithStream().
 */
export class StreamBridge {
  private queue: string[] = [];
  private waiting: ((result: IteratorResult<string>) => void) | null = null;
  private closed = false;

  /** Push a text chunk into the bridge. */
  push(chunk: string): void {
    if (this.closed) return;
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ value: chunk, done: false });
    } else {
      this.queue.push(chunk);
    }
  }

  /** Signal that no more chunks will arrive. */
  close(): void {
    this.closed = true;
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ value: undefined as unknown as string, done: true });
    }
  }

  /** Whether any chunks have been pushed. */
  get hasData(): boolean {
    return this.queue.length > 0 || this.closed;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<string> {
    while (true) {
      if (this.queue.length > 0) {
        yield this.queue.shift()!;
      } else if (this.closed) {
        return;
      } else {
        const result = await new Promise<IteratorResult<string>>((resolve) => {
          this.waiting = resolve;
        });
        if (result.done) return;
        yield result.value;
      }
    }
  }
}
