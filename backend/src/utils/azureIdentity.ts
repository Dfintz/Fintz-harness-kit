const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

function hasNonEmptyValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function isEnabled(value: string | undefined): boolean {
  if (!hasNonEmptyValue(value)) {
    return false;
  }

  const normalized = value?.trim().toLowerCase();
  return typeof normalized === 'string' && TRUE_VALUES.has(normalized);
}

/**
 * Returns the configured managed identity client id, if any.
 */
export function getManagedIdentityClientId(): string | undefined {
  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  return clientId && clientId.length > 0 ? clientId : undefined;
}

/**
 * Workload identity requires AZURE_TENANT_ID + AZURE_CLIENT_ID + AZURE_FEDERATED_TOKEN_FILE.
 * Exclude it by default unless explicitly enabled to avoid noisy availability warnings.
 */
function shouldExcludeWorkloadIdentityCredential(): boolean {
  if (isEnabled(process.env.AZURE_ENABLE_WORKLOAD_IDENTITY)) {
    return false;
  }

  const hasTenantId = hasNonEmptyValue(process.env.AZURE_TENANT_ID);
  const hasClientId = hasNonEmptyValue(process.env.AZURE_CLIENT_ID);
  const hasFederatedTokenFile = hasNonEmptyValue(process.env.AZURE_FEDERATED_TOKEN_FILE);

  return !(hasTenantId && hasClientId && hasFederatedTokenFile);
}

/**
 * Shared DefaultAzureCredential options for backend services.
 */
export function createDefaultAzureCredentialOptions(): Record<string, unknown> {
  const options: Record<string, unknown> = {
    excludeWorkloadIdentityCredential: shouldExcludeWorkloadIdentityCredential(),
    // Broker credential is desktop-oriented and adds expected noise in Linux containers.
    excludeBrokerCredential: true,
  };

  const managedIdentityClientId = getManagedIdentityClientId();
  if (managedIdentityClientId) {
    options.managedIdentityClientId = managedIdentityClientId;
  }

  return options;
}
