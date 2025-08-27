import { View, Text, Pressable, Modal } from 'react-native';
import { useState, useCallback } from 'react';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false
}: ConfirmDialogProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
      }}>
        <View style={{
          backgroundColor: 'white',
          padding: 20,
          borderRadius: 12,
          width: '100%',
          maxWidth: 420,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 4,
          elevation: 5
        }}>
          {/* Title */}
          <Text style={{
            fontSize: 18,
            fontWeight: '700',
            marginBottom: 12,
            color: '#333'
          }}>
            {title}
          </Text>

          {/* Message */}
          <Text style={{
            fontSize: 16,
            lineHeight: 22,
            marginBottom: 20,
            color: '#666'
          }}>
            {message}
          </Text>

          {/* Buttons */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            gap: 12
          }}>
            <Pressable
              onPress={onCancel}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: '#f8f9fa',
                borderWidth: 1,
                borderColor: '#dee2e6'
              }}
            >
              <Text style={{
                color: '#495057',
                fontSize: 16,
                fontWeight: '600'
              }}>
                {cancelText}
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: destructive ? '#dc3545' : '#0d6efd'
              }}
            >
              <Text style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600'
              }}>
                {confirmText}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Hook for easy confirmation dialog usage
export function useConfirmDialog() {
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    destructive: false
  });

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void,
    options?: {
      confirmText?: string;
      cancelText?: string;
      destructive?: boolean;
    }
  ) => {
    setDialog({
      visible: true,
      title,
      message,
      onConfirm,
      confirmText: options?.confirmText || 'Confirm',
      cancelText: options?.cancelText || 'Cancel',
      destructive: options?.destructive || false
    });
  }, []);

  const hideConfirm = useCallback(() => {
    setDialog(prev => ({ ...prev, visible: false }));
  }, []);

  const handleConfirm = useCallback(() => {
    dialog.onConfirm?.();
    hideConfirm();
  }, [dialog.onConfirm, hideConfirm]);

  const ConfirmDialogComponent = useCallback(() => (
    <ConfirmDialog
      visible={dialog.visible}
      title={dialog.title}
      message={dialog.message}
      confirmText={dialog.confirmText}
      cancelText={dialog.cancelText}
      destructive={dialog.destructive}
      onConfirm={handleConfirm}
      onCancel={hideConfirm}
    />
  ), [dialog, handleConfirm, hideConfirm]);

  return {
    showConfirm,
    hideConfirm,
    ConfirmDialogComponent
  };
}
