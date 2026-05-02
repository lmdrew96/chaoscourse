import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  IMPORT_TOOL_DEFINITIONS,
  handleImportTool,
} from "./tools/import.js";
import {
  QUERY_TOOL_DEFINITIONS,
  handleQueryTool,
} from "./tools/query.js";
import {
  STATUS_TOOL_DEFINITIONS,
  handleStatusTool,
} from "./tools/status.js";
import {
  SEMESTER_TOOL_DEFINITIONS,
  handleSemesterTool,
} from "./tools/semester.js";

export const SERVER_NAME = "chaoscourse";
export const SERVER_VERSION = "0.1.0";

const TOOL_DEFINITIONS = [
  ...IMPORT_TOOL_DEFINITIONS,
  ...QUERY_TOOL_DEFINITIONS,
  ...STATUS_TOOL_DEFINITIONS,
  ...SEMESTER_TOOL_DEFINITIONS,
];

const importToolNames = new Set(IMPORT_TOOL_DEFINITIONS.map((t) => t.name));
const queryToolNames = new Set(QUERY_TOOL_DEFINITIONS.map((t) => t.name));
const statusToolNames = new Set(STATUS_TOOL_DEFINITIONS.map((t) => t.name));
const semesterToolNames = new Set(SEMESTER_TOOL_DEFINITIONS.map((t) => t.name));

const dispatchTool = async (
  name: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<string> => {
  // Casts: handler param types are narrowed by their internal switch statements;
  // server.ts is the boundary where unknown strings come in.
  if (importToolNames.has(name as never)) {
    return handleImportTool(name as never, args, userId);
  }
  if (queryToolNames.has(name as never)) {
    return handleQueryTool(name as never, args, userId);
  }
  if (statusToolNames.has(name as never)) {
    return handleStatusTool(name as never, args, userId);
  }
  if (semesterToolNames.has(name as never)) {
    return handleSemesterTool(name as never, args, userId);
  }
  throw new Error(`Unknown tool: ${name}`);
};

export const createServerForUser = (userId: string): Server => {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args = {} } = req.params;
    try {
      const result = await dispatchTool(
        name,
        args as Record<string, unknown>,
        userId,
      );
      return { content: [{ type: "text", text: result }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
};

export const TOOL_COUNT = TOOL_DEFINITIONS.length;
