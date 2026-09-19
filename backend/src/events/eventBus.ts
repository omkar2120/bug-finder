import { EventEmitter } from "node:events";
import type { SseEventType } from "@bugpilot/shared";

export interface TestRunEvent {
  type: SseEventType;
  testRunId: string;
  projectId: string;
  message: string;
  level?: "info" | "success" | "warning" | "error" | "ai";
  payload?: Record<string, unknown>;
  createdAt: string;
}

class TestRunEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  publish(event: TestRunEvent) {
    this.emitter.emit(event.testRunId, event);
    this.emitter.emit("*", event);
  }

  subscribe(testRunId: string, listener: (event: TestRunEvent) => void) {
    this.emitter.on(testRunId, listener);
    return () => this.emitter.off(testRunId, listener);
  }
}

export const eventBus = new TestRunEventBus();
