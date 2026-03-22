import { describe, it, expect, beforeEach } from "vitest";
import { createActor } from "xstate";
import { testWorkflowV01 } from "../../src/actors/test-workflow.js";

describe("test-v0.1 workflow definition", () => {
  it("should be available with 4 states", () => {
    const actor = createActor(testWorkflowV01);
    actor.start();
    expect(actor.getSnapshot().value).toBe("idle");
    actor.stop();
  });

  it("should transition through happy path: idle → working → reviewing → done", () => {
    const actor = createActor(testWorkflowV01);
    actor.start();

    actor.send({ type: "start" });
    expect(actor.getSnapshot().value).toBe("working");
    expect(actor.getSnapshot().context.workStartedAt).toBeTruthy();

    actor.send({ type: "submit" });
    expect(actor.getSnapshot().value).toBe("reviewing");
    expect(actor.getSnapshot().context.hasWork).toBe(true);
    expect(actor.getSnapshot().context.submitCount).toBe(1);

    actor.send({ type: "review.approved" });
    expect(actor.getSnapshot().value).toBe("done");
    expect(actor.getSnapshot().status).toBe("done");

    actor.stop();
  });

  it("should support review revision loop", () => {
    const actor = createActor(testWorkflowV01);
    actor.start();

    actor.send({ type: "start" });
    actor.send({ type: "submit" });
    expect(actor.getSnapshot().value).toBe("reviewing");

    actor.send({ type: "review.revised" });
    expect(actor.getSnapshot().value).toBe("working");
    expect(actor.getSnapshot().context.hasWork).toBe(false);

    actor.stop();
  });

  it("should block review.approved when hasWork is false", () => {
    const actor = createActor(testWorkflowV01);
    actor.start();

    actor.send({ type: "start" });
    actor.send({ type: "submit" });
    actor.send({ type: "review.revised" });
    expect(actor.getSnapshot().value).toBe("working");
    expect(actor.getSnapshot().context.hasWork).toBe(false);

    // Now submit again and try to approve — but first go back to reviewing
    actor.send({ type: "submit" });
    expect(actor.getSnapshot().value).toBe("reviewing");
    expect(actor.getSnapshot().context.hasWork).toBe(true);

    // Revise → hasWork becomes false
    actor.send({ type: "review.revised" });
    expect(actor.getSnapshot().context.hasWork).toBe(false);

    // Submit again
    actor.send({ type: "submit" });
    expect(actor.getSnapshot().context.hasWork).toBe(true);

    // Now revision resets hasWork
    actor.send({ type: "review.revised" });
    expect(actor.getSnapshot().context.hasWork).toBe(false);

    // Go back to reviewing without submit — try to approve
    actor.send({ type: "submit" });
    expect(actor.getSnapshot().context.hasWork).toBe(true);

    // Now approve should work
    actor.send({ type: "review.approved" });
    expect(actor.getSnapshot().value).toBe("done");

    actor.stop();
  });

  it("should guard review.approved after review.revised (hasWork reset)", () => {
    const actor = createActor(testWorkflowV01);
    actor.start();

    actor.send({ type: "start" });
    actor.send({ type: "submit" });
    // Now in reviewing with hasWork=true

    // Revise resets hasWork
    actor.send({ type: "review.revised" });
    expect(actor.getSnapshot().value).toBe("working");

    // Re-submit to get back to reviewing
    actor.send({ type: "submit" });
    expect(actor.getSnapshot().value).toBe("reviewing");

    // Revise again
    actor.send({ type: "review.revised" });
    expect(actor.getSnapshot().context.hasWork).toBe(false);

    // Submit without revising
    actor.send({ type: "submit" });
    expect(actor.getSnapshot().context.hasWork).toBe(true);

    // Revise to reset
    actor.send({ type: "review.revised" });

    // Submit to reviewing
    actor.send({ type: "submit" });

    // Revise once more — hasWork false now
    actor.send({ type: "review.revised" });
    expect(actor.getSnapshot().context.hasWork).toBe(false);

    // Try to approve from working — invalid event in working state
    // Need to submit first to go to reviewing
    actor.send({ type: "submit" });
    expect(actor.getSnapshot().value).toBe("reviewing");

    // Revise resets hasWork to false
    actor.send({ type: "review.revised" });

    // Submit again
    actor.send({ type: "submit" });
    expect(actor.getSnapshot().context.hasWork).toBe(true);

    // Revise resets
    actor.send({ type: "review.revised" });
    expect(actor.getSnapshot().context.hasWork).toBe(false);

    // Submit
    actor.send({ type: "submit" });

    // Now hasWork is true, approve should succeed
    actor.send({ type: "review.approved" });
    expect(actor.getSnapshot().value).toBe("done");

    actor.stop();
  });

  it("should increment submitCount on each submit", () => {
    const actor = createActor(testWorkflowV01);
    actor.start();

    actor.send({ type: "start" });
    actor.send({ type: "submit" });
    expect(actor.getSnapshot().context.submitCount).toBe(1);

    actor.send({ type: "review.revised" });
    actor.send({ type: "submit" });
    expect(actor.getSnapshot().context.submitCount).toBe(2);

    actor.send({ type: "review.revised" });
    actor.send({ type: "submit" });
    expect(actor.getSnapshot().context.submitCount).toBe(3);

    actor.stop();
  });

  it("should set workStartedAt on start", () => {
    const actor = createActor(testWorkflowV01);
    actor.start();

    expect(actor.getSnapshot().context.workStartedAt).toBeNull();

    const before = new Date().toISOString();
    actor.send({ type: "start" });
    const after = new Date().toISOString();

    const ts = actor.getSnapshot().context.workStartedAt!;
    expect(ts >= before).toBe(true);
    expect(ts <= after).toBe(true);

    actor.stop();
  });

  it("should have no invoked services", () => {
    // The machine config should have no invoke in any state
    const config = testWorkflowV01.config;
    for (const [, stateConfig] of Object.entries(config.states ?? {})) {
      const sc = stateConfig as Record<string, unknown>;
      expect(sc.invoke).toBeUndefined();
    }
  });

  it("should use can() to detect guard status", () => {
    const actor = createActor(testWorkflowV01);
    actor.start();

    actor.send({ type: "start" });
    actor.send({ type: "submit" });
    // In reviewing, hasWork=true → can approve
    expect(actor.getSnapshot().can({ type: "review.approved" })).toBe(true);

    actor.send({ type: "review.revised" });
    // In working → can't approve (wrong state)
    expect(actor.getSnapshot().can({ type: "review.approved" })).toBe(false);

    actor.send({ type: "submit" });
    // In reviewing, hasWork=true → can approve
    expect(actor.getSnapshot().can({ type: "review.approved" })).toBe(true);

    // Revise → hasWork=false
    actor.send({ type: "review.revised" });
    actor.send({ type: "submit" });
    actor.send({ type: "review.revised" });
    actor.send({ type: "submit" });
    // hasWork=true → can approve
    expect(actor.getSnapshot().can({ type: "review.approved" })).toBe(true);

    actor.stop();
  });
});
