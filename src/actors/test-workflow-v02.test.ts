import { describe, expect, test } from "bun:test";
import { createActor, fromPromise } from "xstate";
import { testWorkflowV02 } from "./test-workflow-v02.js";
import type {
  SessionRef,
  CreateSessionInput,
  SendMessageInput,
  StopSessionInput,
  RemoveSessionInput,
} from "../services/agent-deck.js";

function createMockMachine(overrides: {
  createSession?: () => Promise<SessionRef>;
  sendMessage?: () => Promise<void>;
  stopSession?: () => Promise<void>;
  removeSession?: () => Promise<void>;
} = {}) {
  return testWorkflowV02.provide({
    actors: {
      createSession: fromPromise<SessionRef, CreateSessionInput>(
        overrides.createSession ??
          (async () => ({ title: "cc-test1234-agent", status: "running" })),
      ),
      sendMessage: fromPromise<void, SendMessageInput>(
        overrides.sendMessage ?? (async () => {}),
      ),
      stopSession: fromPromise<void, StopSessionInput>(
        overrides.stopSession ?? (async () => {}),
      ),
      removeSession: fromPromise<void, RemoveSessionInput>(
        overrides.removeSession ?? (async () => {}),
      ),
    },
  });
}

describe("test-v0.2 workflow", () => {
  test("starts in idle state", () => {
    const actor = createActor(createMockMachine(), {
      input: undefined,
    });
    actor.start();
    expect(actor.getSnapshot().value).toBe("idle");
    actor.stop();
  });

  test("happy path: idle → setup → agent_working → teardown → done", async () => {
    const actor = createActor(createMockMachine());
    actor.start();

    expect(actor.getSnapshot().value).toBe("idle");

    actor.send({ type: "start" });
    // After start, machine enters setup which invokes createSession
    // Wait for the async invoke to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(actor.getSnapshot().value).toBe("agent_working");
    expect(actor.getSnapshot().context.sessionTitle).toBe(
      "cc-test1234-agent",
    );
    expect(actor.getSnapshot().context.workStartedAt).not.toBeNull();

    actor.send({ type: "impl.complete" });
    // Wait for teardown (stop + remove)
    await new Promise((r) => setTimeout(r, 100));

    expect(actor.getSnapshot().value).toBe("done");
    expect(actor.getSnapshot().status).toBe("done");
    actor.stop();
  });

  test("setup failure transitions to setup_failed", async () => {
    const machine = createMockMachine({
      createSession: async () => {
        throw { exitCode: 1, stderr: "tmux not running", command: "agent-deck launch" };
      },
    });

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: "start" });
    await new Promise((r) => setTimeout(r, 50));

    expect(actor.getSnapshot().value).toBe("setup_failed");
    expect(actor.getSnapshot().context.sessionError).toContain("tmux not running");
    expect(actor.getSnapshot().status).toBe("done"); // final state
    actor.stop();
  });

  test("send_message → sending → agent_working", async () => {
    const actor = createActor(createMockMachine());
    actor.start();
    actor.send({ type: "start" });
    await new Promise((r) => setTimeout(r, 50));
    expect(actor.getSnapshot().value).toBe("agent_working");

    actor.send({ type: "send_message", message: "Hello agent" });
    await new Promise((r) => setTimeout(r, 50));

    // Should return to agent_working after send completes
    expect(actor.getSnapshot().value).toBe("agent_working");
    actor.stop();
  });

  test("sending error falls through to agent_working", async () => {
    const machine = createMockMachine({
      sendMessage: async () => {
        throw { exitCode: 2, stderr: "not found", command: "agent-deck session send" };
      },
    });

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: "start" });
    await new Promise((r) => setTimeout(r, 50));

    actor.send({ type: "send_message", message: "Hello" });
    await new Promise((r) => setTimeout(r, 50));

    // Should return to agent_working even on error
    expect(actor.getSnapshot().value).toBe("agent_working");
    actor.stop();
  });

  test("teardown stop failure falls through to done", async () => {
    const machine = createMockMachine({
      stopSession: async () => {
        throw { exitCode: 1, stderr: "stop failed", command: "agent-deck session stop" };
      },
    });

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: "start" });
    await new Promise((r) => setTimeout(r, 50));

    actor.send({ type: "impl.complete" });
    await new Promise((r) => setTimeout(r, 100));

    expect(actor.getSnapshot().value).toBe("done");
    actor.stop();
  });

  test("teardown remove failure falls through to done", async () => {
    const machine = createMockMachine({
      removeSession: async () => {
        throw { exitCode: 2, stderr: "not found", command: "agent-deck remove" };
      },
    });

    const actor = createActor(machine);
    actor.start();
    actor.send({ type: "start" });
    await new Promise((r) => setTimeout(r, 50));

    actor.send({ type: "impl.complete" });
    await new Promise((r) => setTimeout(r, 100));

    expect(actor.getSnapshot().value).toBe("done");
    actor.stop();
  });

  test("context has expected initial values", () => {
    const actor = createActor(createMockMachine());
    actor.start();
    const ctx = actor.getSnapshot().context;
    expect(ctx.sessionTitle).toBeNull();
    expect(ctx.sessionError).toBeNull();
    expect(ctx.workStartedAt).toBeNull();
    expect(ctx.prompts.agent).toContain("workflow.transition");
    actor.stop();
  });
});
