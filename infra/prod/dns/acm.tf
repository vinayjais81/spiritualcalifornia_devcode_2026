/**
 * TLS certificate for the site.
 *
 * Issued in us-west-1 because an Application Load Balancer can only use a
 * certificate from its OWN region. (CloudFront is the exception that catches
 * people out - it accepts us-east-1 only, regardless of where it serves.)
 *
 * DNS-validated rather than email-validated: validation records are written
 * into the zone below, so issuance completes without anyone clicking a link
 * in a mailbox, and renewal every 90 days is fully automatic for as long as
 * the records stay in place.
 */

resource "aws_acm_certificate" "main" {
  domain_name               = var.domain
  subject_alternative_names = ["www.${var.domain}"]
  validation_method         = "DNS"

  # Replace before destroying, so a certificate change never leaves the
  # listener without one.
  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "sc-prod-cert" }
}

/**
 * Validation records.
 *
 * ACM will not issue until these resolve - which means issuance cannot
 * complete until the nameservers have actually been delegated to this zone.
 * Expect the certificate to sit in PENDING_VALIDATION until then; that is the
 * normal sequence, not a fault.
 */
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.main.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id = aws_route53_zone.main.zone_id
  name    = each.value.name
  type    = each.value.type
  ttl     = 60
  records = [each.value.record]

  # The apex and www validations can resolve to the same record; overwrite
  # rather than fail the apply.
  allow_overwrite = true
}

/**
 * Blocks until the certificate is ISSUED.
 *
 * Deliberate: it makes `terraform apply` wait for validation rather than
 * completing while the certificate is still pending, which would let a later
 * stack try to attach a certificate that is not usable yet.
 *
 * BEFORE DELEGATION this will time out after 45 minutes - correctly, because
 * ACM genuinely cannot validate a domain that still resolves at GoDaddy.
 * Apply this stack in two passes: once to create the zone and read the
 * nameservers, then again after delegation to finish the certificate.
 */
resource "aws_acm_certificate_validation" "main" {
  count = var.wait_for_certificate ? 1 : 0

  certificate_arn         = aws_acm_certificate.main.arn
  validation_record_fqdns = [for r in aws_route53_record.cert_validation : r.fqdn]

  timeouts {
    create = "45m"
  }
}
