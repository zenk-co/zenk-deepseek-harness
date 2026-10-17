---
description: "Client 符号面と Host 読み札が共有する、単一のファイル拡張子から構文強調言語への表。"
kind: "package-library"
---

# dsh-util-code-language

日本語 | [English](README.en.md) | [中文](README.zh.md)

## 概要

Client の文書符号 preview と差分査読、および Host 読み取りツールの持続 `lang` 暗示が共有する、リポジトリ唯一のファイル拡張子から構文強調言語への表。`languageForPath` は経路を大文字小文字を区別せず正準文法 id に写像し、`CODE_HIGHLIGHT_EXTENSIONS` は preview 登録が主張できる全接尾辞を列挙する。`readLangHintForPath` は読み札の短 id 群を同表上に投影するため、記録済みセッションが既に持つ接尾辞は持続値を保ち、その他の接尾辞は言語の短名を取る。パッケージはブラウザー安全で無状態であり、字句解析は Client 強調器に任せる。

## 目次

- [言語選択](#language-selection)
- [既知の制限と後回しの作業](#known-limitations-and-deferred-work)
- [開発メモ](#dev-note)

-----

<a id="language-selection"></a>
## 言語選択

表は [`src/index.ts`](src/index.ts) にある。各鍵は正準言語 id — Client 強調器が解決する文法 id — であり、各値はそれを選択する点なし小文字拡張子である。`languageForPath(path)` は最終経路段片の最後の点より後の文を取り、小文字化して `Map` で引く。`Map` により `foo.constructor` のようなファイル名が `Object.prototype` 員に解決しない。挙げられない点文件 (`.gitignore`)、欠落拡張子、末尾点、未知接尾辞はすべて `undefined` を返し、各利用者は平文として描く。先頭点も区切りであるため `.env` は `dotenv` に解決する。`/` と `\` のどちらも経路段片を分けるため、Windows 経路は POSIX 経路と同様に解決する。

集合は完全な言語登録を写すのではなく、ありふれた原材料、設定、写本、資料、印付けの拡張子向けに選別されている。合う文法のない拡張子は最寄りに写像し (`properties` は `ini` へ。その登録が `properties` 別名を運ぶ)、証書と錠の拡張子 (`pem`、`crt`、`key`、`cer`、`lock`) は挙げないままである。CSV は `csv` に写像し、preview 登録は専覧者を符号より前に置くため表計算が既定 preview のままである。`readLangHintForPath` はこの表上の投影である。記録済みセッションが既に値を持つ接尾辞はその持続短 id を返し、それ以外の接尾辞は言語の短名を返し (`powershell` は `ps1` へ)、未認識接尾辞は `undefined` を返す — よって持続項目は短名という 1 様式を持ち、`kotlin`、`swift`、`yaml`、`json` などではその名が文法 id でもあり、自身名がより良い表示である接尾辞 (`tsx`、`tf`、`tfvars`、`gradle`) はそれを保つ。Client 強調器に実際に言語を字句解析させる必要のある利用者は、その文法がそこで登録されていることに依然依存する — 読み込まれた文法のない id は失敗ではなく平文として描かれる。

-----

## 既知の制限と後回しの作業

<a id="known-limitations-and-deferred-work"></a>

- **拡張子のみ照合** — `languageForPath` は接尾辞を読むため、接尾辞なしで認識される名 (`Dockerfile`、`Makefile`、`.gitignore`、`.editorconfig`) は挙げないままである。ファイル名規則は後回しである。
- **内容物色なし** — 拡張子の欠落や未知のファイルは字句が明白でも平文のままである。表は内容を検査しない。
- **選別的であり網羅的でない** — 表は Shiki 文法目録や GitHub linguist より小さく、言語の追加は拡張子項目と Client 文法登録の両追加を意味する。


<a id="dev-note"></a>
### 開発メモ

<details>
<summary>メンテナー向け作業背景 — クリックで展開</summary>

なし。

</details>
