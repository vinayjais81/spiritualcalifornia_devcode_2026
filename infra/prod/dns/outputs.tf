output "nameservers" {
  description = "THE FOUR ADDRESSES THE CLIENT ENTERS AT GODADDY. This is the whole ask."
  value       = aws_route53_zone.main.name_servers
}

output "zone_id" {
  value = aws_route53_zone.main.zone_id
}

output "certificate_arn" {
  description = "Set as acm_certificate_arn in the compute stack to switch HTTPS on."
  value       = aws_acm_certificate.main.arn
}

output "certificate_status" {
  description = "PENDING_VALIDATION until the nameservers are delegated - that is expected, not a fault."
  value       = aws_acm_certificate.main.status
}

output "next_steps" {
  value = <<-EOT
    1. VERIFY THE ZONE BEFORE ASKING ANYONE TO CHANGE ANYTHING.

       Query the new zone directly and confirm it answers identically to
       GoDaddy for mail. Nothing else matters as much: a missing MX record
       stops company email the moment the nameservers change.

         infra/scripts/verify-dns-zone.sh

    2. THEN send the client these four nameservers for GoDaddy:

    3. Ask the client to lower the GoDaddy TTL to 600 first, and wait out the
       old TTL (3600s here). That is what makes a rollback take ten minutes
       instead of an hour.

    4. After delegation:
         terraform apply -var="wait_for_certificate=true"    # issues the cert
         cd ../compute && terraform apply -var="acm_certificate_arn=<arn>"
         then redeploy so the frontend rebuilds against the live domain.

    ROLLBACK at any point: set the GoDaddy nameservers back to
    ns33.domaincontrol.com and ns34.domaincontrol.com.
  EOT
}
