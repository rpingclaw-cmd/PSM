# Host Daily Quote Cards on your own free server (Oracle Cloud)

Total time: about 45 minutes, once. After that, updates are automatic: upload a file to
GitHub and your server picks it up within 5 minutes — no credits, no limits.

What you get: a real always-on computer in Oracle's data centre, free forever ("Always Free"),
running your website, sync, Source bank and Instagram/Facebook autopilot, with HTTPS.

---

## Step 1 — Put the server files on GitHub (2 minutes)

Upload the new `server` folder (with `server.mjs` and `setup.sh`) to your PSM repository:
open `https://github.com/rpingclaw-cmd/PSM/upload/main/server`, drag in both files, **Commit changes**.
(Also upload the newest `public/index.html` if you have not yet.)

## Step 2 — Create your free Oracle Cloud account (10 minutes)

1. Go to **oracle.com/cloud/free** → **Start for free**.
2. Fill in your details. A card is needed **only to verify you** — Always Free resources are not charged.
3. Choose a **Home Region** close to you (e.g. *US West (San Jose)*). It cannot be changed later.
4. Wait for the "account is ready" email, then sign in.

## Step 3 — Create the server (10 minutes)

1. In the Oracle console: **☰ menu → Compute → Instances → Create instance**.
2. **Name:** `quotecards`.
3. **Image and shape → Edit:**
   - Image: **Canonical Ubuntu 24.04** (or 22.04).
   - Shape: **Ampere → VM.Standard.A1.Flex**, 1 OCPU, 6 GB memory (marked *Always Free-eligible*).
     If it says *Out of capacity*, choose **AMD → VM.Standard.E2.1.Micro** instead — also free and enough.
4. **Networking:** keep the defaults (new virtual cloud network, public subnet, **Assign a public IPv4 address = Yes**).
5. **Add SSH keys:** choose **Generate a key pair for me** → click **Save private key**. Keep this file safe.
6. Click **Create**. When it shows **Running**, copy the **Public IP address** (e.g. `129.146.x.x`).

## Step 4 — Open the web ports (3 minutes)

1. On the instance page, click the **Subnet** link → click the **Default Security List**.
2. **Add Ingress Rules** → Source CIDR `0.0.0.0/0`, IP Protocol **TCP**, Destination port range **80,443** → **Add**.

## Step 5 — Get a free web address (3 minutes)

1. Go to **duckdns.org** and sign in (Google is fine).
2. Type a name, e.g. `pranahuti-quotes`, → **add domain**.
3. In the **current ip** box paste your server's Public IP → **update ip**.
4. Copy your **token** (top of the page) — the setup will ask for it.

Your address is now `pranahuti-quotes.duckdns.org`.
(Later you can use a nicer address such as `quotes.pranahutiyoga.org` — ask me.)

## Step 6 — Connect to the server and run one command (10 minutes)

**On Windows**, open **PowerShell** and go to the folder with your key, e.g.:

```
cd $HOME\Downloads
icacls .\ssh-key-*.key /inheritance:r
icacls .\ssh-key-*.key /grant:r "$($env:USERNAME):(R)"
ssh -i .\ssh-key-YOUR-FILE.key ubuntu@YOUR-PUBLIC-IP
```

(Use your real key file name and IP. Type `yes` when asked about the fingerprint.)

You are now inside your server. Paste this one line and press Enter:

```
curl -fsSL https://raw.githubusercontent.com/rpingclaw-cmd/PSM/main/server/setup.sh | sudo bash
```

It asks three things:
- **Your web address:** `pranahuti-quotes.duckdns.org`
- **Your app password:** choose one (this replaces QUOTEAPP from Netlify)
- **DuckDNS token:** paste it

Wait about 3–5 minutes. It ends with **"Done! Open https://…"**.

## Step 7 — Use it

1. Open `https://pranahuti-quotes.duckdns.org` (first time may take 1–2 minutes for HTTPS).
2. **Setup → App password → Connect** → *Connected to your server*.
3. Bring your data: on the old Netlify site **Setup → Download backup**, then on the new site **Restore backup**.
   Paste your AI keys again (they are not in backups).
4. Instagram & Facebook: **Setup → Connect Instagram & Facebook** again (same App ID, Secret, fresh token).

## Updating later

Just upload files to GitHub as before. Your server checks GitHub every 5 minutes and updates itself.
No Netlify, no credits.

## Good to know

- Your server keeps a daily backup of all data for 14 days (`/var/backups/quotecards`).
- If something seems wrong, connect with `ssh` and run: `sudo journalctl -u quotecards -n 50` and send the output.
- To change the app password: run the Step 6 command again.
- Oracle may reclaim Always Free servers that sit *completely* idle for a long time; this app's
  autopilot and daily use keep it active. Keep your Download backup from time to time anyway.
