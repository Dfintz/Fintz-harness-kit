import { PermissionMatrixGrid } from '@/components/members/PermissionMatrixGrid';
import {
  useApplyRoleTemplate,
  useCreateRole,
  useDeleteRole,
  useOrganizationRoles,
  useRoleTemplates,
  useUpdateRole,
} from '@/hooks/queries/usePermissionQueries';
import { type Role } from '@/services/permissionService';
import type { RoleTemplate } from '@/types/apiV2';
import { logger } from '@/utils/logger';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';

interface RoleManagementPanelProps {
  organizationId: string;
  isAdmin: boolean;
}

interface RoleFormState {
  name: string;
  description: string;
  priority: number;
}

const INITIAL_ROLE_FORM: RoleFormState = {
  name: '',
  description: '',
  priority: 50,
};

export const RoleManagementPanel: React.FC<Readonly<RoleManagementPanelProps>> = ({
  organizationId,
  isAdmin,
}) => {
  const { data: roles = [], isLoading, error } = useOrganizationRoles(organizationId);
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const deleteRole = useDeleteRole();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [permissionsRole, setPermissionsRole] = useState<Role | null>(null);
  const [form, setForm] = useState<RoleFormState>(INITIAL_ROLE_FORM);
  const [isTemplateOpen, setIsTemplateOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate | null>(null);
  const [templateRoleName, setTemplateRoleName] = useState('');

  const { data: templatesData } = useRoleTemplates();
  const applyTemplate = useApplyRoleTemplate();

  const isSaving = createRole.isPending || updateRole.isPending;
  const isDeleting = deleteRole.isPending;
  const isApplyingTemplate = applyTemplate.isPending;

  const sortedRoles = useMemo(
    () =>
      [...roles].sort((a, b) => {
        const aPriority = Number.isFinite(a.priority) ? a.priority : 0;
        const bPriority = Number.isFinite(b.priority) ? b.priority : 0;
        return bPriority - aPriority || a.name.localeCompare(b.name);
      }),
    [roles]
  );

  const closeTemplate = () => {
    setIsTemplateOpen(false);
    setSelectedTemplate(null);
    setTemplateRoleName('');
  };

  const submitApplyTemplate = async () => {
    if (!selectedTemplate || !templateRoleName.trim()) return;
    try {
      await applyTemplate.mutateAsync({
        templateId: selectedTemplate.id,
        roleName: templateRoleName.trim(),
        organizationId,
      });
      closeTemplate();
    } catch (err) {
      logger.error(
        'Failed to apply role template',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  const resetForm = () => setForm(INITIAL_ROLE_FORM);

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const openEdit = (role: Role) => {
    setForm({
      name: role.name,
      description: role.description ?? '',
      priority: role.priority,
    });
    setEditingRole(role);
  };

  const closeCreate = () => {
    setIsCreateOpen(false);
    resetForm();
  };

  const closeEdit = () => {
    setEditingRole(null);
    resetForm();
  };

  const submitCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await createRole.mutateAsync({
        organizationId,
        data: {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          priority: form.priority,
          permissions: [],
          isSystemRole: false,
          organizationId,
        },
      });
      closeCreate();
    } catch (err) {
      logger.error('Failed to create role', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const submitEdit = async () => {
    if (!editingRole || !form.name.trim()) return;
    try {
      await updateRole.mutateAsync({
        organizationId,
        roleId: editingRole.id,
        data: {
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          priority: form.priority,
        },
      });
      closeEdit();
    } catch (err) {
      logger.error('Failed to update role', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const confirmDelete = async () => {
    if (!deletingRole) return;
    try {
      await deleteRole.mutateAsync({
        organizationId,
        roleId: deletingRole.id,
      });
      setDeletingRole(null);
    } catch (err) {
      logger.error('Failed to delete role', err instanceof Error ? err : new Error(String(err)));
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Card sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <CardContent>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems={{ xs: 'flex-start', sm: 'center' }}
          >
            <Box>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SecurityOutlinedIcon color="primary" />
                Custom Roles
              </Typography>
              <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                Create and manage organization-specific roles with explicit priority ordering.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={() => setIsTemplateOpen(true)}
                disabled={!isAdmin}
              >
                Apply Template
              </Button>
              <Button variant="contained" onClick={openCreate} disabled={!isAdmin}>
                New Role
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error">Failed to load roles for this organization.</Alert>}

      {!isAdmin && (
        <Alert severity="info">
          You can view roles, but only organization owners, founders, and admins can create, edit,
          or delete custom roles.
        </Alert>
      )}

      <Card sx={{ bgcolor: 'var(--card-bg)', border: '1px solid var(--card-border)' }}>
        <CardContent>
          {sortedRoles.length === 0 ? (
            <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
              No roles found.
            </Typography>
          ) : (
            <Table size="small" aria-label="organization roles">
              <TableHead>
                <TableRow>
                  <TableCell>Role</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Permissions</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedRoles.map(role => (
                  <TableRow key={role.id} hover>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {role.name}
                        </Typography>
                        {role.isSystemRole && (
                          <Chip size="small" label="System" variant="outlined" />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                        {role.description || 'No description'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {role.priority}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{role.permissions.length}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Tooltip title="Edit role">
                          <span>
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<EditOutlinedIcon />}
                              onClick={() => openEdit(role)}
                              disabled={!isAdmin || role.isSystemRole}
                            >
                              Edit
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title="Manage permissions">
                          <span>
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<VpnKeyOutlinedIcon />}
                              onClick={() => setPermissionsRole(role)}
                              disabled={!isAdmin}
                            >
                              Permissions
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete role">
                          <span>
                            <Button
                              size="small"
                              color="error"
                              variant="text"
                              startIcon={<DeleteOutlineIcon />}
                              onClick={() => setDeletingRole(role)}
                              disabled={!isAdmin || role.isSystemRole}
                            >
                              Delete
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isCreateOpen} onClose={closeCreate} maxWidth="sm" fullWidth>
        <DialogTitle>Create Role</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Role Name"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Priority"
              type="number"
              value={form.priority}
              onChange={e =>
                setForm(prev => ({
                  ...prev,
                  priority: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                }))
              }
              fullWidth
              slotProps={{ htmlInput: { min: 1, max: 100 } }}
              helperText="Higher number means higher priority (1-100)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreate}>Cancel</Button>
          <Button
            onClick={submitCreate}
            variant="contained"
            disabled={!form.name.trim() || isSaving}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editingRole} onClose={closeEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Role</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Role Name"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Priority"
              type="number"
              value={form.priority}
              onChange={e =>
                setForm(prev => ({
                  ...prev,
                  priority: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                }))
              }
              fullWidth
              slotProps={{ htmlInput: { min: 1, max: 100 } }}
              helperText="Higher number means higher priority (1-100)"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button onClick={submitEdit} variant="contained" disabled={!form.name.trim() || isSaving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deletingRole} onClose={() => setDeletingRole(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Role</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Are you sure you want to delete role <strong>{deletingRole?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeletingRole(null)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={isDeleting}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!permissionsRole}
        onClose={() => setPermissionsRole(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Manage Permissions &mdash; {permissionsRole?.name}</DialogTitle>
        <DialogContent>
          {permissionsRole && (
            <PermissionMatrixGrid
              roleId={permissionsRole.id}
              editable={isAdmin && !permissionsRole.isSystemRole}
              organizationId={organizationId}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermissionsRole(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isTemplateOpen} onClose={closeTemplate} maxWidth="sm" fullWidth>
        <DialogTitle>Apply Role Template</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel id="template-select-label">Template</InputLabel>
              <Select
                labelId="template-select-label"
                value={selectedTemplate?.id ?? ''}
                label="Template"
                onChange={e => {
                  const tmpl = templatesData?.templates.find(t => t.id === e.target.value) ?? null;
                  setSelectedTemplate(tmpl);
                }}
              >
                {(templatesData?.templates ?? []).map(tmpl => (
                  <MenuItem key={tmpl.id} value={tmpl.id}>
                    {tmpl.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {selectedTemplate && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                {selectedTemplate.description}
                <br />
                <strong>Permissions:</strong> {selectedTemplate.permissions.join(', ')}
              </Alert>
            )}
            <TextField
              label="Role Name"
              value={templateRoleName}
              onChange={e => setTemplateRoleName(e.target.value)}
              fullWidth
              required
              placeholder="Enter a name for the new role"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeTemplate}>Cancel</Button>
          <Button
            onClick={submitApplyTemplate}
            variant="contained"
            disabled={!selectedTemplate || !templateRoleName.trim() || isApplyingTemplate}
          >
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};
