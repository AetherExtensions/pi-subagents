import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const aetherPath = fileURLToPath(new URL("../src/aether.ts", import.meta.url));
const manifestPath = fileURLToPath(new URL("../package.json", import.meta.url));

describe("Aether Script Mod manifest", () => {
	test("declares API v2 and a Script Mod entrypoint without requiring a Native Mod", () => {
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
		expect(manifest.aether).toEqual({
			api: { min: 2, max: 2 },
			extensions: ["./src/aether.ts"],
		});
		expect(manifest.pi.extensions).toEqual(["./src/index.ts"]);
	});
});

describe("Aether Script Mod runtime", () => {
	test("mirrors settings to .pi/subagents.json and renders live agents, viewer, and messages", () => {
		const projectRoot = mkdtempSync(join(tmpdir(), "pi-subagents-aether-project-"));
		const agentRoot = mkdtempSync(join(tmpdir(), "pi-subagents-aether-agent-"));
		writeFileSync(
			join(agentRoot, "subagents.json"),
			`${JSON.stringify({ maxConcurrent: 2, widgetMode: "all", unknownOption: { keep: true } })}\n`,
		);

		const child = spawnSync(process.execPath, ["--input-type=module"], {
			cwd: projectRoot,
			encoding: "utf8",
			env: { ...process.env, PI_CODING_AGENT_DIR: agentRoot },
			input: `
				const { activateAether, appendAetherSubagentMessage, registerSubagentsBridge } = await import(${JSON.stringify(aetherPath)});
				const storage = {};
				const actions = new Map();
				const settings = [];
				const messageTypes = [];
				const toolTitles = [];
				const surfaces = [];
				const events = new Map();
				const hostCalls = [];
				const messages = [];
				const stopped = [];
				const steered = [];
				const applied = [];
				const toggled = [];
				const ui = new Proxy({}, { get: (_target, type) => (first, ...rest) =>
					String(type) === "node"
						? { type: String(first), ...(rest[0] ?? {}) }
						: { type: String(type), args: [first, ...rest] }
				});
				registerSubagentsBridge({
					api: undefined,
					getSnapshot: () => ({
						agents: [{
							id: "agent-1", type: "Explore", displayName: "Explore", description: "Find auth files",
							handle: "explore", status: "running", toolUses: 2, tokens: "1.2k token",
							turnCount: 1, durationMs: 3400, startedAt: Date.now() - 3400,
							activity: "reading", spinnerFrame: 0, modelName: "haiku", tags: [],
							result: "", resultPreview: "", isBackground: true,
						}],
						types: [{
							name: "Explore", displayName: "Explore", description: "Explore the codebase",
							enabled: true, isDefault: true, source: "default",
						}],
						queued: 0,
						running: 1,
						settings: {
							maxConcurrent: 2, defaultMaxTurns: 0, graceTurns: 5, maxSubagentDepth: 2,
							defaultJoinMode: "smart", schedulingEnabled: true, scopeModels: false,
							strictAgentFiles: false, disableDefaultAgents: false, toolDescriptionMode: "full",
							fleetView: true, agentMentions: "model", rememberAgents: true,
							widgetMode: "all", outputTranscript: true,
						},
					}),
					getConversation: (id) => id === "agent-1" ? "[User]: find auth files" : undefined,
					getResult: (id) => id === "agent-1" ? "auth files found" : undefined,
					steer: (id, message) => { steered.push({ id, message }); return true; },
					abort: (id) => { stopped.push(id); return true; },
					applySetting: (id, value) => { applied.push({ id, value }); return { ok: true, message: id + " applied" }; },
					reloadAgents: () => {},
					toggleAgent: (name) => { toggled.push(name); return { ok: true, message: "toggled " + name }; },
					dispatchMention: async (text) => text.startsWith("@explore") ? { action: "handled" } : { action: "continue" },
				});
				const api = {
					ui,
					host: { async invoke(method, args) { hostCalls.push({ method, args }); return {}; } },
					storage: {
						get(key, fallback) { return Object.hasOwn(storage, key) ? storage[key] : fallback; },
						set(key, value) { storage[key] = value; },
						delete(key) { delete storage[key]; },
						snapshot() { return structuredClone(storage); },
					},
					messages: { async append(type, payload, text) { messages.push({ type, payload, text }); return {}; } },
					registerSettings(value) { settings.push(value); return () => {}; },
					registerMessageType(value) { messageTypes.push(value); return () => {}; },
					registerComposerMenuItem(value) { composerItems.push(value); return () => {}; },
					registerSurface(slot, value) { surfaces.push({ slot, value }); return () => {}; },
					registerToolTitle(toolName, runningTitle, completedTitle, priority) { toolTitles.push({ toolName, runningTitle, completedTitle, priority }); return () => {}; },
					registerAction(id, handler) { actions.set(id, handler); return () => {}; },
					on(event, handler) { events.set(event, handler); return () => {}; },
					invalidate() {},
					notify() {},
				};
				const composerItems = [];
				await activateAether(api);
				await actions.get("settings:subagents-settings:maxConcurrent")({ value: 7 });
				await actions.get("settings:subagents-settings:agentMentions")({ value: "direct" });
				await actions.get("agent-stop")({ id: "agent-1" });
				await actions.get("agent-view")({ id: "agent-1" });
				await actions.get("settings:subagents-agents:type:Explore")({ checked: false });
				await actions.get("agent-create")({});
				const beforeSend = events.get("before_send");
				const mentionResult = await beforeSend({ text: "@explore fix the flaky test" });
				const passThroughResult = await beforeSend({ text: "ordinary message" });
				await appendAetherSubagentMessage("subagent-notification", { description: "Find auth files", status: "completed" }, "done");
				const liveRender = surfaces.find((item) => item.slot === "chat.composer.top").value.render();
				const overlayRender = surfaces.find((item) => item.slot === "app.overlay").value.render({ storage });
				const fallbackRender = surfaces.find((item) => item.slot === "chat.list.end").value.render({ storage, custom_messages: [] });
				const config = JSON.parse(await import("node:fs").then(fs => fs.promises.readFile(".pi/subagents.json", "utf8")));
				console.log(JSON.stringify({
					settings: settings.map((item) => ({
						id: item.id,
						sectionIds: item.sections.map((section) => section.id),
						settingIds: item.sections.flatMap((section) => section.settings.map((setting) => setting.id)),
					})),
					agentTypeSettings: settings
						.filter((item) => item.id === "subagents-agents")
						.at(-1)
						.sections.find((section) => section.id === "types")
						.settings.map((setting) => ({ id: setting.id, type: setting.type, default: setting.default })),
					storage,
					config,
					applied,
					stopped,
					steered,
					toggled,
					messageTypes: messageTypes.map((item) => item.type),
					toolTitles,
					surfaceSlots: surfaces.map((item) => item.slot),
					composerItemIds: composerItems.map((item) => item.id),
					messages,
					hostCalls,
					mentionResult,
					passThroughResult,
					liveTree: liveRender,
					overlayTree: overlayRender,
					fallbackTree: fallbackRender,
				}));
			`,
		});

		expect(child.status, child.stderr).toBe(0);
		const output = JSON.parse(child.stdout);
		expect(output.settings).toEqual([
			{
				id: "subagents-settings",
				sectionIds: ["runtime", "agents", "models", "ui"],
				settingIds: [
					"maxConcurrent", "defaultMaxTurns", "graceTurns", "maxSubagentDepth", "joinMode",
					"schedulingEnabled", "outputTranscript", "disableDefaultAgents", "fallbackSubagent",
					"strictAgentFiles", "toolDescriptionMode", "scopeModels", "widgetMode", "fleetView",
					"agentMentions", "rememberAgents",
				],
			},
			{
				id: "subagents-agents",
				sectionIds: ["manage", "types"],
				settingIds: ["create", "reload", "type:Explore"],
			},
			{
				id: "subagents-agents",
				sectionIds: ["manage", "types"],
				settingIds: ["create", "reload", "type:Explore"],
			},
		]);
		expect(output.config).toMatchObject({
			maxConcurrent: 7,
			agentMentions: "direct",
			widgetMode: "all",
			defaultMaxTurns: 0,
		});
		expect(output.storage["settings:subagents-settings:maxConcurrent"]).toBe(7);
		expect(output.storage["settings:subagents-settings:agentMentions"]).toBe("direct");
		expect(output.applied).toEqual([
			{ id: "maxConcurrent", value: 7 },
			{ id: "agentMentions", value: "direct" },
		]);
		expect(output.stopped).toEqual(["agent-1"]);
		expect(output.toggled).toEqual(["Explore"]);
		expect(output.agentTypeSettings).toEqual([{ id: "type:Explore", type: "toggle", default: true }]);
		expect(output.hostCalls.map((call) => call.method)).toEqual(
			expect.arrayContaining(["app.openScreen", "app.appendDraftInput"]),
		);
		expect(output.toolTitles).toEqual([
			{ toolName: "Agent", runningTitle: "Running subagent", completedTitle: "Ran subagent", priority: 200 },
			{ toolName: "get_subagent_result", runningTitle: "Checking subagent result", completedTitle: "Checked subagent result", priority: 200 },
			{ toolName: "steer_subagent", runningTitle: "Steering subagent", completedTitle: "Steered subagent", priority: 200 },
		]);
		expect(output.messageTypes).toEqual(["subagent-notification", "subagent-result", "subagent-conversation"]);
		expect(output.surfaceSlots).toEqual(["chat.composer.top", "chat.list.end", "app.overlay"]);
		expect(output.composerItemIds).toEqual(["subagents"]);
		expect(output.messages[0]).toMatchObject({ type: "subagent-notification" });
		expect(output.mentionResult).toEqual({ cancelled: true });
		expect(output.passThroughResult).toBeUndefined();
		expect(output.liveTree.type).toBe("card");
		expect(output.overlayTree.type).toBe("scroll");
		expect(output.fallbackTree).toBeNull();
		expect(output.storage.viewerAgentId).toBe("agent-1");
	});

	test("attaches a bridge installed after Script Mod activation", () => {
		const projectRoot = mkdtempSync(join(tmpdir(), "pi-subagents-aether-late-project-"));
		const agentRoot = mkdtempSync(join(tmpdir(), "pi-subagents-aether-late-agent-"));
		const child = spawnSync(process.execPath, ["--input-type=module"], {
			cwd: projectRoot,
			encoding: "utf8",
			env: { ...process.env, PI_CODING_AGENT_DIR: agentRoot },
			input: `
				const { activateAether, registerSubagentsBridge } = await import(${JSON.stringify(aetherPath)});
				const storage = {};
				const settings = [];
				const surfaces = [];
				const ui = new Proxy({}, { get: (_target, type) => (first, ...rest) =>
					String(type) === "node" ? { type: String(first), ...(rest[0] ?? {}) } : { type: String(type), args: [first, ...rest] }
				});
				const api = {
					ui,
					host: { async invoke() { return {}; } },
					storage: {
						get(key, fallback) { return Object.hasOwn(storage, key) ? storage[key] : fallback; },
						set(key, value) { storage[key] = value; },
						delete(key) { delete storage[key]; },
						snapshot() { return structuredClone(storage); },
					},
					messages: { async append() { return {}; } },
					registerSettings(value) { settings.push(value); return () => {}; },
					registerMessageType() { return () => {}; },
					registerComposerMenuItem() { return () => {}; },
					registerSurface(slot, value) { surfaces.push({ slot, value }); return () => {}; },
					registerAction() { return () => {}; },
					on() { return () => {}; },
					invalidate() {},
					notify() {},
				};
				await activateAether(api);
				const before = settings.find((item) => item.id === "subagents-agents");
				registerSubagentsBridge({
					api: undefined,
					getSnapshot: () => ({
						agents: [{
							id: "agent-1", type: "Explore", displayName: "Explore", description: "Explore",
							status: "running", toolUses: 0, tokens: "", turnCount: 1, durationMs: 100,
							startedAt: Date.now() - 100, activity: "thinking…", spinnerFrame: 0,
							modelName: "", tags: [], result: "", resultPreview: "", isBackground: true,
						}],
						types: [{ name: "Explore", displayName: "Explore", description: "Explore", enabled: true, isDefault: true, source: "default" }],
						queued: 0,
						running: 1,
						settings: {
							maxConcurrent: 4, defaultMaxTurns: 0, graceTurns: 5, maxSubagentDepth: 2,
							defaultJoinMode: "smart", schedulingEnabled: true, scopeModels: false,
							strictAgentFiles: false, disableDefaultAgents: false, toolDescriptionMode: "full",
							fleetView: true, agentMentions: "model", rememberAgents: true,
							widgetMode: "background", outputTranscript: true,
						},
					}),
					getConversation: () => undefined,
					getResult: () => undefined,
					steer: () => false,
					abort: () => false,
					applySetting: () => ({ ok: true }),
					reloadAgents: () => {},
					toggleAgent: () => ({ ok: true, message: "" }),
					dispatchMention: async () => ({ action: "continue" }),
				});
				const after = settings.findLast((item) => item.id === "subagents-agents");
				console.log(JSON.stringify({
					beforeSectionIds: before.sections.map((section) => section.id),
					afterSettingIds: after.sections.flatMap((section) => section.settings.map((setting) => setting.id)),
					liveTree: surfaces.find((item) => item.slot === "chat.composer.top").value.render(),
				}));
			`,
		});
		expect(child.status, child.stderr).toBe(0);
		const output = JSON.parse(child.stdout);
		expect(output.beforeSectionIds).toEqual(["manage"]);
		expect(output.afterSettingIds).toEqual(["create", "reload", "type:Explore"]);
		expect(output.liveTree.type).toBe("card");
	});
});
