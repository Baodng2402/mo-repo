import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@/components/icons';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 'danger' = red confirm button, 'default' = purple */
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional icon name from Feather */
  icon?: string;
}

const ConfirmModal = ({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
  icon,
}: ConfirmModalProps) => {
  const isDanger = variant === 'danger';

  const iconName = icon ?? (isDanger ? 'alert-triangle' : 'help-circle');
  const iconBg = isDanger ? 'rgba(239,68,68,0.12)' : 'rgba(124,58,237,0.12)';
  const iconColor = isDanger ? '#EF4444' : '#A78BFA';
  const confirmBg = isDanger ? '#EF4444' : '#7C3AED';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        className="flex-1 items-center justify-center px-6"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View
          className="w-full rounded-3xl p-6"
          style={{
            backgroundColor: '#131C27',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.07)',
            maxWidth: 360,
          }}>
          {/* Icon */}
          <View className="mb-4 items-center">
            <View
              className="h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: iconBg }}>
              <Feather name={iconName as any} size={26} color={iconColor} />
            </View>
          </View>

          {/* Title */}
          <Text className="mb-2 text-center text-base font-bold text-white">{title}</Text>

          {/* Message */}
          {message ? (
            <Text className="mb-5 text-center text-sm leading-5 text-gray-400">{message}</Text>
          ) : (
            <View className="mb-5" />
          )}

          {/* Buttons */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onCancel}
              disabled={loading}
              activeOpacity={0.7}
              className="flex-1 items-center rounded-xl py-3"
              style={{ backgroundColor: '#1A2332' }}>
              <Text className="text-sm font-semibold text-gray-300">{cancelLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
              className="flex-1 items-center justify-center rounded-xl py-3"
              style={{ backgroundColor: confirmBg }}>
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text className="text-sm font-bold text-white">{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default ConfirmModal;
