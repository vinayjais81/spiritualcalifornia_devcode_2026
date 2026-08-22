#!/usr/bin/env bash
#
# Compare the new Route 53 zone against the live GoDaddy zone, record by
# record, BEFORE anyone changes a nameserver.
#
# WHY
# ---
# spiritualcalifornia.com carries live Google Workspace email and a working
# Resend configuration. If the new zone is missing or differs on any mail
# record, delegating the nameservers stops mail immediately and completely -
# and the symptom appears minutes later, to everyone, with no obvious cause.
#
# HOW
# ---
# The NEW zone is read from the Route 53 API - it is not yet authoritative
# for the domain, so querying it over DNS would need a tool that can target a
# specific nameserver. The LIVE zone is read over DNS-over-HTTPS, which
# returns what the internet currently sees.
#
# Deliberately no `dig`: it is absent from Git Bash on Windows, which is where
# this actually gets run.
#
# Run it, read it, and only then ask the client to delegate.
#
set -uo pipefail
export MSYS_NO_PATHCONV=1

DOMAIN="${DOMAIN:-spiritualcalifornia.com}"

command -v node >/dev/null || { echo "ERROR: node is required for JSON parsing." >&2; exit 1; }

ZONE_ID=$(aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='${DOMAIN}.'].Id | [0]" --output text 2>/dev/null | sed 's|/hostedzone/||')

if [[ -z "$ZONE_ID" || "$ZONE_ID" == "None" ]]; then
  echo "ERROR: no Route 53 zone for ${DOMAIN}. Apply infra/prod/dns first." >&2
  exit 1
fi

# Whole new zone in one call, cached to a temp file.
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
aws route53 list-resource-record-sets --hosted-zone-id "$ZONE_ID" \
  --output json > "$TMP/new.json"

# What the new zone holds for one name+type, normalised for comparison.
new_rec() {
  node -e '
    const fs=require("fs");
    const [file,name,type]=process.argv.slice(1);
    const z=JSON.parse(fs.readFileSync(file,"utf8"));
    const want=(name.endsWith(".")?name:name+".").toLowerCase();
    const out=[];
    for(const r of z.ResourceRecordSets){
      if(r.Name.toLowerCase()!==want||r.Type!==type)continue;
      if(r.AliasTarget){out.push("ALIAS:"+r.AliasTarget.DNSName.replace(/\.$/,""));continue}
      for(const v of (r.ResourceRecords||[])) out.push(v.Value.replace(/^"|"$/g,"").replace(/\.$/,""));
    }
    console.log(out.sort().join("|"));
  ' "$TMP/new.json" "$1" "$2"
}

# What the internet currently sees, i.e. GoDaddy.
live_rec() {
  curl -s --max-time 20 -H 'accept: application/dns-json' \
    "https://dns.google/resolve?name=$1&type=$2" \
  | node -e '
      let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
        let j={};try{j=JSON.parse(s)}catch(e){}
        const out=(j.Answer||[])
          .filter(a=>a.data!==undefined)
          .map(a=>a.data.replace(/^"|"$/g,"").replace(/\.$/,""));
        console.log(out.sort().join("|"));
      });'
}

fail=0; warn=0

compare() {
  local name="$1" type="$2" critical="$3"
  local live new
  live=$(live_rec "$name" "$type")
  new=$(new_rec "$name" "$type")

  if [[ "$live" == "$new" ]]; then
    printf "  %-40s %-6s MATCH\n" "$name" "$type"
  elif [[ -z "$live" && -z "$new" ]]; then
    printf "  %-40s %-6s both empty\n" "$name" "$type"
  else
    if [[ "$critical" == "critical" ]]; then
      printf "  %-40s %-6s *** MISMATCH - MAIL AFFECTING ***\n" "$name" "$type"
      fail=1
    else
      printf "  %-40s %-6s differs\n" "$name" "$type"
      warn=1
    fi
    printf "      live (GoDaddy) : %s\n" "${live:-<none>}"
    printf "      new (Route53)  : %s\n" "${new:-<none>}"
  fi
}

echo "Comparing live GoDaddy DNS against the new Route 53 zone ($ZONE_ID)"
echo
echo "MAIL - any mismatch here stops company email:"
compare "$DOMAIN"                   MX    critical
compare "$DOMAIN"                   TXT   critical
compare "_dmarc.$DOMAIN"            TXT   critical
compare "resend._domainkey.$DOMAIN" TXT   critical
compare "send.$DOMAIN"              TXT   critical
compare "send.$DOMAIN"              MX    critical
compare "autodiscover.$DOMAIN"      CNAME critical

echo
echo "OTHER SERVICES:"
compare "email.$DOMAIN"             CNAME normal
compare "s3fgxky5sshl.$DOMAIN"      CNAME normal
compare "_domainconnect.$DOMAIN"    CNAME normal

echo
echo "WEBSITE - these are MEANT to differ; that is the point of the migration:"
printf "  %-40s live : %s\n" "$DOMAIN"     "$(live_rec "$DOMAIN" A)"
printf "  %-40s new  : %s\n" "$DOMAIN"     "$(new_rec  "$DOMAIN" A)"
printf "  %-40s live : %s\n" "www.$DOMAIN" "$(live_rec "www.$DOMAIN" CNAME)$(live_rec "www.$DOMAIN" A)"
printf "  %-40s new  : %s\n" "www.$DOMAIN" "$(new_rec  "www.$DOMAIN" A)"

echo
if [[ $fail -eq 1 ]]; then
  echo "STOP. A mail-affecting record does not match."
  echo "Do NOT delegate the nameservers until this is resolved."
  exit 1
fi

[[ $warn -eq 1 ]] && echo "Non-critical differences above - review, but they will not break mail."

echo
echo "All mail records match. Safe to proceed."
echo
echo "Give the client these nameservers for GoDaddy:"
aws route53 get-hosted-zone --id "$ZONE_ID" \
  --query "DelegationSet.NameServers" --output text | tr '\t' '\n' | sed 's/^/  /'
echo
echo "Ask them to lower the GoDaddy TTL to 600 first and wait out the old TTL"
echo "(3600s), so a rollback takes ten minutes rather than an hour."
