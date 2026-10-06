# Daily Quote Cards — setup guide

This folder is the full app: the website (`public/index.html`) plus a small free server part
(`netlify/`) for **online sync** and **Instagram & Facebook autopilot**.

Netlify Drop (drag-and-drop) only runs the website. For sync and autopilot, deploy from GitHub
as described below. Everything here fits in the free plans.

---

## 1. Put the files on GitHub (5 minutes)

1. Sign in at **github.com** (create a free account if needed).
2. Click **+ → New repository**. Name it `daily-quote-cards`, choose **Private**, click **Create repository**.
3. On the new repository page, click **uploading an existing file**.
4. Unzip this download. Open the `daily-quote-cards` folder and drag **everything inside it**
   (`public`, `netlify`, `package.json`, `netlify.toml`, `README.md`) onto the GitHub page.
5. Click **Commit changes**.

## 2. Connect GitHub to Netlify (5 minutes)

1. In Netlify, go to **Projects → Add new project → Import an existing project → GitHub**.
2. Allow access and choose `daily-quote-cards`.
3. Leave the build settings as they are (they come from `netlify.toml`). Click **Deploy**.
4. Open **Project configuration → General → Change project name** and set `daily-quote-cards`
   (rename or delete your old drag-and-drop site first if it already uses that name).

## 3. Set your app password

1. In Netlify, open the project → **Project configuration → Environment variables → Add a variable**.
2. Key: `APP_PASSWORD`. Value: a long password only you know. Save.
3. Go to **Deploys → Trigger deploy → Deploy project** so the password takes effect.
4. Open your site → **Setup → Online sync & autopilot**, type the password, press **Connect**.
   Do the same on your phone — both devices now share the same cards and photos.

## 4. Connect Instagram & Facebook (about 20 minutes, once)

**Before you start**
- Your Instagram account must be **Professional** (Business or Creator) and **linked to your
  Facebook Page** (Instagram app → Settings → Account type and tools / Accounts Center).
- You must be an admin of the Facebook Page.

**Create the Meta app**
1. Go to **developers.facebook.com** → log in with the Facebook account that manages the Page.
2. **My Apps → Create app**. Give it a name like `Daily Quote Cards`.
3. When asked for a use case, choose the option for managing a **Page / Instagram content**
   (if asked for an app type, choose **Business**). Finish creating the app.
4. Open **App settings → Basic**. Copy the **App ID** and **App Secret**.
   The app can stay in Development mode — it only posts to your own Page.

**Get a token**
1. Open **developers.facebook.com/tools/explorer** (Graph API Explorer).
2. On the right, pick your app under **Meta App**.
3. Under **Permissions**, add:
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`,
   `instagram_basic`, `instagram_content_publish`, `business_management`
4. Click **Generate Access Token**. In the pop-up, select your Page and Instagram account and approve.
5. Copy the token.

**Connect in the app**
1. Your site → **Setup → Online sync & autopilot → Connect Instagram & Facebook**.
2. Paste App ID, App Secret and the token. Press **Connect**. Choose your Page if asked.
3. It should say *Connected: your Page + Instagram @youraccount*.

The server turns the token into a long-lasting Page token and keeps it only on your server.
If Meta ever says the token expired, repeat "Get a token" and "Connect".

## 5. Use autopilot

1. **Month** tab → **Fill empty days from library** (and **Shuffle looks & photos** if you like).
2. **Autopilot** tab → choose how many days ahead and Facebook / Instagram → **Send cards to autopilot**.
3. Cards go out automatically within 10 minutes of each post time (the server checks every 10 minutes).
4. Edited a card? Send again — it replaces the scheduled one. **Post now** sends one immediately.
5. **Posting log** shows what went out and any errors.

WhatsApp Channels have no official posting API, so WhatsApp stays on **Today → Share card + caption**.

## Notes
- Instagram feed posts must be between 4:5 and 1.91:1, so Story-size cards go to Facebook only.
- Reels videos are made in your browser (**Make Reel video** / **Today → Reel video**). Chrome on a
  computer and Safari on iPhone save MP4; some browsers save WebM, which Instagram may not accept.
- Your Gemini key stays in each browser and is never sent to your server.
- Change `GRAPH_VERSION` (default `v25.0`) in environment variables if Meta retires that version.
