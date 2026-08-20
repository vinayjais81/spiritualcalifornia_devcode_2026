# Infrastructure — Spiritual California

Terraform for the **production** environment (`spiritualcalifornia.com`), built
alongside the existing QA environment in the same AWS account
(`372110294387`, `us-west-1`).

Full design and rationale: [`docs/production-deployment-plan.md`](../docs/production-deployment-plan.md).

---

## The one rule

**Terraform manages new production resources only. It never manages QA.**

QA (`sc-app-server-dev`, `database-1`, the `spiritual-california-*` buckets)
was built by hand and stays that way. Importing it into Terraform state would
mean a config drift, a bad merge, or a stray `terraform destroy` could delete
the client's review environment. Not worth it for the tidiness.

QA still needs **tags**, because the IAM permission boundary that keeps a
compromised QA credential away from production matches on
`Environment=prod`/`Environment=qa`. Tagging is done with
[`scripts/tag-qa-resources.sh`](scripts/tag-qa-resources.sh) — a plain AWS CLI
script. Tagging a resource does not put it under Terraform's control.

---

## Layout

```
infra/
├── bootstrap/     Run ONCE, first. Creates the S3 bucket that holds
│                  Terraform state. Uses local state itself — chicken
│                  and egg — and that state file is committed nowhere.
├── account/       P1. Account-wide foundation: audit, threat detection,
│                  budgets, and the GitHub OIDC deploy role.
└── scripts/       One-off operational scripts (not Terraform).
```

`prod/` (network, data, compute) arrives with P2–P6.

---

## First run

### 0. Prerequisites

```bash
terraform version     # >= 1.10 for native S3 state locking
aws sts get-caller-identity   # must show account 372110294387
```

### 1. Bootstrap the state bucket (once, ever)

```bash
cd infra/bootstrap
terraform init
terraform apply
```

Creates `sc-tfstate-372110294387` — versioned, encrypted, public access
blocked. Versioning matters: it is the undo button if a state file is
corrupted or a destroy is applied by accident.

### 2. Account foundation

```bash
cd ../account
terraform init      # reads state from the bucket created above
terraform plan      # READ THIS. It is the review step.
terraform apply
```

### 3. Tag the QA resources

```bash
cd ../scripts
./tag-qa-resources.sh --dry-run    # prints what it would tag
./tag-qa-resources.sh              # applies Environment=qa
```

---

## Reviewing a plan

`terraform plan` output is the contract. Before approving:

- **No `destroy` or `replace` lines.** P1 creates only. Anything being
  destroyed means something is wrong — stop and ask.
- **No QA resource names** (`sc-app-server-dev`, `database-1`,
  `spiritual-california-documents*`). Terraform should not know they exist.
- The resource count roughly matches what the change claims to add.

---

## Costs

P1 introduces recurring charges. Both of the meaningful ones are behind
variables so they can be declined:

| Service | Approx / month | Variable |
|---|---|---|
| CloudTrail | ~$2 (first management trail is free; this is S3 storage) | always on |
| GuardDuty | $10–30, scales with traffic | `enable_guardduty` |
| AWS Config | $2–10, scales with resource count | `enable_config` |
| Budgets | free (first two) | always on |
| S3 state bucket | < $1 | always on |

GuardDuty is the one worth paying for: it is the only thing here that detects
a *compromised instance* — credential exfiltration, crypto-mining, contact
with known-bad IPs. On a single-account setup where QA and production share a
blast radius, that detection is doing real work.
