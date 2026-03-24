import { setup, assign, fromPromise } from "xstate";
import {
  createSessionActor,
  sendMessageActor,
  stopSessionActor,
  removeSessionActor,
  type CreateSessionInput,
  type SendMessageInput,
  type StopSessionInput,
  type RemoveSessionInput,
  type SessionRef,
} from "../services/agent-deck.js";
import { generateSessionTitle, getSessionPrefix } from "../services/session-naming.js";
import { assembleSessionPrompt } from "../services/session-prompts.js";

export interface TestWorkflowV02Context {
  instanceId: string;
  workPath: string;
  workStartedAt: string | null;
  sessionTitle: string | null;
  sessionError: string | null;
  prompts: {
    agent: string;
  };
}

const DEFAULT_WORKFLOW_TOOLS = [
  "workflow.transition",
  "workflow.status",
  "workflow.context",
];

export const testWorkflowV02 = setup({
  types: {
    context: {} as TestWorkflowV02Context,
    events: {} as
      | { type: "start" }
      | { type: "impl.complete" }
      | { type: "send_message"; message: string },
  },
  actors: {
    createSession: createSessionActor,
    sendMessage: sendMessageActor,
    stopSession: stopSessionActor,
    removeSession: removeSessionActor,
  },
}).createMachine({
  id: "test-v0.2",
  initial: "idle",
  context: {
    instanceId: "",
    workPath: process.cwd(),
    workStartedAt: null,
    sessionTitle: null,
    sessionError: null,
    prompts: {
      agent:
        "You are in a test workflow. Call `workflow.transition('impl.complete')` when done.",
    },
  },
  states: {
    idle: {
      on: {
        start: {
          target: "setup",
          actions: assign({
            workStartedAt: () => new Date().toISOString(),
          }),
        },
      },
    },
    setup: {
      invoke: {
        src: "createSession",
        input: ({ context }) => {
          const title = generateSessionTitle(context.instanceId, "agent");
          const initialMessage = assembleSessionPrompt(
            context.instanceId,
            context.prompts.agent,
            DEFAULT_WORKFLOW_TOOLS,
          );
          return {
            workPath: context.workPath,
            title,
            tool: "claude",
            branch: `wfe/${context.instanceId}/agent`,
            newBranch: true,
            location: "subdirectory",
            mcpServers: ["workflow-engine"],
            initialMessage,
          } satisfies CreateSessionInput;
        },
        onDone: {
          target: "agent_working",
          actions: assign({
            sessionTitle: ({ event }) => (event.output as SessionRef).title,
          }),
        },
        onError: {
          target: "setup_failed",
          actions: assign({
            sessionError: ({ event }) => {
              const err = event.error as Record<string, unknown>;
              return (
                (err.stderr as string) ??
                (err.message as string) ??
                "Session creation failed"
              );
            },
          }),
        },
      },
    },
    agent_working: {
      on: {
        "impl.complete": { target: "teardown" },
        send_message: { target: "sending" },
      },
    },
    sending: {
      invoke: {
        src: "sendMessage",
        input: ({ context, event }) => {
          return {
            title: context.sessionTitle!,
            message: (event as { type: "send_message"; message: string })
              .message,
          } satisfies SendMessageInput;
        },
        onDone: { target: "agent_working" },
        onError: { target: "agent_working" },
      },
    },
    teardown: {
      initial: "stopping",
      states: {
        stopping: {
          invoke: {
            src: "stopSession",
            input: ({ context }) => {
              return {
                title: context.sessionTitle!,
                recursive: true,
                prefix: getSessionPrefix(context.instanceId),
              } satisfies StopSessionInput;
            },
            onDone: { target: "removing" },
            onError: { target: "#test-v0\\.2.done" },
          },
        },
        removing: {
          invoke: {
            src: "removeSession",
            input: ({ context }) => {
              return {
                title: context.sessionTitle!,
              } satisfies RemoveSessionInput;
            },
            onDone: { target: "#test-v0\\.2.done" },
            onError: { target: "#test-v0\\.2.done" },
          },
        },
      },
    },
    done: {
      type: "final",
    },
    setup_failed: {
      type: "final",
    },
  },
});
