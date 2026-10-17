---
description: "Observable browser state stores with explicit snapshots, subscriptions, and lifecycle ownership."
kind: "package-library"
---
# @deepseek-ai/dsh-client-store

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

React 非依存の observable およびスナップショットストアプリミティブであり、Client コントローラーとレンダラーアダプターで共有される。パッケージは同期的およびアニメーションフレーム発行、Immer 支援更新、shallow equality、任意のブラウザー永続化を所有し、React フック構築は `@deepseek-ai/dsh-client-ui-renderer` に残る。React に依存せず安定したスナップショットを発行しなければならない Client 状態で使う。

## 目次

- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="model-experience"></a>
## モデル体験

None。このパッケージはブラウザー側の状態プリミティブを提供し、モデル向けには何も登録しないため。

#### KV キャッシュ効果

None。ストアはモデルリクエストを組み立ても送信もしない。

## 既知の制限と先送り作業

<a id="known-limitations-and-deferred-work"></a>

- **永続化はブラウザーローカルである** — 永続化ストアは `localStorage` 内の JSON を使う。非ブラウザーランタイムは永続化を無効化し、パッケージはデバイス間同期を提供しない。
- **Web シェルビルド入力** — 静的 ESM は Vite 用にサードパーティインポートを保持する。独立したコンシューマーはその開発依存を提供する ([依存規則](../AGENTS.md#dependency-declaration))。


<a id="dev-note"></a>
### 開発ノート

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>
