import { setup, assign } from "xstate";

export interface TestWorkflowContext {
  hasWork: boolean;
  submitCount: number;
  workStartedAt: string | null;
  browserUrl: string | null;
}

export const testWorkflowV01 = setup({
  types: {
    context: {} as TestWorkflowContext,
    events: {} as
      | { type: "start" }
      | { type: "submit" }
      | { type: "review.approved" }
      | { type: "review.revised"; feedback?: string },
  },
  guards: {
    hasWork: ({ context }) => context.hasWork === true,
  },
}).createMachine({
  id: "test-v0.1",
  initial: "idle",
  context: {
    hasWork: false,
    submitCount: 0,
    workStartedAt: null,
    browserUrl: null,
  },
  states: {
    idle: {
      on: {
        start: {
          target: "working",
          actions: assign({
            workStartedAt: () => new Date().toISOString(),
          }),
        },
      },
    },
    working: {
      on: {
        submit: {
          target: "reviewing",
          actions: assign({
            hasWork: true,
            submitCount: ({ context }) => context.submitCount + 1,
          }),
        },
      },
    },
    reviewing: {
      on: {
        "review.approved": {
          target: "done",
          guard: "hasWork",
        },
        "review.revised": {
          target: "working",
          actions: assign({
            hasWork: false,
          }),
        },
      },
    },
    done: {
      type: "final",
    },
  },
});
