"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getManagedIdentityClientId = getManagedIdentityClientId;
exports.createDefaultAzureCredentialOptions = createDefaultAzureCredentialOptions;
const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
function hasNonEmptyValue(value) {
    return typeof value === 'string' && value.trim().length > 0;
}
function isEnabled(value) {
    if (!hasNonEmptyValue(value)) {
        return false;
    }
    const normalized = value?.trim().toLowerCase();
    return typeof normalized === 'string' && TRUE_VALUES.has(normalized);
}
function getManagedIdentityClientId() {
    const clientId = process.env.AZURE_CLIENT_ID?.trim();
    return clientId && clientId.length > 0 ? clientId : undefined;
}
function shouldExcludeWorkloadIdentityCredential() {
    if (isEnabled(process.env.AZURE_ENABLE_WORKLOAD_IDENTITY)) {
        return false;
    }
    const hasTenantId = hasNonEmptyValue(process.env.AZURE_TENANT_ID);
    const hasClientId = hasNonEmptyValue(process.env.AZURE_CLIENT_ID);
    const hasFederatedTokenFile = hasNonEmptyValue(process.env.AZURE_FEDERATED_TOKEN_FILE);
    return !(hasTenantId && hasClientId && hasFederatedTokenFile);
}
function createDefaultAzureCredentialOptions() {
    const options = {
        excludeWorkloadIdentityCredential: shouldExcludeWorkloadIdentityCredential(),
        excludeBrokerCredential: true,
    };
    const managedIdentityClientId = getManagedIdentityClientId();
    if (managedIdentityClientId) {
        options.managedIdentityClientId = managedIdentityClientId;
    }
    return options;
}
//# sourceMappingURL=azureIdentity.js.map