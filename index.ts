import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Type } from "@sinclair/typebox";
import { jsonResult, readStringParam } from "openclaw/plugin-sdk/agent-runtime";
import type { AnyAgentTool } from "openclaw/plugin-sdk/plugin-entry";
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";

const execAsync = promisify(exec);

// Allow override via env var; fallback to bare name relying on PATH.
const LARK_CLI_BIN = process.env.LARK_CLI_BIN ?? "lark-cli";

const LARK_CLI_EXEC_TIMEOUT_MS = 30_000;

/**
 * Build the exec environment, augmenting PATH with common install locations
 * (Homebrew on macOS, /usr/local/bin) so the binary is found even when
 * OpenClaw is launched as a GUI/daemon with a minimal PATH.
 */
function buildExecEnv(): NodeJS.ProcessEnv {
  const additions = ["/opt/homebrew/bin", "/usr/local/bin"];
  const current = process.env.PATH ?? "/usr/bin:/bin";
  const extra = additions.filter((p) => !current.includes(p)).join(":");
  return {
    ...process.env,
    PATH: extra ? `${extra}:${current}` : current,
  };
}

/**
 * Run a lark-cli subcommand and return {stdout, stderr, exitCode}.
 * Appends `--format json` unless the caller already specified `--format`.
 */
async function runLarkCli(
  args: string,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Avoid duplicate --format flags if the user already specified one.
  const hasFormat = /--format\b/.test(args);
  const fullArgs = hasFormat ? args : `${args} --format json`;

  try {
    const { stdout, stderr } = await execAsync(
      `${LARK_CLI_BIN} ${fullArgs}`,
      {
        timeout: LARK_CLI_EXEC_TIMEOUT_MS,
        env: buildExecEnv(),
      },
    );
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } catch (err: unknown) {
    // execAsync throws when exit code != 0
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
    return {
      stdout: e.stdout?.trim() ?? "",
      stderr: e.stderr?.trim() ?? e.message ?? String(err),
      exitCode: e.code ?? 1,
    };
  }
}

function tryParseJson(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const LarkCliToolSchema = Type.Object(
  {
    command: Type.String({
      description:
        "The lark-cli subcommand and its arguments (everything after 'lark-cli'). " +
        "Examples:\n" +
        "  calendar +agenda\n" +
        "  im +messages-send --chat-id oc_xxx --text \"Hello\"\n" +
        "  docs +create --title \"Title\" --markdown \"# Content\"\n" +
        "  base records list --app-token xxx --table-id tbl_xxx\n" +
        "  auth status\n" +
        "  contact users get --user-id xxx\n" +
        "NOTE: Interactive commands (auth login, config init) do NOT work in agent context — " +
        "run them manually in a terminal first. Use 'auth status' to verify login state.\n" +
        "Run '--help' (via this tool) to list all available commands.",
    }),
  },
  { additionalProperties: false },
);

export default definePluginEntry({
  id: "lark-cli",
  name: "Lark CLI",
  description:
    "Execute any lark-cli command (Lark/Feishu calendar, messages, docs, base, sheets, tasks, etc.)",
  register(api) {
    api.registerTool({
      name: "lark_cli",
      label: "Lark CLI",
      description:
        "Run any lark-cli command to interact with Lark/Feishu. " +
        "Covers calendar, messages, docs, drive, base, sheets, tasks, mail, contact, wiki, and more. " +
        "Pass the full subcommand string (excluding the 'lark-cli' prefix). " +
        "Use 'auth status' first to confirm you are authenticated. " +
        "Interactive commands (auth login, config init) must be run manually in a terminal — they will not work here.",
      parameters: LarkCliToolSchema,
      execute: async (_toolCallId, rawParams) => {
        const command = readStringParam(rawParams, "command", { required: true });
        if (!command?.trim()) {
          return jsonResult({ error: "'command' parameter is required." });
        }

        const { stdout, stderr, exitCode } = await runLarkCli(command.trim());

        if (exitCode !== 0) {
          return jsonResult({
            status: "error",
            exitCode,
            error: stderr || "lark-cli exited with a non-zero status.",
            output: stdout || null,
            hint:
              stderr.includes("not logged in") || stderr.includes("auth")
                ? "Run 'auth status' or 'auth login --recommend' to authenticate first."
                : undefined,
          });
        }

        const parsed = tryParseJson(stdout);
        return jsonResult({
          status: "ok",
          data: parsed ?? stdout,
        });
      },
    } as AnyAgentTool);
  },
});
