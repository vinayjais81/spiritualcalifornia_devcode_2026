/**
 * GuardDuty and AWS Config — both optional (and both billable), both
 * recommended on.
 */

# ─── GuardDuty ───────────────────────────────────────────────────────────────

/**
 * The only control in this stack that detects a COMPROMISED INSTANCE:
 * credentials being used from an unexpected location, crypto-mining, traffic
 * to known-bad IPs, unusual API patterns.
 *
 * That scenario matters more here than it would elsewhere. QA and production
 * share one account, and QA is the weaker environment — an open SSH port, a
 * hand-managed box, test credentials. If anything gets in, this is what
 * notices.
 */
resource "aws_guardduty_detector" "main" {
  count = var.enable_guardduty ? 1 : 0

  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"

  datasources {
    s3_logs {
      enable = true
    }
    malware_protection {
      scan_ec2_instance_with_findings {
        ebs_volumes {
          enable = true
        }
      }
    }
  }

  tags = {
    Name        = "sc-guardduty"
    Environment = "shared"
  }
}

# A finding nobody sees is not a control. Route them to the alerts topic.
resource "aws_cloudwatch_event_rule" "guardduty_findings" {
  count = var.enable_guardduty ? 1 : 0

  name        = "sc-guardduty-findings"
  description = "Route GuardDuty findings of MEDIUM severity and above to SNS."

  # GuardDuty severity: 1-3.9 low, 4-6.9 medium, 7+ high. Low findings are
  # mostly noise and would train people to ignore the topic.
  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [{ numeric = [">=", 4] }]
    }
  })

  tags = {
    Environment = "shared"
  }
}

resource "aws_cloudwatch_event_target" "guardduty_to_sns" {
  count = var.enable_guardduty ? 1 : 0

  rule      = aws_cloudwatch_event_rule.guardduty_findings[0].name
  target_id = "send-to-sns"
  arn       = aws_sns_topic.alerts.arn
}

data "aws_iam_policy_document" "sns_events_publish" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.alerts.arn]
  }
}

resource "aws_sns_topic_policy" "alerts" {
  arn    = aws_sns_topic.alerts.arn
  policy = data.aws_iam_policy_document.sns_events_publish.json
}

# ─── AWS Config ──────────────────────────────────────────────────────────────

/**
 * Records resource configuration over time and evaluates compliance rules.
 *
 * The rule that earns its place here is `required-tags`. The whole
 * same-account isolation model rests on `Environment=prod` vs
 * `Environment=qa` — an untagged resource is invisible to the IAM permission
 * boundary and therefore sits outside the policy entirely. Config is what
 * catches that drift, rather than discovering it during an incident.
 */

resource "aws_iam_role" "config" {
  count = var.enable_config ? 1 : 0

  name = "sc-config-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "config.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = {
    Environment = "shared"
  }
}

resource "aws_iam_role_policy_attachment" "config" {
  count = var.enable_config ? 1 : 0

  role       = aws_iam_role.config[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWS_ConfigRole"
}

resource "aws_iam_role_policy" "config_s3" {
  count = var.enable_config ? 1 : 0

  name = "sc-config-s3-delivery"
  role = aws_iam_role.config[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject"]
        Resource = "${aws_s3_bucket.logs.arn}/config/*"
        Condition = {
          StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" }
        }
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetBucketAcl"]
        Resource = aws_s3_bucket.logs.arn
      },
    ]
  })
}

resource "aws_config_configuration_recorder" "main" {
  count = var.enable_config ? 1 : 0

  name     = "sc-config-recorder"
  role_arn = aws_iam_role.config[0].arn

  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

resource "aws_config_delivery_channel" "main" {
  count = var.enable_config ? 1 : 0

  name           = "sc-config-delivery"
  s3_bucket_name = aws_s3_bucket.logs.id
  s3_key_prefix  = "config"

  depends_on = [aws_config_configuration_recorder.main]
}

resource "aws_config_configuration_recorder_status" "main" {
  count = var.enable_config ? 1 : 0

  name       = aws_config_configuration_recorder.main[0].name
  is_enabled = true

  depends_on = [aws_config_delivery_channel.main]
}

# The rule the isolation model depends on.
resource "aws_config_config_rule" "required_tags" {
  count = var.enable_config ? 1 : 0

  name        = "sc-required-tags"
  description = "Every resource must carry Environment and Project — the isolation policy matches on them."

  source {
    owner             = "AWS"
    source_identifier = "REQUIRED_TAGS"
  }

  input_parameters = jsonencode({
    tag1Key = "Environment"
    tag2Key = "Project"
  })

  depends_on = [aws_config_configuration_recorder_status.main]

  tags = {
    Environment = "shared"
  }
}

resource "aws_config_config_rule" "rds_encrypted" {
  count = var.enable_config ? 1 : 0

  name        = "sc-rds-storage-encrypted"
  description = "Production RDS must be encrypted at rest."

  source {
    owner             = "AWS"
    source_identifier = "RDS_STORAGE_ENCRYPTED"
  }

  depends_on = [aws_config_configuration_recorder_status.main]

  tags = {
    Environment = "shared"
  }
}

resource "aws_config_config_rule" "s3_public_read_prohibited" {
  count = var.enable_config ? 1 : 0

  name        = "sc-s3-public-read-prohibited"
  description = "No bucket may be publicly readable — uploads include identity documents."

  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_PUBLIC_READ_PROHIBITED"
  }

  depends_on = [aws_config_configuration_recorder_status.main]

  tags = {
    Environment = "shared"
  }
}
