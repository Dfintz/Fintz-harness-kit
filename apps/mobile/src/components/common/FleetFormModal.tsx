import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Colors } from '../../utils/theme';

interface FleetFormModalProps {
  visible: boolean;
  title: string;
  confirmLabel: string;
  pendingLabel: string;
  isPending: boolean;
  name: string;
  description: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export const FleetFormModal: React.FC<Readonly<FleetFormModalProps>> = ({
  visible,
  title,
  confirmLabel,
  pendingLabel,
  isPending,
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onCancel,
  onConfirm,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={onNameChange}
            placeholder="Fleet name"
            placeholderTextColor={Colors.textTertiary}
            maxLength={80}
          />
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            value={description}
            onChangeText={onDescriptionChange}
            placeholder="Description (optional)"
            placeholderTextColor={Colors.textTertiary}
            multiline
            maxLength={240}
          />
          <View style={styles.modalActions}>
            <Pressable style={[styles.modalButton, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalButton, styles.confirmButton]}
              onPress={onConfirm}
              disabled={isPending}
            >
              <Text style={styles.confirmButtonText}>
                {isPending ? pendingLabel : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    color: Colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: Colors.surface,
  },
  descriptionInput: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  modalButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: Colors.primary,
  },
  confirmButtonText: {
    color: Colors.textInverse,
    fontSize: 14,
    fontWeight: '700',
  },
});
