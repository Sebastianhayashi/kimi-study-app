<div align="center">

<img src="public/assets/brand/lucubro-mark.svg" width="72" height="72" alt="Lucubro">

# Lucubro

**手元の教材を、今やるべきことに沿ったコースへ。**

[English](README.md) · [简体中文](README.zh-CN.md) · [ローカルで実行](#lucubro-を実行) · [プロダクトモデル](docs/PRODUCT.md)

</div>

![Lucubro 学習ワークスペース](public/assets/product/hero-showcase.webp)

## 実際に達成したいことから始める

Lucubro は、本、教科書、記事、過去問、自分の文書を学習ワークスペースに変えます。最初に達成したいことを決めると、教材を目標、学習経路、インタラクティブなレッスン、練習、ノート、原文に基づくサポートへ整理します。

二つの学習モードを想定しています。

- **学習と試験対策。** 教科書、問題用紙、練習問題、課題を追加します。「理解した」という自己申告だけでなく、実際の回答や練習結果を重視します。
- **現実の課題を解決。** 文章、プレゼン、仕事上の課題、進行中のプロジェクトに関係する本や記事を追加し、読むことを使える成果へつなげます。

どちらも同じループで進みます。

```text
課題 → 教材 → 行動 → 証拠 → 調整
```

## できること

- EPUB、PDF、Markdown、テキストをアップロード。
- コース作成前に利用場面と成果を決める。
- レッスンを読み、理解確認、ヒント、再試行、応用練習に取り組む。
- レッスンの横で原文を開く。
- 文章を選択し、位置に結びついたノートを書く、または Lucubro の回答を保存する。
- 全コースのノートを一つのノートブックで確認し、元のレッスンへ戻る。
- GitHub のコントリビューショングラフのような表示で、日々のレッスン、ノート、練習を確認する。
- 現在のレッスンと原文を添えて Lucubro に質問する。
- コース、ノート、学習履歴を保ったまま次のレッスンへ進む。

![『アイデアのちから』から作成した実際のコース](public/assets/product/course-workspace.webp)

## チャットではなく、学習のためのワークスペース

- **左のコースナビゲーション**：現在のレッスン、進捗、目次、目標、計画。
- **中央のレッスン**：読むことと練習の中心。
- **右の Lucubro アシスタント**：現在のコースに基づく説明とフィードバック。
- **文脈付きノート**：通常はコンパクトなサイドパネル、集中・全画面で余白が十分なときは margin notes、モバイルではボトムシート。
- **原文リーダー**：単独表示と、レッスンとの並列表示。

コースライブラリは前回の続きから再開します。ノートブックはコース横断で使えるため、ノートを見るために各コースを開く必要はありません。

## 保存されるもの

各コースは、原文、学習目標、学習計画、レッスン、評価、ノート、活動、アシスタントの文脈、生成状態を含むローカルワークスペースです。生成に失敗しても、アップロードした教材と確認済みの目標は保持されます。

現在はレッスンの閲覧、ノート、練習の試行を記録します。修正した文章、解いた問題、プレゼン草稿、プロジェクト成果など、より豊かなユーザー artifacts は今後の方向性であり、まだ完全には実装されていません。

## Lucubro を実行

### 必要な環境

- Node.js 22+
- インストールおよび認証済みの [`kimi` CLI](https://github.com/MoonshotAI/kimi-cli)

この CLI は現在のローカル生成ランタイムです。学習体験内の別ブランドではなく、実装上の依存関係です。

```bash
kimi login
git clone https://github.com/Sebastianhayashi/lucubro.git
cd lucubro
npm ci
npm start
```

`http://localhost:3000` を開きます。

### モデルを呼び出さずに試す

```bash
npm ci
npm run demo:seed
LUCUBRO_DATA_DIR=tests/.runtime/courses PORT=3107 npm start
```

`http://localhost:3107/app` を開きます。デモデータは `data/courses` から分離されています。

## 言語

インターフェースの既定言語は英語です。簡体字中国語と日本語も選択できます。コースと原文は、コース作成時に選んだ言語を保持します。

## 現在の状態

Lucubro は実験的なオープンソース製品であり、本番 SaaS ではありません。

- コース生成は非決定的で、公開前に構造検証と品質ゲートを通ります。
- コースデータはローカルに保存され、モデルへのリクエストは設定済み CLI サービスを使用します。
- 本番アカウント、複数ユーザー権限、決済、クラウドキュー、水平スケーリングは現在の対象外です。
- PDF と EPUB は実ファイルで検証していますが、より広い互換性テストが必要です。

テストは、ランディング、ライブラリ、コース作成、ready/generating/failed 状態、ノート、原文表示、モバイルドロワー、状態整合性を対象にしています。

```bash
npm run check
npm test
npm run fixtures:build
LUCUBRO_DATA_DIR=tests/.runtime/courses npm run fixtures:seed -- --clean
npm run test:e2e:ci
```

詳細は [Product](docs/PRODUCT.md)、[Workflow](docs/WORKFLOW.md)、[Architecture](docs/ARCHITECTURE.md)、[Quality](docs/QUALITY.md)、[Limitations](docs/LIMITATIONS.md) を参照してください。

## コントリビューション

実際のファイル形式のフィクスチャ、アクセシビリティとモバイルの改善、学習証拠の実験、ノートと原文リーダーの回帰テスト、現実の目標に基づくユーザビリティ調査を歓迎します。

[CONTRIBUTING.md](CONTRIBUTING.md) をお読みください。セキュリティ上の問題は [SECURITY.md](SECURITY.md) に従って報告してください。

## ライセンス

コードは [ISC License](LICENSE) で提供されます。サードパーティ作品は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) に記載しています。

Lucubro は独立したオープンソースプロジェクトであり、Moonshot AI の公式製品ではありません。
