#!/usr/bin/env bash
#
# Tag the existing QA resources with Environment=qa.
#
# WHY THIS IS A SCRIPT AND NOT TERRAFORM
# --------------------------------------
# QA was built by hand and must stay that way. Importing it into Terraform
# state would put the client's live review environment one config drift, bad
# merge, or stray `terraform destroy` away from deletion. Tagging via the CLI
# changes a label and nothing else — it does not transfer ownership.
#
# WHY IT MATTERS
# --------------
# The IAM permission boundary that stops a compromised QA credential reaching
# production matches on `aws:ResourceTag/Environment`. A resource with no tag
# is not matched by that policy, so it sits OUTSIDE the isolation model. This
# script is a prerequisite for the boundary meaning anything at all.
#
# Usage:
#   ./tag-qa-resources.sh --dry-run    # print what would be tagged
#   ./tag-qa-resources.sh              # apply
#
set -euo pipefail

REGION="us-west-1"
EXPECTED_ACCOUNT="372110294387"
DRY_RUN=0

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

TAGS_EC2="Key=Environment,Value=qa Key=Project,Value=spiritual-california Key=ManagedBy,Value=manual"

say()  { printf '  %s\n' "$*"; }
run()  {
  if [[ $DRY_RUN -eq 1 ]]; then
    say "DRY-RUN: $*"
  else
    "$@" >/dev/null && say "tagged"
  fi
}

# ── Guard: never run against the wrong account ───────────────────────────────
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
if [[ "$ACCOUNT" != "$EXPECTED_ACCOUNT" ]]; then
  echo "ERROR: expected account $EXPECTED_ACCOUNT, got $ACCOUNT. Refusing to run." >&2
  exit 1
fi
echo "Account $ACCOUNT / $REGION $( [[ $DRY_RUN -eq 1 ]] && echo '(dry run)' )"
echo

# ── EC2 instances ────────────────────────────────────────────────────────────
echo "EC2 instances:"
for id in $(aws ec2 describe-instances --region "$REGION" \
    --filters "Name=instance-state-name,Values=running,stopped" \
    --query "Reservations[].Instances[].InstanceId" --output text); do
  say "$id"
  # shellcheck disable=SC2086
  run aws ec2 create-tags --region "$REGION" --resources "$id" --tags $TAGS_EC2
done

# ── Security groups, volumes, and the VPC ────────────────────────────────────
echo
echo "Security groups:"
for id in $(aws ec2 describe-security-groups --region "$REGION" \
    --query "SecurityGroups[?GroupName!='default'].GroupId" --output text); do
  say "$id"
  # shellcheck disable=SC2086
  run aws ec2 create-tags --region "$REGION" --resources "$id" --tags $TAGS_EC2
done

echo
echo "EBS volumes:"
for id in $(aws ec2 describe-volumes --region "$REGION" \
    --query "Volumes[].VolumeId" --output text); do
  say "$id"
  # shellcheck disable=SC2086
  run aws ec2 create-tags --region "$REGION" --resources "$id" --tags $TAGS_EC2
done

# ── RDS ──────────────────────────────────────────────────────────────────────
echo
echo "RDS instances:"
for arn in $(aws rds describe-db-instances --region "$REGION" \
    --query "DBInstances[].DBInstanceArn" --output text); do
  say "$arn"
  run aws rds add-tags-to-resource --region "$REGION" --resource-name "$arn" \
    --tags Key=Environment,Value=qa Key=Project,Value=spiritual-california Key=ManagedBy,Value=manual
done

# ── S3 ───────────────────────────────────────────────────────────────────────
#
# Only the known QA buckets. Deliberately NOT every bucket in the account:
# the Terraform state and audit-log buckets are shared infrastructure, and
# mislabelling them Environment=qa would place them under a policy that denies
# production access to its own state.
echo
echo "S3 buckets (QA only — shared buckets deliberately skipped):"
for b in spiritual-california-documents-dev spiritual-california-cdn-dev; do
  if aws s3api head-bucket --bucket "$b" >/dev/null 2>&1; then
    say "$b"
    run aws s3api put-bucket-tagging --bucket "$b" --tagging \
      'TagSet=[{Key=Environment,Value=qa},{Key=Project,Value=spiritual-california},{Key=ManagedBy,Value=manual}]'
  else
    say "$b — not found, skipping"
  fi
done

echo
if [[ $DRY_RUN -eq 1 ]]; then
  echo "Dry run complete. Re-run without --dry-run to apply."
else
  echo "Done. Verify in the console, or with:"
  echo "  aws resourcegroupstaggingapi get-resources --region $REGION \\"
  echo "    --tag-filters Key=Environment,Values=qa --query 'ResourceTagMappingList[].ResourceARN'"
fi
