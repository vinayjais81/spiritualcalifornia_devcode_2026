#!/bin/bash
#
# Instance bootstrap.
#
# Installs the runtime and leaves the machine READY but EMPTY. It does not
# fetch application code, deliberately: doing so would require git
# credentials baked into the image or the instance profile, and the P8
# pipeline already has the code checked out. Deploys arrive via SSM
# SendCommand instead, so no credential for the source repository ever needs
# to exist on a production host.
#
# Consequence: a freshly launched instance is alive but serves nothing until
# a deploy runs. That is why the Auto Scaling group starts on EC2 health
# checks rather than ELB — see health_check_type in variables.tf.
#
set -euxo pipefail

exec > >(tee /var/log/sc-bootstrap.log) 2>&1
echo "=== bootstrap started $(date -u) ==="

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git unzip postgresql-client jq

# ── Node 22 LTS ──────────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm install -g pm2

# ── AWS CLI v2 (arm/x86 aware) ───────────────────────────────────────────────
ARCH=$(uname -m)
curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-$${ARCH}.zip" -o /tmp/awscliv2.zip
unzip -q /tmp/awscliv2.zip -d /tmp
/tmp/aws/install --update
rm -rf /tmp/aws /tmp/awscliv2.zip

# ── SSM agent ────────────────────────────────────────────────────────────────
# Present on Ubuntu 24.04 via snap, but enable explicitly: it is the ONLY
# access path to this host. There is no SSH port and no key pair, so an agent
# that fails to start makes the instance genuinely unreachable.
snap install amazon-ssm-agent --classic || true
snap start amazon-ssm-agent || systemctl enable --now snap.amazon-ssm-agent.amazon-ssm-agent.service || true

# ── CloudWatch agent ─────────────────────────────────────────────────────────
# Memory and disk are not reported by default; both are exactly what fails
# first here (next build is memory-hungry).
curl -fsSL "https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/$${ARCH/x86_64/amd64}/latest/amazon-cloudwatch-agent.deb" -o /tmp/cwagent.deb
dpkg -i -E /tmp/cwagent.deb || true
rm -f /tmp/cwagent.deb

cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json <<'CWCONF'
{
  "agent": { "metrics_collection_interval": 60 },
  "metrics": {
    "namespace": "SpiritualCalifornia/Prod",
    "append_dimensions": { "InstanceId": "$${aws:InstanceId}" },
    "metrics_collected": {
      "mem":  { "measurement": [ "mem_used_percent" ] },
      "disk": { "measurement": [ "used_percent" ], "resources": [ "/" ] }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          { "file_path": "/var/log/sc-bootstrap.log", "log_group_name": "/sc/prod/bootstrap", "retention_in_days": 30 },
          { "file_path": "/home/ubuntu/.pm2/logs/sc-api-error.log", "log_group_name": "/sc/prod/api", "retention_in_days": 30 },
          { "file_path": "/home/ubuntu/.pm2/logs/sc-api-out.log",   "log_group_name": "/sc/prod/api", "retention_in_days": 30 },
          { "file_path": "/home/ubuntu/.pm2/logs/sc-web-error.log", "log_group_name": "/sc/prod/web", "retention_in_days": 30 },
          { "file_path": "/home/ubuntu/.pm2/logs/sc-web-out.log",   "log_group_name": "/sc/prod/web", "retention_in_days": 30 }
        ]
      }
    }
  }
}
CWCONF

/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json || true

# ── Application directory ────────────────────────────────────────────────────
mkdir -p ${app_dir}
chown -R ubuntu:ubuntu ${app_dir}

# PM2 must come back by itself after a reboot or an auto-recovery event,
# otherwise the instance returns "healthy" at the EC2 level while serving
# nothing.
sudo -u ubuntu bash -c 'pm2 install pm2-logrotate || true'
env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "=== bootstrap complete $(date -u) ==="
echo "Instance is READY but has no application code. Run the P8 deploy."
