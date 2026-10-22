# Dockgeでの配置とローカル確認

このガイドは、親フォルダーにComposeを置き、その下の`feedlog`をビルドする構成向けです。WindowsのDocker Desktop、Mac miniのOrbStackでも同じDocker Compose構成を使えます。

[Composeサンプル](../../compose.dockge.example.yaml)と[環境変数サンプル](../../.env.dockge.example)はコピー用です。既存のComposeや`.env`を置き換えるものではありません。運用中のファイルがある場合は上書きせず、必要な差分だけを確認してください。

## フォルダー構成

```text
スタック親フォルダー/
├── compose.yaml       # Dockgeで使うCompose（compose.ymlでも可）
├── .env               # このスタック専用の設定・秘密情報
├── feedlog/           # このGitリポジトリ
│   ├── Dockerfile
│   ├── compose.dockge.example.yaml
│   └── .env.dockge.example
├── db/                # PostgreSQLのデータ
└── data/              # アップロードなど、/app/.dataのデータ
```

リポジトリ内の通常の`git pull`は、親フォルダーのCompose・`.env`・`db`・`data`を変更しません。リポジトリ内の`compose.yml`も、親Composeとは別のファイルです。

サンプルは`app.build.context: ./feedlog`、`dockerfile: Dockerfile`、`pgvector/pgvector:pg17`、DB名・DBユーザー名`feedlog`、ホスト側ポート`3004`を使います。DBは`./db:/var/lib/postgresql/data`、アプリのデータは`./data:/app/.data`に保存します。

## PRブランチを独立した環境で確認する

本番とは別のスタック・別フォルダーで実行してください。本番のDB、`db`・`data`フォルダー、`.env`、S3バケットや認証情報を共有しないでください。起動時のマイグレーションで接続先DBが更新されます。

1. 新しい空の親フォルダーを作り、PRブランチを取得します。

   ```sh
   mkdir feedlog-pr1-test
   cd feedlog-pr1-test
   git clone --branch fix/upstream-discord-node-security https://github.com/kakunpc/feedlog.git feedlog
   ```

2. リポジトリ内の`compose.dockge.example.yaml`を親フォルダーの`compose.yaml`へ、`.env.dockge.example`を親フォルダーの`.env`へコピーします。エクスプローラーやFinderでも操作できます。

3. `.env`の必須項目を設定します。

   - `POSTGRES_PASSWORD`：検証専用に新しく作ったランダムな16進文字列。
   - `BETTER_AUTH_SECRET`：検証専用の32文字以上のランダム値。
   - `SYSTEM_ADMIN_EMAILS`：テストアカウントに使うメールアドレス。登録前に設定します。
   - `FEEDLOG_PORT=3005`：本番の`3004`と分けます。他のアプリが使用中なら別の空きポートを使ってください。
   - `FEEDLOG_BIND_ADDRESS=127.0.0.1`：Dockerを実行しているPCから確認するための設定です。
   - `BETTER_AUTH_URL=http://localhost:3005`：ポートとURLを合わせます。
   - `AUTH_EMAIL_ENABLED=true`、`AUTH_EMAIL_VERIFY=false`：Discordなしで、通常のメール＋パスワードによる登録・ログインを確認できます。
   - Discord・OpenAI・メール・S3の各認証情報は、最初の表示確認では空欄で構いません。

   秘密値はチャットやGitに貼らず、ローカルの`.env`だけに保存してください。DBパスワードの新規作成時に16進文字列を使うと、接続URLの予約文字の問題を避けられます。既存DBのパスワードはこのために変更しないでください。

4. 親フォルダーで設定を検証し、起動します。

   ```sh
   docker compose -p feedlog-pr1-test config --quiet
   docker compose -p feedlog-pr1-test up -d --build
   docker compose -p feedlog-pr1-test logs --tail 80 app
   ```

   Dockgeの場合は、この親フォルダーを独立した検証スタックとして扱い、同じ設定でビルド・起動してください。既存の本番スタックを編集して検証しないでください。

5. Dockerを実行しているPCのブラウザーで`http://localhost:3005`を開きます。`/health`でも起動を確認できます。初回はDBの準備・移行に少し時間がかかります。`SYSTEM_ADMIN_EMAILS`に設定したアドレスで新規登録すると、既定ワークスペースの管理者になります。これは通常の認証を使う手順で、認証を回避するものではありません。

検証DBは新しい親フォルダーの`./db`、アップロードは同じ親の`./data`です。Composeのプロジェクト名も本番と分けています。別PCのブラウザーで開く場合、そのPCの`localhost`はDockerホストを指しません。この例は同じPCからの確認用です。

停止するときは同じ親フォルダーで`docker compose -p feedlog-pr1-test down`を使います。バインドマウントした`db`・`data`は残ります。本番のフォルダーを削除したり、DBを共有したまま試したりしないでください。

## Discordログインを確認する場合

表示確認やメールログインにはDiscord設定は不要です。実際のDiscordログインを試す場合は、検証用のDiscordアプリケーションのClient IDとClient Secretを`.env`の`DISCORD_CLIENT_ID`・`DISCORD_CLIENT_SECRET`に設定してください。秘密値をリポジトリに登録しないでください。

上記のローカルURLを使う場合、Discord側のOAuth2 Redirectsには次を登録します。

```text
http://localhost:3005/api/auth/callback/discord
```

`BETTER_AUTH_URL`、ブラウザーで開くURL、Discordに登録するコールバックのホスト名とポートを合わせてください。`localhost`と`127.0.0.1`も混在させないでください。変更後は`docker compose -p feedlog-pr1-test up -d app`でアプリを再作成します。

`AUTH_EMAIL_ENABLED=true`ならメールログインも併用できます。Discordだけにしたい場合は、Discordの設定が両方揃ってから`false`にします。OAuth未設定のままメールログインも無効にすると、アプリは起動時にエラーになります。

## 既存のDockge構成との互換性

今回のDockerfileはこれまでと同じくコンテナ内ポート`3000`、保存先`/app/.data`、PostgreSQL接続を使います。上記の既存配置から、必須の環境変数やボリュームを追加する必要はありません。

既存の`POSTGRES_PASSWORD`、`DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL`、`SYSTEM_ADMIN_EMAILS`、Discord・メール・S3設定を維持してください。既存DBを使う際に`.env`の`POSTGRES_PASSWORD`だけ変更しても、PostgreSQL内の既存ユーザーのパスワードは更新されません。認証シークレットの変更はセッションにも影響します。

新しいWidget AgentのAI機能を使う場合は、既存のOpenAI設定に加えて、ツール呼び出しに対応した`OPENAI_TEXT_MODEL`の指定が必要です。AI機能を使わない場合は不要です。Cloudflare・Vercel用のcronやキュー設定はDocker運用では使われません。DockerはNode.js内のタイマーとDBを使い、外部キュー用のボリュームやCloudflareリソースは不要です。

このサンプルは、共有されたDiscord中心の構成に合わせています。既存環境でGoogle・GitHubなど他の独自設定を追加している場合は、その設定も維持してください。

## 更新するとき

PRのレビュー・取り込みが済み、更新するコミットを確認してから、次の順に進めます。この手順は本番操作を自動実行するものではありません。

1. 現在のコミット、親Compose、`.env`、DBとアップロードデータを退避します。DBは`pg_dump`などで整合性のあるバックアップを取得してください。稼働中の`db`フォルダーをそのままコピーするだけでは、復元できるバックアップにならない場合があります。S3利用時はその保存先も対象です。
2. バックアップを独立した検証DBに復元し、移行を確認します。今回のPRは起動時にマイグレーションを自動適用するため、検証アプリを本番DBへ接続しないでください。
3. 既存スタックの親フォルダーで、現在の運用ブランチを確認して取得します。承認したブランチでのみ、`git -C feedlog pull --ff-only`を実行します。PRを未取り込みの`discord_oauth`には、このPRの変更はまだ入りません。
4. 親Compose・`.env`を維持したまま、Dockgeでアプリを再ビルド・再作成します。CLIなら既存のスタックと同じプロジェクト名で、`docker compose up -d --build --no-deps app`を使います。既存スタックのプロジェクト名を変更しないでください。
5. `/health`、Discordログイン、既存投稿・担当者・招待URL・画像／動画の取得を確認します。マイグレーション後のロールバックには、旧アプリだけでなくDBバックアップの復元が必要になる場合があります。

親フォルダーへのサンプル再コピーや、`docker compose down -v`は通常の更新手順には含めません。
