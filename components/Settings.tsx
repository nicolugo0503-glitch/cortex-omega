"use client";

import { AVAILABLE_MODELS, DEFAULT_MODELS } from "@/lib/providers";
import type { Provider, Settings as SettingsT } from "@/lib/types";

interface Props {
  open: boolean;
  settings: SettingsT;
  onChange: (s: SettingsT) => void;
  onClose: () => void;
}

export function Settings({ open, settings, onChange, onClose }: Props) {
  if (!open) return null;

  function update<K extends keyof SettingsT>(key: K, value: SettingsT[K]) {
    onChange({ ...settings, [key]: value });
  }

  function setProvider(p: Provider) {
    onChange({
      ...settings,
      provider: p,
      // reset model to provider default if currently invalid
      model: AVAILABLE_MODELS[p].some((m) => m.id === settings.model)
        ? settings.model
        : DEFAULT_MODELS[p],
    });
  }

  const keyField: "anthropicKey" | "openaiKey" =
    settings.provider === "anthropic" ? "anthropicKey" : "openaiKey";
  const keyVal: string = settings[keyField];

  function setKey(value: string) {
    onChange({ ...settings, [keyField]: value });
  }

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="field">
          <label>Provider</label>
          <div className="provider-toggle">
            <button
              className={settings.provider === "anthropic" ? "on" : ""}
              onClick={() => setProvider("anthropic")}
            >
              Anthropic Claude
            </button>
            <button
              className={settings.provider === "openai" ? "on" : ""}
              onClick={() => setProvider("openai")}
            >
              OpenAI
            </button>
          </div>
        </div>

        <div className="field">
          <label>{settings.provider === "anthropic" ? "Anthropic API Key" : "OpenAI API Key"}</label>
          <input
            type="password"
            value={keyVal}
            placeholder={
              settings.provider === "anthropic"
                ? "sk-ant-..."
                : "sk-..."
            }
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
          />
          <div className="hint">
            {settings.provider === "anthropic" ? (
              <>
                Get a key at{" "}
                <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
                  console.anthropic.com
                </a>
                . Stored only in your browser. Sent only to Anthropic via the backend.
              </>
            ) : (
              <>
                Get a key at{" "}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">
                  platform.openai.com
                </a>
                . Stored only in your browser. Sent only to OpenAI via the backend.
              </>
            )}
          </div>
        </div>

        <div className="field">
          <label>Model</label>
          <select value={settings.model} onChange={(e) => update("model", e.target.value)}>
            {AVAILABLE_MODELS[settings.provider].map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} · {m.id}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Temperature · {settings.temperature.toFixed(2)}</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.temperature}
            onChange={(e) => update("temperature", parseFloat(e.target.value))}
          />
          <div className="hint">
            Lower = more deterministic. Higher = more creative. Default 0.7.
          </div>
        </div>

        <div className="toggle-row">
          <div className="info">
            Self-correcting critic loop
            <div className="desc">
              Run a second pass to evaluate and revise the answer. ~2× cost.
            </div>
          </div>
          <button
            className={`toggle-sw ${settings.criticEnabled ? "on" : ""}`}
            onClick={() => update("criticEnabled", !settings.criticEnabled)}
            aria-label="Toggle critic"
          />
        </div>

        <button className="btn-primary-full" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
