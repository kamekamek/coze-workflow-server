#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';

// Coze APIのトークンを環境変数から読み込む
const COZE_API_TOKEN = process.env.COZE_API_TOKEN;
if (!COZE_API_TOKEN) {
  throw new Error('COZE_API_TOKEN environment variable is required');
}

type Note = { title: string, content: string };

const notes: { [id: string]: Note } = {
  "1": { title: "First Note", content: "This is note 1" },
  "2": { title: "Second Note", content: "This is note 2" }
};

const server = new Server(
  {
    name: "coze-workflow-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: Object.entries(notes).map(([id, note]) => ({
      uri: `note:///${id}`,
      mimeType: "text/plain",
      name: note.title,
      description: `A text note: ${note.title}`
    }))
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  const id = url.pathname.replace(/^\//, '');
  const note = notes[id];

  if (!note) {
    throw new McpError(ErrorCode.InvalidRequest, `Note ${id} not found`);
  }

  return {
    contents: [{
      uri: request.params.uri,
      mimeType: "text/plain",
      text: note.content
    }]
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create_note",
        description: "Create a new note",
        inputSchema: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Title of the note"
            },
            content: {
              type: "string",
              description: "Text content of the note"
            }
          },
          required: ["title", "content"]
        }
      },
      {
        name: "run_coze_workflow",
        description: "Run a Coze workflow",
        inputSchema: {
          type: "object",
          properties: {
            workflow_id: {
              type: "string",
              description: "ID of the workflow to run"
            },
            parameters: {
              type: "object",
              description: "Input parameters for the workflow"
            },
            bot_id: {
              type: "string",
              description: "Associated Bot ID (optional)"
            },
            app_id: {
              type: "string",
              description: "App ID (optional)"
            }
          },
          required: ["workflow_id", "parameters"]
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "create_note": {
      const title = String(request.params.arguments?.title);
      const content = String(request.params.arguments?.content);
      if (!title || !content) {
        throw new McpError(ErrorCode.InvalidParams, "Title and content are required");
      }

      const id = String(Object.keys(notes).length + 1);
      notes[id] = { title, content };

      return {
        content: [{
          type: "text",
          text: `Created note ${id}: ${title}`
        }]
      };
    }

    case "run_coze_workflow": {
      const { workflow_id, parameters, bot_id, app_id } = request.params.arguments as {
        workflow_id: string;
        parameters: Record<string, unknown>;
        bot_id?: string;
        app_id?: string;
      };

      if (!workflow_id) {
        throw new McpError(ErrorCode.InvalidParams, "Workflow ID is required");
      }

      // パラメータが未定義の場合は空オブジェクトを使用
      const requestBody: Record<string, unknown> = {
        workflow_id,
        parameters: parameters || {}
      };

      // オプションパラメータの追加
      if (bot_id) requestBody.bot_id = bot_id;
      if (app_id) requestBody.app_id = app_id;

      try {
        const response = await axios.post('https://api.coze.com/v1/workflow/run', requestBody, {
          headers: {
            'Authorization': `Bearer ${COZE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        });

        // デバッグ情報を含むレスポンス
        return {
          content: [{
            type: "text",
            text: `Workflow execution result:\n${JSON.stringify(response.data, null, 2)}\n\nDebug URL: ${response.data.debug_url || 'Not available'}`
          }]
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          const errorMessage = error.response?.data?.msg || error.message;
          const debugUrl = error.response?.data?.debug_url;
          throw new McpError(
            ErrorCode.InternalError, 
            `Coze API error: ${errorMessage}${debugUrl ? `\nDebug URL: ${debugUrl}` : ''}`
          );
        }
        throw error;
      }
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, "Unknown tool");
  }
});

server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: [
      {
        name: "summarize_notes",
        description: "Summarize all notes",
      }
    ]
  };
});

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
  if (request.params.name !== "summarize_notes") {
    throw new McpError(ErrorCode.MethodNotFound, "Unknown prompt");
  }

  const embeddedNotes = Object.entries(notes).map(([id, note]) => ({
    type: "resource" as const,
    resource: {
      uri: `note:///${id}`,
      mimeType: "text/plain",
      text: note.content
    }
  }));

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Please summarize the following notes:"
        }
      },
      ...embeddedNotes.map(note => ({
        role: "user" as const,
        content: note
      })),
      {
        role: "user",
        content: {
          type: "text",
          text: "Provide a concise summary of all the notes above."
        }
      }
    ]
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Coze Workflow MCP server running on stdio');
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
