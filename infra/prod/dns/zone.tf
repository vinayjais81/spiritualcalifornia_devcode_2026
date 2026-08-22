/**
 * Route 53 hosted zone for spiritualcalifornia.com.
 *
 * REPLICATED FROM GODADDY, EXACTLY.
 * Source: zone export taken 2026-08-21 22:39:05, 17 records.
 *
 * The domain carries LIVE COMPANY EMAIL (Google Workspace) and a working
 * Resend sending configuration. Delegating the nameservers to a zone missing
 * any of these stops mail the moment the switch happens - completely, and
 * with no warning. So every record below is carried across verbatim before
 * the nameservers change.
 *
 * TWO RECORDS ARE KNOWN TO BE BROKEN AND ARE COPIED BROKEN ANYWAY.
 * See the comments on each. A migration should change WHERE dns is served,
 * never WHAT it says: if mail behaviour shifts afterwards, we need to be able
 * to say with certainty that the move did not cause it. Both are worth fixing
 * as separate, isolated changes once the domain is settled.
 */

resource "aws_route53_zone" "main" {
  name    = var.domain
  comment = "Production. Replicated from GoDaddy 2026-08-21; see zone.tf."

  # Deleting this zone would take the website AND company email down.
  lifecycle {
    prevent_destroy = true
  }

  tags = { Name = "sc-prod-zone" }
}

# ─── Website: apex + www -> the load balancer ────────────────────────────────

/**
 * ALIAS, not CNAME. The load balancer has a name rather than a fixed IP, and
 * DNS forbids a CNAME at the apex - which is precisely why the domain has to
 * be delegated to Route 53 rather than left at GoDaddy.
 *
 * Replaces GoDaddy's `@ A Parked`.
 */
resource "aws_route53_record" "apex" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "A"

  alias {
    name                   = data.terraform_remote_state.compute.outputs.alb_dns_name
    zone_id                = data.terraform_remote_state.compute.outputs.alb_zone_id
    evaluate_target_health = true
  }
}

/**
 * www also points AT THE LOAD BALANCER, not at the apex.
 *
 * GoDaddy had `www CNAME @`. Pointing it at the ALB directly lets the load
 * balancer issue the redirect to the apex, which is what the application
 * needs: production CORS permits exactly one origin, so www must redirect
 * rather than serve.
 */
resource "aws_route53_record" "www" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.${var.domain}"
  type    = "A"

  alias {
    name                   = data.terraform_remote_state.compute.outputs.alb_dns_name
    zone_id                = data.terraform_remote_state.compute.outputs.alb_zone_id
    evaluate_target_health = true
  }
}

# ─── Mail: Google Workspace ──────────────────────────────────────────────────

/**
 * THE RECORD THAT MATTERS MOST. Delivers every @spiritualcalifornia.com
 * message. If this is absent when the nameservers change, mail bounces
 * immediately.
 */
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "MX"
  ttl     = 3600
  records = ["1 smtp.google.com"]
}

# ─── Apex TXT ────────────────────────────────────────────────────────────────

/**
 * All three apex TXT strings in one record set - DNS requires that, and
 * splitting them across resources would make them fight over the same name.
 *
 * DEFECT 1, COPIED AS-IS: the SPF record reads
 * "v=spf1 include:secureserver.net-all" with NO SPACE before -all. That makes
 * `secureserver.net-all` parse as a hostname and leaves no `all` mechanism,
 * so the record does nothing. Correct form is
 * "v=spf1 include:secureserver.net -all".
 *
 * DEFECT 2, COPIED AS-IS: the Google verification token ends in a literal
 * "..." - someone pasted a value their console had visually truncated. Google
 * tokens are ~43 characters; this is 28 plus an ellipsis, so whatever it was
 * verifying is not verified. It cannot be repaired by guessing; the correct
 * value has to come from Google Search Console.
 *
 * Both are pre-existing. Fix them AFTER the migration, one at a time.
 */
resource "aws_route53_record" "txt_apex" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain
  type    = "TXT"
  ttl     = 3600

  records = [
    "google-site-verification=ztOzh4qm706s9NCNnFdBdpcJap-Kf...",
    "NETORGFT20341802.onmicrosoft.com",
    "v=spf1 include:secureserver.net-all",
  ]
}

resource "aws_route53_record" "dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.${var.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:dmarc_rua@onsecureserver.net;"]
}

# ─── Resend: transactional email for the platform ────────────────────────────

/**
 * Already configured on the domain - discovered in the export rather than
 * assumed. This is the standard Resend custom-return-path setup, and it means
 * platform email (verification, password resets, receipts) may already be
 * working rather than being a launch blocker.
 *
 * The DKIM key is the PUBLIC half of the signing pair. Losing it does not
 * stop mail sending, but it stops it being signed - and with DMARC set to
 * p=quarantine above, unsigned mail from this domain risks being quarantined
 * by the recipient. That is a quiet, hard-to-diagnose failure.
 */
resource "aws_route53_record" "resend_dkim" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "resend._domainkey.${var.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDLKaWu3BdaQOL9wg4XeetszKqD43Odcn9UZNHqKFqYSf0fr9bcaWHue/UlkvwPq3SY/mMfH4PXB9Pa7IqyNyzz4d0FdEibAPC3dKk3JT+MKnxzwtGs74mU1SlqIUqUGaLYr9G5TJGw3x1QjJtbv5z+4QFSeKsXcF5qTrzAbVGMawIDAQAB"]
}

resource "aws_route53_record" "send_spf" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "send.${var.domain}"
  type    = "TXT"
  ttl     = 3600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# Bounce and complaint handling for Resend's return path.
resource "aws_route53_record" "send_mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "send.${var.domain}"
  type    = "MX"
  ttl     = 3600
  records = ["10 feedback-smtp.us-east-1.amazonses.com"]
}

# ─── Everything else, carried across verbatim ────────────────────────────────

# Outlook client auto-configuration.
resource "aws_route53_record" "autodiscover" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "autodiscover.${var.domain}"
  type    = "CNAME"
  ttl     = 3600
  records = ["autodiscover.outlook.com"]
}

# GoDaddy email marketing.
resource "aws_route53_record" "email" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "email.${var.domain}"
  type    = "CNAME"
  ttl     = 3600
  records = ["email.secureserver.net"]
}

/**
 * Google Workspace domain verification.
 *
 * The random-looking name is deliberate on Google's part and was NOT
 * discoverable by querying - it only appeared in the export. Removing it can
 * cause Google to treat the domain as unverified, which affects Workspace
 * administration.
 */
resource "aws_route53_record" "google_verify" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "s3fgxky5sshl.${var.domain}"
  type    = "CNAME"
  ttl     = 3600
  records = ["gv-gsigc5lbcwv6up.dv.googlehosted.com"]
}

/**
 * GoDaddy Domain Connect - lets third-party services offer one-click DNS
 * setup. Carried across for completeness; it points back at GoDaddy and will
 * simply be inert once the zone moves. Harmless either way, and removing
 * records during a migration is how surprises happen.
 */
resource "aws_route53_record" "domainconnect" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_domainconnect.${var.domain}"
  type    = "CNAME"
  ttl     = 3600
  records = ["_domainconnect.gd.domaincontrol.com"]
}
