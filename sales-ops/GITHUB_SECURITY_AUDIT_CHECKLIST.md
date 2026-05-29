# GitHub Security Audit Checklist

## Overview
This checklist guides a comprehensive GitHub security review for businesses using GitHub for code management and CI/CD automation.

**Audit Type**: Free 15-30 minute review
**Outcome**: Actionable recommendations + implementation roadmap

---

## 1. REPOSITORY EXPOSURE

### Checks
- [ ] All repositories are PRIVATE (unless intentionally public)
- [ ] No sensitive data in README files
- [ ] No credentials, API keys, or tokens in code history
- [ ] No `.env` files committed to repo
- [ ] `.gitignore` properly configured
- [ ] No exposed AWS keys, database credentials, or OAuth tokens

### Questions
- Who has repository access?
- How are external contributors managed?
- Are archived repos still accessible?

---

## 2. BRANCH PROTECTION & WORKFLOW RULES

### Checks
- [ ] Main/production branch has branch protection enabled
- [ ] Require pull request reviews (minimum 2)
- [ ] Require status checks to pass before merge
- [ ] Require branches to be up to date before merge
- [ ] Require code owner review for protected branches
- [ ] Dismiss stale pull request approvals when new commits are pushed
- [ ] Restrict who can push to matching branches

### Questions
- What is the current merge strategy?
- How many reviewers are required?
- Are code owners defined?

---

## 3. MFA & AUTHENTICATION

### Checks
- [ ] All organization members have MFA enabled
- [ ] MFA is enforced at organization level
- [ ] No members accessing via password-only authentication
- [ ] SSH keys are current and rotated periodically
- [ ] GitHub App credentials are managed securely
- [ ] OAuth apps have restricted permissions
- [ ] Personal access tokens have expiration dates
- [ ] Unused tokens are revoked

### Questions
- When was MFA last enforced?
- How are GitHub tokens managed?
- Are there legacy integrations with plain passwords?

---

## 4. SECRETS MANAGEMENT

### Checks
- [ ] No hardcoded secrets in repositories
- [ ] GitHub secret scanning is enabled
- [ ] Secret scanning alert notifications are configured
- [ ] All detected secrets have been rotated
- [ ] Secrets are stored in GitHub Secrets, not `.env` files
- [ ] CI/CD workflows don't log secrets
- [ ] Only necessary secrets are exposed to Actions workflows
- [ ] Secrets follow a naming convention

### Questions
- What secrets are currently stored in GitHub Secrets?
- How often are secrets rotated?
- Are there any known exposed secrets in history?

---

## 5. GITHUB ACTIONS SECURITY

### Checks
- [ ] Actions workflows don't run on `pull_request_target` without caution
- [ ] Third-party actions are pinned to specific versions (not `@latest`)
- [ ] Actions workflows validate external inputs
- [ ] Self-hosted runners are isolated and secured
- [ ] Runner group access is restricted
- [ ] Workflows have timeouts configured
- [ ] Sensitive environment variables are marked as secrets
- [ ] Workflow logs don't expose sensitive data

### Questions
- Are self-hosted runners being used?
- Which third-party actions are in use?
- How are external integrations authenticated?

---

## 6. DEPENDENCY MANAGEMENT

### Checks
- [ ] Dependabot is enabled for security updates
- [ ] Dependabot alerts are reviewed and resolved
- [ ] Dependency scanning is enabled
- [ ] No known vulnerable dependencies
- [ ] Lock files are committed (package-lock.json, Pipfile.lock, etc.)
- [ ] Supply chain security is monitored
- [ ] Third-party dependencies are from trusted sources

### Questions
- What dependency management tools are in use?
- How often are security updates applied?
- Are there any unresolved dependency vulnerabilities?

---

## 7. ACCESS CONTROL

### Checks
- [ ] Organization members have appropriate roles (Owner, Maintainer, Member)
- [ ] Outside collaborators are audited
- [ ] Inactive members have been removed
- [ ] Team access is properly configured
- [ ] Admin access is limited to necessary personnel
- [ ] Machine users / service accounts have minimal permissions
- [ ] Access is reviewed quarterly

### Questions
- Who has organization owner access?
- How are contractor/external access managed?
- Are there any orphaned service accounts?

---

## 8. AUDIT LOGS & MONITORING

### Checks
- [ ] Organization audit log is enabled
- [ ] Audit logs are reviewed regularly
- [ ] Git logs are retained for compliance
- [ ] Suspicious activities are monitored
- [ ] Security alerts are configured
- [ ] Notifications are going to appropriate channels
- [ ] Audit logs are exported for external monitoring

### Questions
- How often are audit logs reviewed?
- What alerting is in place for suspicious activity?
- How long are logs retained?

---

## 9. WEBHOOK & INTEGRATION SECURITY

### Checks
- [ ] Webhooks use HTTPS only
- [ ] Webhook secrets are configured
- [ ] Webhook payloads are validated
- [ ] Unused webhooks are removed
- [ ] Third-party integrations are from verified sources
- [ ] OAuth app permissions are minimal
- [ ] Integration access can be revoked immediately

### Questions
- What external integrations are connected?
- Are webhooks using SSL/TLS?
- How are webhook credentials managed?

---

## 10. COMPLIANCE & POLICIES

### Checks
- [ ] Code of conduct is published
- [ ] Security policy is documented
- [ ] Contribution guidelines exist
- [ ] Data retention policies are defined
- [ ] Compliance requirements are documented
- [ ] DMCA/IP procedures are in place
- [ ] Incident response procedures exist

### Questions
- Are there documented security policies?
- How are security incidents reported?
- What compliance standards apply (SOC 2, HIPAA, etc.)?

---

## REMEDIATION ROADMAP

### Week 1 (Critical)
- [ ] Enable MFA enforcement
- [ ] Rotate all exposed secrets
- [ ] Enable branch protection

### Week 2 (High Priority)
- [ ] Configure Dependabot
- [ ] Audit and pin third-party actions
- [ ] Review and remove inactive members

### Week 3-4 (Medium Priority)
- [ ] Set up audit log exports
- [ ] Document security policies
- [ ] Configure webhook signing

---

## UPSELL OPPORTUNITIES

- **Full Implementation** ($2,000-$5,000): Complete security hardening
- **Monthly Monitoring** ($500/month): Ongoing security review and updates
- **CI/CD Hardening** ($1,500-$3,000): Secure GitHub Actions workflows
- **Secrets Management** ($1,000-$2,000): Implement HashiCorp Vault or similar

---

**Prepared by**: Nebula Security Team
**Date**: [AUDIT_DATE]
**Next Review**: [NEXT_REVIEW_DATE]
