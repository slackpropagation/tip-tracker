import { View, Text, Pressable, Modal } from 'react-native';
import { useEffect, useRef } from 'react';
import { useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function Toast({
  visible,
  message,
  type = 'info',
  duration = 3000,
  onClose,
  showCloseButton = false
}: ToastProps) {
  console.log('Toast component render:', { visible, message, type, duration });
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (visible && duration > 0) {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      
      // Set new timer
      timerRef.current = setTimeout(() => {
        onClose?.();
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [visible, duration, onClose]);

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return { backgroundColor: '#129e57' };
      case 'error':
        return { backgroundColor: '#cc3344' };
      case 'info':
      default:
        return { backgroundColor: '#2f95dc' };
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{
        flex: 1,
        justifyContent: 'flex-end',
        alignItems: 'center',
        padding: 20
      }}>
        <View style={{
          width: '100%',
          maxWidth: 520,
          borderRadius: 10,
          padding: 12,
          ...getToastStyle(),
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12
        }}>
          <Text style={{ fontSize: 16 }}>{getIcon()}</Text>
          <Text style={{
            color: 'white',
            flex: 1,
            fontSize: 14,
            lineHeight: 20
          }}>
            {message}
          </Text>
          {showCloseButton && (
            <Pressable
              onPress={onClose}
              style={{
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.2)'
              }}
            >
              <Text style={{ color: 'white', fontSize: 12, fontWeight: '600' }}>
                ✕
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

// Hook for easy toast usage
export function useToast() {
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: ToastType;
  }>({
    visible: false,
    message: '',
    type: 'info'
  });
  
  console.log('useToast state changed:', toast);

  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    duration: number = 3000
  ) => {
    console.log('useToast showToast called with:', { message, type, duration });
    setToast({
      visible: true,
      message,
      type
    });
    console.log('useToast setToast called with visible: true');
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const ToastComponent = useCallback(() => (
    <Toast
      visible={toast.visible}
      message={toast.message}
      type={toast.type}
      duration={3000}
      onClose={hideToast}
    />
  ), [toast.visible, toast.message, toast.type, hideToast]);

  return {
    showToast,
    hideToast,
    ToastComponent
  };
}
