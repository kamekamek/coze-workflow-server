# coze-workflow-server MCPサーバー

Cozeワークフローを実行するためのModel Context Protocolサーバー

これは、TypeScriptベースのMCPサーバーで、シンプルなノートシステムを実装し、Coze Workflow Run APIへのアクセスを提供します。以下のMCPコアコンセプトを実現します：

- テキストノートをURIとメタデータで表現するリソース
- 新しいノートを作成し、Cozeワークフローを実行するツール
- ノートの要約を生成するプロンプト

## 機能

### リソース
- `note://` URIを通じてノートをリストし、アクセスする
- 各ノートにはタイトル、内容、メタデータが含まれます
- シンプルな内容アクセス用のプレーンテキストmimeタイプ

### ツール
- `create_note` - 新しいテキストノートを作成
  - タイトルと内容を必須パラメータとして受け取ります
  - ノートをサーバー状態に保存します
- `run_coze_workflow` - Cozeワークフローを実行
  - workflow_idとパラメータを必須パラメータとして受け取ります
  - オプションパラメータ：bot_idとapp_id

### プロンプト
- `summarize_notes` - 保存されたすべてのノートの要約を生成
  - すべてのノート内容を埋め込みリソースとして含みます
  - LLM要約用の構造化プロンプトを返します

## 開発

依存関係をインストール：
```bash
npm install
```

サーバーをビルド：
```bash
npm run build
```

自動再ビルドでの開発：
```bash
npm run watch
```

## インストール

Claude Desktopで使用するには、サーバー設定を追加してください：

MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
Windows: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "coze-workflow-server": {
      "command": "node",
      "args": [
        "/path/to/coze-workflow-server/build/index.js"
      ],
      "env": {
        "COZE_API_TOKEN": "your_coze_api_token_here"
      }
    }
  }
}
```

`/path/to/coze-workflow-server`を実際のサーバーパスに、`your_coze_api_token_here`を実際のCoze APIトークンに置き換えてください。

## 使用方法

### Cozeワークフローの実行

Cozeワークフローを実行するには、`run_coze_workflow`ツールを使用してください。以下は使用方法の例です：

1. 実行したいワークフローを識別し、その`workflow_id`を取得してください。
2. ワークフローの入力パラメータを準備してください。
3. 以下の形式でワークフローを実行してください：

```
Run the Coze workflow with the following details:
- Tool: run_coze_workflow
- workflow_id: "your_workflow_id_here"
- parameters: {"key1": "value1", "key2": "value2"}
- bot_id: "your_bot_id_here" (オプション)
- app_id: "your_app_id_here" (オプション)
```

`your_workflow_id_here`を実際のワークフローIDに置き換え、パラメータ、bot_id、app_idを特定のワークフローに合わせて調整してください。

### デバッグ

MCPサーバーはstdioを通じて通信するため、デバッグが困難です。以下の[MCP Inspector](https://github.com/modelcontextprotocol/inspector)を使用することをお勧めします。これはパッケージスクリプトとして利用可能です：

```bash
npm run inspector
```

InspectorはブラウザでデバッグツールにアクセスするためのURLを提供します。
