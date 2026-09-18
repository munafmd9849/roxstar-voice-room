# Deployment

Assessment Section E: Docker, CI/CD that tests **and deploys**, a public AWS URL, secrets, health, rollback. Local Docker is not the submission.

## Cost: stay on AWS Free Tier

Do **not** use Lightsail ($3.50–$5/month). Use **EC2 t3.micro** (750 hours/month for 12 months on a new account).

| Piece | Cost |
| --- | --- |
| EC2 `t3.micro` Ubuntu, 8–15 GB disk | $0 on Free Tier |
| Elastic IP **while attached** to the running VM | $0 |
| GitHub Actions + GHCR | $0 |
| Caddy + Let's Encrypt HTTPS | $0 |
| `sslip.io` hostname | $0 |
| Lightsail, RDS, Load Balancer, NAT Gateway | **paid — do not create** |
| Elastic IP left unused after you stop/delete the VM | **billed — always delete it** |

AWS still asks for a card. Free Tier is $0 if you only create the items above.

If you already started a Lightsail instance, **delete it now**: Lightsail → instance ⋮ → Delete → also delete its static IP.

## How production is wired

```
Android  ──HTTPS──►  Caddy (Let's Encrypt)
                         │
                         ▼
                   Node backend :3000
                         │
                         ▼
                      Postgres
                   (no public port)
```

```
git push main
    │
    ▼
GitHub Actions
    1. npm test + migrate
    2. docker build backend
    3. docker push ghcr.io/munafmd9849/roxstar-voice-room/backend:<sha> and :latest
    4. SSH to free-tier EC2 → pull that image → compose up
    5. curl https://roxstar.<elastic-ip>.sslip.io/health
```

We do **not** `npm start` on the VM. We do **not** use Docker Hub. The tested image lives on **GitHub Container Registry**. The Ubuntu machine only **pulls** it.

Public URL (free DNS that is the IP with a name in front, required for HTTPS):

`https://roxstar.203.0.113.10.sslip.io`

Android **⋮ → Settings → Server** = that `https://...` URL.

| Piece | Public? |
| --- | --- |
| Caddy 80 / 443 | Yes |
| Node 3000 | No |
| Postgres 5432 | No |
| SSH 22 | Yes, key-only |

Rollback: set `BACKEND_IMAGE=ghcr.io/munafmd9849/roxstar-voice-room/backend:<previous-sha>` in `.env.cloud` and run `infrastructure/deploy.sh`.

## Local development (unchanged)

```bash
docker compose -f infrastructure/docker-compose.yml up -d --build
curl http://localhost:3000/health
```

## AWS EC2 Free Tier — browser steps

Region: **Mumbai (`ap-south-1`)**.

### 1. Launch instance

https://console.aws.amazon.com/ec2/ → **Launch instance**

- Name: `roxstar-backend`
- AMI: **Ubuntu Server 24.04 LTS**
- Type: **`t3.micro`** (must say **Free tier eligible**)
- Key pair: **Create new key pair** → name `roxstar` → `.pem` → download and keep it
- Network: create security group `roxstar-sg`
  - SSH 22 from **My IP**
  - HTTP 80 from Anywhere (`0.0.0.0/0`)
  - HTTPS 443 from Anywhere
  - Do **not** add 3000 or 5432
- Storage: **8 GB gp3** (do not go over 30 GB)
- Launch

### 2. Elastic IP (free only while attached)

EC2 → **Elastic IPs** → Allocate (Amazon's pool) → **Associate** to `roxstar-backend`. Copy the IPv4.

URL will be `https://roxstar.<that-ip>.sslip.io`

### 3. Reply here with

- The Elastic IP
- Confirm the instance is **t3.micro**
- Confirm you did **not** create Lightsail / RDS / a load balancer

Then we SSH in with your `.pem`, install Docker, and bring the free stack up.

Until GitHub secrets `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY` exist, the deploy job is skipped.
